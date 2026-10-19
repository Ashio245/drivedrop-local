import { EventEmitter } from 'events';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import { Readable } from 'stream';
import unzipper from 'unzipper';
import { createExtractorFromFile } from 'node-unrar-js';
import { GoogleDriveService } from './google-drive.service.js';
import { inferMimeTypeFromFilename } from '../lib/sanitize.js';

export interface ExtractionProgressEvent {
  extractionId: string;
  fileId: string;
  status: 'QUEUED' | 'EXTRACTING' | 'COMPLETED' | 'FAILED';
  currentFile: string;
  filesExtracted: number;
  totalFiles: number;
  outputFolderId?: string;
  errorMessage?: string;
}

export class ArchiveExtractorService extends EventEmitter {
  private static instance: ArchiveExtractorService;
  private activeJobs = new Map<string, { abort: boolean }>();

  public static getInstance(): ArchiveExtractorService {
    if (!ArchiveExtractorService.instance) {
      ArchiveExtractorService.instance = new ArchiveExtractorService();
    }
    return ArchiveExtractorService.instance;
  }

  /**
   * Cleans an internal archive path and strips traversal sequences.
   */
  private sanitizeArchivePath(entryPath: string): string {
    const normalized = path.normalize(entryPath).replace(/\\/g, '/');
    const parts = normalized.split('/').filter((p) => p && p !== '.' && p !== '..');
    return parts.join('/');
  }

  /**
   * Extracts a .zip or .rar file located in Google Drive directly into a Google Drive folder.
   */
  public async extractArchive(params: {
    fileId: string;
    targetFolderId?: string;
    password?: string;
    deleteArchiveAfter?: boolean;
  }): Promise<{ extractionId: string; outputFolderId: string }> {
    const driveService = GoogleDriveService.getInstance();
    const extractionId = `ext_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 1. Get file metadata
    const meta = await driveService.getFileMetadata(params.fileId);
    if (!meta || !meta.name) {
      throw new Error('Archive file not found in Google Drive');
    }

    const filename = meta.name;
    const lowerName = filename.toLowerCase();
    const isZip = lowerName.endsWith('.zip');
    const isRar = lowerName.endsWith('.rar');

    if (!isZip && !isRar) {
      throw new Error(`Unsupported archive format for "${filename}". DriveDrop supports .zip and .rar extraction.`);
    }

    // 2. Create target folder in Google Drive (e.g. "Game_extracted")
    const baseName = filename.replace(/\.(zip|rar)$/i, '');
    const parentFolderId = params.targetFolderId || (meta.parents && meta.parents[0]) || undefined;

    const outputFolder = await driveService.createFolder(
      `${baseName}_extracted`,
      parentFolderId
    );
    const outputFolderId = outputFolder.id!;

    this.activeJobs.set(extractionId, { abort: false });

    // 3. Run extraction in background worker
    setImmediate(async () => {
      try {
        if (isZip) {
          await this.processZipExtraction({
            extractionId,
            fileId: params.fileId,
            outputFolderId,
            deleteArchiveAfter: params.deleteArchiveAfter,
          });
        } else {
          await this.processRarExtraction({
            extractionId,
            fileId: params.fileId,
            outputFolderId,
            password: params.password,
            deleteArchiveAfter: params.deleteArchiveAfter,
          });
        }
      } catch (err: any) {
        this.emit('progress', {
          extractionId,
          fileId: params.fileId,
          status: 'FAILED',
          currentFile: '',
          filesExtracted: 0,
          totalFiles: 0,
          outputFolderId,
          errorMessage: err.message || 'Archive extraction failed',
        });
      } finally {
        this.activeJobs.delete(extractionId);
      }
    });

    return { extractionId, outputFolderId };
  }

  /**
   * Processes a ZIP archive streaming directly from Google Drive into new Drive files.
   */
  private async processZipExtraction(params: {
    extractionId: string;
    fileId: string;
    outputFolderId: string;
    deleteArchiveAfter?: boolean;
  }): Promise<void> {
    const driveService = GoogleDriveService.getInstance();
    const folderCache = new Map<string, string>();
    folderCache.set('', params.outputFolderId);

    const stream = await driveService.getFileStream(params.fileId);
    const zipStream = stream.pipe(unzipper.Parse({ forceStream: true }));

    let filesExtracted = 0;
    const MAX_FILES = 10000;

    for await (const entry of zipStream) {
      if (this.activeJobs.get(params.extractionId)?.abort) {
        entry.autodrain();
        break;
      }

      filesExtracted++;
      if (filesExtracted > MAX_FILES) {
        entry.autodrain();
        throw new Error(`Decompression threshold exceeded: archive contains over ${MAX_FILES} files.`);
      }

      const safePath = this.sanitizeArchivePath(entry.path);
      if (!safePath) {
        entry.autodrain();
        continue;
      }

      const isDirectory = entry.type === 'Directory' || entry.path.endsWith('/');
      const dirName = path.dirname(safePath);
      const fileName = path.basename(safePath);

      // Ensure directory exists in Google Drive
      let currentParentId = params.outputFolderId;
      if (dirName && dirName !== '.') {
        currentParentId = await this.ensureDriveDirectoryHierarchy(
          dirName,
          params.outputFolderId,
          folderCache
        );
      }

      if (isDirectory) {
        // Ensure folder itself is created
        await this.ensureDriveDirectoryHierarchy(
          safePath,
          params.outputFolderId,
          folderCache
        );
        entry.autodrain();
        continue;
      }

      // Stream file directly to Google Drive
      this.emit('progress', {
        extractionId: params.extractionId,
        fileId: params.fileId,
        status: 'EXTRACTING',
        currentFile: fileName,
        filesExtracted,
        totalFiles: filesExtracted, // dynamic in stream
        outputFolderId: params.outputFolderId,
      });

      const mimeType = inferMimeTypeFromFilename(fileName);
      await driveService.uploadFileStream({
        name: fileName,
        parentId: currentParentId,
        mimeType,
        body: entry,
      });
    }

    // Success!
    if (params.deleteArchiveAfter) {
      try {
        await driveService.deleteFile(params.fileId);
      } catch {
        // Ignore delete errors
      }
    }

    this.emit('progress', {
      extractionId: params.extractionId,
      fileId: params.fileId,
      status: 'COMPLETED',
      currentFile: 'Extraction Complete',
      filesExtracted,
      totalFiles: filesExtracted,
      outputFolderId: params.outputFolderId,
    });
  }

  /**
   * Processes a RAR archive by buffering archive stream to a temporary file and extracting.
   */
  private async processRarExtraction(params: {
    extractionId: string;
    fileId: string;
    outputFolderId: string;
    password?: string;
    deleteArchiveAfter?: boolean;
  }): Promise<void> {
    const driveService = GoogleDriveService.getInstance();
    const folderCache = new Map<string, string>();
    folderCache.set('', params.outputFolderId);

    const tempFilePath = path.join(os.tmpdir(), `drivedrop_extract_${params.extractionId}.rar`);

    try {
      // 1. Download RAR archive from Google Drive to temp file
      const driveStream = await driveService.getFileStream(params.fileId);
      const writeStream = fs.createWriteStream(tempFilePath);

      await new Promise<void>((resolve, reject) => {
        driveStream.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        driveStream.on('error', reject);
      });

      // 2. Open with node-unrar-js
      const extractor = await createExtractorFromFile({
        filepath: tempFilePath,
        password: params.password,
      });

      const list = extractor.getFileList();
      const headers = [...list.fileHeaders];
      const totalFiles = headers.filter((h) => !h.flags.directory).length;

      let filesExtracted = 0;
      const MAX_FILES = 10000;

      if (headers.length > MAX_FILES) {
        throw new Error(`Decompression safety limit exceeded: RAR archive contains ${headers.length} entries.`);
      }

      // 3. Extract and upload files
      for (const header of headers) {
        if (this.activeJobs.get(params.extractionId)?.abort) {
          break;
        }

        const safePath = this.sanitizeArchivePath(header.name);
        if (!safePath) continue;

        const isDir = header.flags.directory;
        const dirName = path.dirname(safePath);
        const fileName = path.basename(safePath);

        let currentParentId = params.outputFolderId;
        if (dirName && dirName !== '.') {
          currentParentId = await this.ensureDriveDirectoryHierarchy(
            dirName,
            params.outputFolderId,
            folderCache
          );
        }

        if (isDir) {
          await this.ensureDriveDirectoryHierarchy(
            safePath,
            params.outputFolderId,
            folderCache
          );
          continue;
        }

        filesExtracted++;
        this.emit('progress', {
          extractionId: params.extractionId,
          fileId: params.fileId,
          status: 'EXTRACTING',
          currentFile: fileName,
          filesExtracted,
          totalFiles,
          outputFolderId: params.outputFolderId,
        });

        // Extract single file buffer
        const extracted = extractor.extract({ files: [header.name] });
        const extractedFiles = [...extracted.files];
        const fileData = extractedFiles[0]?.extraction;

        if (fileData) {
          const buffer = Buffer.from(fileData);
          const mimeType = inferMimeTypeFromFilename(fileName);

          await driveService.uploadFileStream({
            name: fileName,
            parentId: currentParentId,
            mimeType,
            body: Readable.from(buffer),
          });
        }
      }

      // Success!
      if (params.deleteArchiveAfter) {
        try {
          await driveService.deleteFile(params.fileId);
        } catch {
          // Ignore
        }
      }

      this.emit('progress', {
        extractionId: params.extractionId,
        fileId: params.fileId,
        status: 'COMPLETED',
        currentFile: 'Extraction Complete',
        filesExtracted,
        totalFiles,
        outputFolderId: params.outputFolderId,
      });
    } finally {
      // Clean up temp file safely
      await fsp.rm(tempFilePath, { force: true }).catch(() => {});
    }
  }

  /**
   * Resolves and creates nested folder paths in Google Drive, caching folder IDs.
   */
  private async ensureDriveDirectoryHierarchy(
    dirPath: string,
    rootFolderId: string,
    cache: Map<string, string>
  ): Promise<string> {
    if (cache.has(dirPath)) {
      return cache.get(dirPath)!;
    }

    const driveService = GoogleDriveService.getInstance();
    const parts = dirPath.split('/').filter(Boolean);

    let accumulatedPath = '';
    let currentParentId = rootFolderId;

    for (const part of parts) {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      if (cache.has(accumulatedPath)) {
        currentParentId = cache.get(accumulatedPath)!;
        continue;
      }

      // Create folder in Drive under current parent
      const newFolder = await driveService.createFolder(part, currentParentId);
      currentParentId = newFolder.id!;
      cache.set(accumulatedPath, currentParentId);
    }

    return currentParentId;
  }
}
