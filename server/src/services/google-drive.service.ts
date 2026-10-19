import { google, drive_v3 } from 'googleapis';
import { request } from 'undici';
import { GoogleAuthService } from './google-auth.service.js';

export interface DriveQuota {
  limit?: string;
  usage?: string;
  usageInDrive?: string;
  usageInDriveTrash?: string;
  userDisplayName?: string;
  userEmail?: string;
}

export interface DriveFileListOptions {
  folderId?: string;
  pageToken?: string;
  pageSize?: number;
  q?: string;
  orderBy?: string;
  onlyFolders?: boolean;
}

export class GoogleDriveService {
  private static instance: GoogleDriveService;

  public static getInstance(): GoogleDriveService {
    if (!GoogleDriveService.instance) {
      GoogleDriveService.instance = new GoogleDriveService();
    }
    return GoogleDriveService.instance;
  }

  private async getDriveClient(): Promise<drive_v3.Drive> {
    const authClient = await GoogleAuthService.getInstance().getAuthenticatedClient();
    return google.drive({ version: 'v3', auth: authClient });
  }

  /**
   * Fetches Google Drive storage quota and user details.
   */
  public async getAbout(): Promise<DriveQuota> {
    const drive = await this.getDriveClient();
    const res = await drive.about.get({
      fields: 'storageQuota, user',
    });

    return {
      limit: res.data.storageQuota?.limit || undefined,
      usage: res.data.storageQuota?.usage || undefined,
      usageInDrive: res.data.storageQuota?.usageInDrive || undefined,
      usageInDriveTrash: res.data.storageQuota?.usageInDriveTrash || undefined,
      userDisplayName: res.data.user?.displayName || undefined,
      userEmail: res.data.user?.emailAddress || undefined,
    };
  }

  /**
   * Lists files or folders inside a folder or across Drive.
   */
  public async listFiles(options: DriveFileListOptions = {}): Promise<{
    files: drive_v3.Schema$File[];
    nextPageToken?: string | null;
  }> {
    const drive = await this.getDriveClient();
    const queryParts: string[] = ['trashed = false'];

    if (options.folderId) {
      queryParts.push(`'${options.folderId}' in parents`);
    }

    if (options.onlyFolders) {
      queryParts.push("mimeType = 'application/vnd.google-apps.folder'");
    }

    if (options.q) {
      // Escape single quotes for Google Drive search syntax
      const sanitizedSearch = options.q.replace(/'/g, "\\'");
      queryParts.push(`name contains '${sanitizedSearch}'`);
    }

    const res = await drive.files.list({
      q: queryParts.join(' and '),
      fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, createdTime, parents, iconLink, thumbnailLink, webViewLink)',
      pageSize: options.pageSize || 30,
      pageToken: options.pageToken || undefined,
      orderBy: options.orderBy || 'folder,name',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });

    return {
      files: res.data.files || [],
      nextPageToken: res.data.nextPageToken,
    };
  }

  /**
   * Creates a folder in Google Drive.
   */
  public async createFolder(name: string, parentId?: string): Promise<drive_v3.Schema$File> {
    const drive = await this.getDriveClient();
    const fileMetadata: drive_v3.Schema$File = {
      name,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (parentId) {
      fileMetadata.parents = [parentId];
    }

    const res = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id, name, mimeType, parents, webViewLink',
      supportsAllDrives: true,
    });

    return res.data;
  }

  /**
   * Renames a file or folder.
   */
  public async renameFile(fileId: string, newName: string): Promise<drive_v3.Schema$File> {
    const drive = await this.getDriveClient();
    const res = await drive.files.update({
      fileId,
      requestBody: { name: newName },
      fields: 'id, name, mimeType',
      supportsAllDrives: true,
    });
    return res.data;
  }

  /**
   * Moves a file into a target folder.
   */
  public async moveFile(fileId: string, targetFolderId: string): Promise<drive_v3.Schema$File> {
    const drive = await this.getDriveClient();
    // Get existing parents
    const file = await drive.files.get({
      fileId,
      fields: 'parents',
      supportsAllDrives: true,
    });

    const previousParents = (file.data.parents || []).join(',');

    const res = await drive.files.update({
      fileId,
      addParents: targetFolderId,
      removeParents: previousParents,
      fields: 'id, name, parents',
      supportsAllDrives: true,
    });

    return res.data;
  }

  /**
   * Trashes or permanently deletes a file.
   */
  public async deleteFile(fileId: string, permanent: boolean = false): Promise<void> {
    const drive = await this.getDriveClient();
    if (permanent) {
      await drive.files.delete({ fileId, supportsAllDrives: true });
    } else {
      await drive.files.update({
        fileId,
        requestBody: { trashed: true },
        supportsAllDrives: true,
      });
    }
  }

  /**
   * Initiates a Google Drive Resumable Upload session.
   * Sends metadata and receives the upload location URL.
   */
  public async initiateResumableUpload(params: {
    filename: string;
    mimeType?: string;
    parentFolderId?: string;
    totalBytes?: bigint | null;
  }): Promise<string> {
    const authClient = await GoogleAuthService.getInstance().getAuthenticatedClient();
    const accessToken = (await authClient.getAccessToken()).token;

    if (!accessToken) {
      throw new Error('Could not obtain valid access token for Google Drive upload');
    }

    const metadata: Record<string, any> = {
      name: params.filename,
      mimeType: params.mimeType || 'application/octet-stream',
    };

    if (params.parentFolderId) {
      metadata.parents = [params.parentFolderId];
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': metadata.mimeType,
    };

    if (params.totalBytes && params.totalBytes > 0n) {
      headers['X-Upload-Content-Length'] = params.totalBytes.toString();
    }

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
      method: 'POST',
      headers,
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Google Drive resumable upload initiation failed (${response.status}): ${errText}`);
    }

    const uploadUrl = response.headers.get('Location');
    if (!uploadUrl) {
      throw new Error('Google Drive did not return a resumable Location URL');
    }

    return uploadUrl;
  }

  /**
   * Retrieves metadata for a specific file in Google Drive.
   */
  public async getFileMetadata(fileId: string): Promise<drive_v3.Schema$File> {
    const drive = await this.getDriveClient();
    const res = await drive.files.get({
      fileId,
      fields: 'id, name, mimeType, size, parents, trashed',
      supportsAllDrives: true,
    });
    return res.data;
  }

  /**
   * Returns a readable stream of a file's binary content from Google Drive.
   */
  public async getFileStream(fileId: string): Promise<any> {
    const drive = await this.getDriveClient();
    const res = await drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' }
    );
    return res.data;
  }

  /**
   * Uploads any stream directly into Google Drive via chunked resumable upload.
   * Completely zero-disk overhead: streams through memory in 8MB chunks.
   */
  public async uploadStreamChunked(params: {
    name: string;
    parentId?: string;
    mimeType?: string;
    body: any;
    totalBytes?: bigint;
    signal?: AbortSignal;
  }): Promise<{ id?: string; name: string }> {
    const CHUNK_SIZE = 8 * 1024 * 1024; // 8 MiB

    // 1. Initiate resumable upload session with Google Drive
    const resumableUri = await this.initiateResumableUpload({
      filename: params.name,
      mimeType: params.mimeType,
      parentFolderId: params.parentId,
      totalBytes: params.totalBytes || null,
    });

    // 2. Pump stream chunks
    let bufferChunks: Buffer[] = [];
    let bufferLength = 0;
    let currentOffset = 0n;
    let driveFileId: string | undefined;

    for await (const chunk of params.body) {
      if (params.signal?.aborted) {
        throw new Error('Upload aborted');
      }

      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bufferChunks.push(buf);
      bufferLength += buf.length;

      if (bufferLength >= CHUNK_SIZE) {
        const combined = Buffer.concat(bufferChunks);
        const toSend = combined.subarray(0, CHUNK_SIZE);
        const remainder = combined.subarray(CHUNK_SIZE);

        const endByte = currentOffset + BigInt(toSend.length) - 1n;
        const totalStr = params.totalBytes ? params.totalBytes.toString() : '*';

        const res = await request(resumableUri, {
          method: 'PUT',
          headers: {
            'Content-Length': toSend.length.toString(),
            'Content-Range': `bytes ${currentOffset}-${endByte}/${totalStr}`,
          },
          body: toSend,
          signal: params.signal,
        });

        if (res.statusCode === 200 || res.statusCode === 201) {
          const bodyText = await res.body.text();
          try {
            const json = JSON.parse(bodyText);
            driveFileId = json.id;
          } catch {}
        } else if (res.statusCode === 308) {
          await res.body.dump();
        } else {
          const errText = await res.body.text();
          throw new Error(`Google Drive upload chunk failed (${res.statusCode}): ${errText}`);
        }

        currentOffset += BigInt(toSend.length);
        bufferChunks = remainder.length > 0 ? [remainder] : [];
        bufferLength = remainder.length;
      }
    }

    // 3. Finalize remaining chunk
    const finalBuffer = Buffer.concat(bufferChunks);
    const finalTotal = currentOffset + BigInt(finalBuffer.length);
    const endByte = finalTotal > 0n ? finalTotal - 1n : 0n;

    if (finalBuffer.length > 0) {
      const res = await request(resumableUri, {
        method: 'PUT',
        headers: {
          'Content-Length': finalBuffer.length.toString(),
          'Content-Range': `bytes ${currentOffset}-${endByte}/${finalTotal}`,
        },
        body: finalBuffer,
        signal: params.signal,
      });

      if (res.statusCode === 200 || res.statusCode === 201) {
        const bodyText = await res.body.text();
        try {
          const json = JSON.parse(bodyText);
          driveFileId = json.id;
        } catch {}
      } else {
        const errText = await res.body.text();
        throw new Error(`Google Drive finalize failed (${res.statusCode}): ${errText}`);
      }
    } else if (!driveFileId && finalTotal === 0n) {
      const res = await request(resumableUri, {
        method: 'PUT',
        headers: {
          'Content-Length': '0',
          'Content-Range': 'bytes */0',
        },
        signal: params.signal,
      });
      if (res.statusCode === 200 || res.statusCode === 201) {
        const bodyText = await res.body.text();
        try {
          const json = JSON.parse(bodyText);
          driveFileId = json.id;
        } catch {}
      }
    } else if (!driveFileId && finalTotal > 0n) {
      const res = await request(resumableUri, {
        method: 'PUT',
        headers: {
          'Content-Length': '0',
          'Content-Range': `bytes */${finalTotal}`,
        },
        signal: params.signal,
      });
      if (res.statusCode === 200 || res.statusCode === 201) {
        const bodyText = await res.body.text();
        try {
          const json = JSON.parse(bodyText);
          driveFileId = json.id;
        } catch {}
      }
    }

    return { id: driveFileId, name: params.name };
  }

  /**
   * Uploads an individual file stream directly into Google Drive with zero local disk footprint.
   */
  public async uploadFileStream(params: {
    name: string;
    parentId?: string;
    mimeType?: string;
    body: any;
    totalBytes?: bigint;
    signal?: AbortSignal;
  }): Promise<{ id?: string; name: string }> {
    return this.uploadStreamChunked(params);
  }
}

