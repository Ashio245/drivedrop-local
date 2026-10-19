import { EventEmitter } from 'events';
import { request, Dispatcher } from 'undici';
import { prisma } from '../lib/prisma.js';
import { validateUrlForSSRF } from '../lib/ssrf.js';
import { sanitizeFilename, extractFilenameFromContentDisposition, inferMimeTypeFromFilename } from '../lib/sanitize.js';
import { GoogleDriveService } from './google-drive.service.js';

// Chunk size: 8 MiB (must be multiple of 256 KiB = 262,144 bytes)
const CHUNK_SIZE = 8 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export interface TransferEvent {
  transferId: string;
  status: string;
  transferredBytes: string;
  totalBytes: string | null;
  speedBps: number;
  etaSeconds: number | null;
  percentage: number | null;
  errorMessage?: string | null;
  filename: string;
}

interface ActiveTransferState {
  abortController: AbortController;
  isPaused: boolean;
  lastProgressTimestamp: number;
  bytesSinceLastCalc: number;
}

export class StreamManagerService extends EventEmitter {
  private static instance: StreamManagerService;
  private activeJobs = new Map<string, ActiveTransferState>();

  public static getInstance(): StreamManagerService {
    if (!StreamManagerService.instance) {
      StreamManagerService.instance = new StreamManagerService();
    }
    return StreamManagerService.instance;
  }

  private async log(transferId: string, level: string, message: string): Promise<void> {
    try {
      await prisma.transferLog.create({
        data: {
          transferId,
          level,
          message,
        },
      });
    } catch {
      // Ignore database logging errors
    }
  }

  private emitProgress(transfer: {
    id: string;
    status: string;
    transferredBytes: bigint;
    totalBytes: bigint | null;
    speedBps: number;
    etaSeconds: number | null;
    errorMessage?: string | null;
    filename: string;
  }) {
    let percentage: number | null = null;
    if (transfer.totalBytes && transfer.totalBytes > 0n) {
      percentage = Math.min(100, Number((transfer.transferredBytes * 10000n) / transfer.totalBytes) / 100);
    }

    const payload: TransferEvent = {
      transferId: transfer.id,
      status: transfer.status,
      transferredBytes: transfer.transferredBytes.toString(),
      totalBytes: transfer.totalBytes ? transfer.totalBytes.toString() : null,
      speedBps: transfer.speedBps,
      etaSeconds: transfer.etaSeconds,
      percentage,
      errorMessage: transfer.errorMessage,
      filename: transfer.filename,
    };

    this.emit('progress', payload);
  }

  /**
   * Creates and kicks off a new direct-to-Drive transfer.
   */
  public async createTransfer(params: {
    url: string;
    customFilename?: string;
    folderId?: string;
    customHeaders?: Record<string, string>;
  }): Promise<{ id: string; filename: string; status: string }> {
    // 1. SSRF Validation
    const ssrfCheck = await validateUrlForSSRF(params.url);
    if (!ssrfCheck.isValid) {
      throw new Error(`SSRF Security Violation: ${ssrfCheck.error}`);
    }

    // 2. Initial Probe to discover Content-Disposition and Content-Length
    const probe = await this.probeRemoteUrl(params.url, params.customHeaders);

    // Determine final sanitized filename
    const derivedFilename = sanitizeFilename(
      params.customFilename || probe.filename,
      params.url
    );
    const mimeType = probe.mimeType || inferMimeTypeFromFilename(derivedFilename);

    // 3. Insert record in SQLite
    const transfer = await prisma.transfer.create({
      data: {
        sourceUrl: params.url,
        filename: derivedFilename,
        mimeType,
        totalBytes: probe.contentLength,
        transferredBytes: 0n,
        status: 'QUEUED',
        driveFolderId: params.folderId || null,
        customHeaders: params.customHeaders ? JSON.stringify(params.customHeaders) : null,
      },
    });

    await this.log(transfer.id, 'INFO', `Transfer created. Target: Google Drive. Filename: ${derivedFilename}`);
    if (probe.contentLength) {
      await this.log(transfer.id, 'INFO', `Detected Content-Length: ${probe.contentLength} bytes`);
    } else {
      await this.log(transfer.id, 'INFO', 'Remote source does not advertise Content-Length. Operating in streaming chunked mode.');
    }

    // Kick off worker asynchronously
    setImmediate(() => {
      this.executeTransfer(transfer.id).catch(async (err) => {
        await this.handleTransferFailure(transfer.id, err);
      });
    });

    return { id: transfer.id, filename: derivedFilename, status: 'QUEUED' };
  }

  /**
   * Inspects remote URL headers with SSRF redirect defense.
   */
  private async probeRemoteUrl(
    targetUrl: string,
    customHeaders?: Record<string, string>
  ): Promise<{
    contentLength: bigint | null;
    mimeType: string | null;
    filename: string | null;
  }> {
    let currentUrl = targetUrl;
    let redirectCount = 0;

    while (redirectCount <= MAX_REDIRECTS) {
      const parsedUrl = new URL(currentUrl);
      const headers: Record<string, string> = {
        'User-Agent': 'DriveDropLocal/1.0 (production-grade stream utility)',
        Accept: '*/*',
        ...(customHeaders || {}),
      };

      const res = await request(currentUrl, {
        method: 'HEAD',
        headers,
      });

      // Handle Redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
        redirectCount++;
        const location = res.headers['location'] as string;
        if (!location) {
          break;
        }

        const nextUrl = new URL(location, currentUrl).toString();
        // Validate redirect target for SSRF
        const ssrf = await validateUrlForSSRF(nextUrl);
        if (!ssrf.isValid) {
          throw new Error(`SSRF blocked redirect to ${nextUrl}: ${ssrf.error}`);
        }
        currentUrl = nextUrl;
        continue;
      }

      // If HEAD is rejected or returned 405 Method Not Allowed, return default
      if (res.statusCode >= 400 && res.statusCode !== 405) {
        // Some servers reject HEAD, continue to attempt GET
      }

      const contentLenHeader = res.headers['content-length'] as string;
      const contentTypeHeader = res.headers['content-type'] as string;
      const contentDispHeader = res.headers['content-disposition'] as string;

      let contentLength: bigint | null = null;
      if (contentLenHeader && /^\d+$/.test(contentLenHeader)) {
        contentLength = BigInt(contentLenHeader);
      }

      const filename = extractFilenameFromContentDisposition(contentDispHeader);

      return {
        contentLength,
        mimeType: contentTypeHeader ? contentTypeHeader.split(';')[0].trim() : null,
        filename,
      };
    }

    return { contentLength: null, mimeType: null, filename: null };
  }

  /**
   * Main transfer loop: streams chunks directly to Google Drive resumable session.
   */
  private async executeTransfer(transferId: string): Promise<void> {
    const transfer = await prisma.transfer.findUnique({ where: { id: transferId } });
    if (!transfer || transfer.status === 'CANCELLED' || transfer.status === 'PAUSED') {
      return;
    }

    const abortController = new AbortController();
    this.activeJobs.set(transferId, {
      abortController,
      isPaused: false,
      lastProgressTimestamp: Date.now(),
      bytesSinceLastCalc: 0,
    });

    try {
      await prisma.transfer.update({
        where: { id: transferId },
        data: { status: 'CONNECTING' },
      });
      await this.log(transferId, 'INFO', 'Connecting to Google Drive and source server...');

      // 1. Get or initiate Google Drive Resumable Upload Session
      let resumableUri = transfer.resumableUri;
      let startByte = transfer.transferredBytes;

      if (!resumableUri) {
        await this.log(transferId, 'INFO', 'Creating Google Drive resumable upload session...');
        resumableUri = await GoogleDriveService.getInstance().initiateResumableUpload({
          filename: transfer.filename,
          mimeType: transfer.mimeType || undefined,
          parentFolderId: transfer.driveFolderId || undefined,
          totalBytes: transfer.totalBytes,
        });

        await prisma.transfer.update({
          where: { id: transferId },
          data: { resumableUri },
        });
        await this.log(transferId, 'INFO', 'Resumable session initiated.');
      } else {
        // Query Google Drive for the current received byte offset
        await this.log(transferId, 'INFO', 'Checking existing resumable upload offset with Google Drive...');
        startByte = await this.queryGoogleDriveUploadedBytes(resumableUri, transfer.totalBytes);
        await this.log(transferId, 'INFO', `Google Drive reports byte offset: ${startByte}`);
        
        await prisma.transfer.update({
          where: { id: transferId },
          data: { transferredBytes: startByte },
        });
      }

      // 2. Connect to remote source with Range header if resuming
      await prisma.transfer.update({
        where: { id: transferId },
        data: { status: 'STREAMING' },
      });
      await this.log(transferId, 'INFO', `Beginning direct chunked streaming from byte ${startByte}...`);

      const customHeaders: Record<string, string> = transfer.customHeaders
        ? JSON.parse(transfer.customHeaders)
        : {};

      const sourceHeaders: Record<string, string> = {
        'User-Agent': 'DriveDropLocal/1.0',
        Accept: '*/*',
        ...customHeaders,
      };

      if (startByte > 0n) {
        sourceHeaders['Range'] = `bytes=${startByte}-`;
      }

      const res = await request(transfer.sourceUrl, {
        method: 'GET',
        headers: sourceHeaders,
        signal: abortController.signal,
      });

      if (res.statusCode >= 400) {
        throw new Error(`Remote source responded with HTTP ${res.statusCode} ${res.headers['status-text'] || ''}`);
      }

      // Check if remote accepted Range header if we requested one
      let currentOffset = startByte;
      if (startByte > 0n && res.statusCode !== 206) {
        await this.log(
          transferId,
          'WARN',
          `Source returned HTTP ${res.statusCode} instead of 206 Partial Content. Resetting offset to 0.`
        );
        currentOffset = 0n;
        // Reset resumable session if remote cannot fulfill partial range
      }

      // Update totalBytes if discovered from Content-Length or Content-Range
      let totalBytes = transfer.totalBytes;
      const respContentLen = res.headers['content-length'] as string;
      const respContentRange = res.headers['content-range'] as string;

      if (!totalBytes) {
        if (respContentRange) {
          const match = respContentRange.match(/\/(\d+|\*)$/);
          if (match && match[1] !== '*') {
            totalBytes = BigInt(match[1]);
          }
        } else if (respContentLen) {
          totalBytes = currentOffset + BigInt(respContentLen);
        }

        if (totalBytes) {
          await prisma.transfer.update({
            where: { id: transferId },
            data: { totalBytes },
          });
        }
      }

      // 3. Stream Pump: gather chunks up to CHUNK_SIZE and send via PUT to Google Drive
      let bufferChunks: Buffer[] = [];
      let bufferLength = 0;
      let lastSpeedCalcTime = Date.now();
      let bytesSinceLastCalc = 0;

      for await (const chunk of res.body) {
        if (abortController.signal.aborted) {
          return;
        }

        const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        bufferChunks.push(buf);
        bufferLength += buf.length;
        bytesSinceLastCalc += buf.length;

        // Progress speed calculation every 1000ms
        const now = Date.now();
        if (now - lastSpeedCalcTime >= 1000) {
          const elapsedSec = (now - lastSpeedCalcTime) / 1000;
          const speedBps = Math.round(bytesSinceLastCalc / elapsedSec);
          lastSpeedCalcTime = now;
          bytesSinceLastCalc = 0;

          let etaSeconds: number | null = null;
          if (totalBytes && totalBytes > currentOffset + BigInt(bufferLength) && speedBps > 0) {
            const remaining = Number(totalBytes - (currentOffset + BigInt(bufferLength)));
            etaSeconds = Math.round(remaining / speedBps);
          }

          const runningTransferred = currentOffset + BigInt(bufferLength);
          this.emitProgress({
            id: transferId,
            status: 'STREAMING',
            transferredBytes: runningTransferred,
            totalBytes,
            speedBps,
            etaSeconds,
            filename: transfer.filename,
          });

          // Periodically save to SQLite
          await prisma.transfer.update({
            where: { id: transferId },
            data: {
              transferredBytes: runningTransferred,
              speedBps,
              etaSeconds,
            },
          });
        }

        // When buffer reaches CHUNK_SIZE, send chunk to Google Drive
        if (bufferLength >= CHUNK_SIZE) {
          const combined = Buffer.concat(bufferChunks);
          // Split exactly into CHUNK_SIZE and remaining
          const toSend = combined.subarray(0, CHUNK_SIZE);
          const remainder = combined.subarray(CHUNK_SIZE);

          const endByte = currentOffset + BigInt(toSend.length) - 1n;
          const isComplete = totalBytes ? endByte + 1n >= totalBytes : false;

          await this.uploadChunkToGoogleDrive({
            resumableUri,
            chunk: toSend,
            startByte: currentOffset,
            endByte,
            totalBytes,
            isComplete,
            signal: abortController.signal,
          });

          currentOffset += BigInt(toSend.length);
          bufferChunks = remainder.length > 0 ? [remainder] : [];
          bufferLength = remainder.length;
        }
      }

      // 4. Send final remaining chunk (or empty chunk if file is exactly multiple of CHUNK_SIZE)
      const finalBuffer = Buffer.concat(bufferChunks);
      const finalEndByte = currentOffset + BigInt(finalBuffer.length) - 1n;
      const finalTotalBytes = currentOffset + BigInt(finalBuffer.length);

      await this.log(
        transferId,
        'INFO',
        `Sending final chunk (${finalBuffer.length} bytes). Total finalized size: ${finalTotalBytes} bytes.`
      );

      const finalResult = await this.uploadChunkToGoogleDrive({
        resumableUri,
        chunk: finalBuffer,
        startByte: currentOffset,
        endByte: finalEndByte,
        totalBytes: finalTotalBytes,
        isComplete: true,
        signal: abortController.signal,
      });

      // Transfer Completed!
      const driveFileId = finalResult?.id || null;
      await prisma.transfer.update({
        where: { id: transferId },
        data: {
          status: 'COMPLETED',
          transferredBytes: finalTotalBytes,
          totalBytes: finalTotalBytes,
          driveFileId,
          completedAt: new Date(),
          speedBps: 0,
          etaSeconds: 0,
        },
      });

      await this.log(transferId, 'INFO', `Transfer successfully completed! Drive File ID: ${driveFileId || 'N/A'}`);

      this.emitProgress({
        id: transferId,
        status: 'COMPLETED',
        transferredBytes: finalTotalBytes,
        totalBytes: finalTotalBytes,
        speedBps: 0,
        etaSeconds: 0,
        filename: transfer.filename,
      });
    } catch (err: any) {
      if (abortController.signal.aborted) {
        // Paused or cancelled intentionally
        return;
      }
      await this.handleTransferFailure(transferId, err);
    } finally {
      this.activeJobs.delete(transferId);
    }
  }

  /**
   * Uploads an individual chunk via PUT to the Google Drive resumable upload URI.
   */
  private async uploadChunkToGoogleDrive(params: {
    resumableUri: string;
    chunk: Buffer;
    startByte: bigint;
    endByte: bigint;
    totalBytes: bigint | null;
    isComplete: boolean;
    signal: AbortSignal;
  }): Promise<{ id?: string } | null> {
    const totalStr = params.totalBytes !== null ? params.totalBytes.toString() : '*';
    const contentRange = `bytes ${params.startByte}-${params.endByte}/${totalStr}`;

    const res = await request(params.resumableUri, {
      method: 'PUT',
      headers: {
        'Content-Length': params.chunk.length.toString(),
        'Content-Range': contentRange,
      },
      body: params.chunk,
      signal: params.signal,
    });

    if (res.statusCode === 200 || res.statusCode === 201) {
      // Completed and finalized!
      const bodyText = await res.body.text();
      try {
        return JSON.parse(bodyText);
      } catch {
        return null;
      }
    }

    if (res.statusCode === 308) {
      // Resume Incomplete - chunk accepted successfully
      await res.body.dump();
      return null;
    }

    const errText = await res.body.text();
    throw new Error(`Google Drive PUT chunk failed (${res.statusCode}): ${errText}`);
  }

  /**
   * Queries Google Drive for the byte offset it has accepted so far.
   */
  public async queryGoogleDriveUploadedBytes(
    resumableUri: string,
    totalBytes: bigint | null
  ): Promise<bigint> {
    const totalStr = totalBytes ? totalBytes.toString() : '*';

    const res = await request(resumableUri, {
      method: 'PUT',
      headers: {
        'Content-Length': '0',
        'Content-Range': `bytes */${totalStr}`,
      },
    });

    if (res.statusCode === 200 || res.statusCode === 201) {
      await res.body.dump();
      return totalBytes || 0n;
    }

    if (res.statusCode === 308) {
      const rangeHeader = res.headers['range'] as string;
      await res.body.dump();
      if (rangeHeader) {
        // Format: "bytes=0-123456"
        const match = rangeHeader.match(/bytes=0-(\d+)/);
        if (match && match[1]) {
          return BigInt(match[1]) + 1n; // Next byte to send
        }
      }
      return 0n;
    }

    const errBody = await res.body.text();
    throw new Error(`Could not query Google Drive resumable status (${res.statusCode}): ${errBody}`);
  }

  /**
   * Pauses an active transfer job.
   */
  public async pauseTransfer(transferId: string): Promise<void> {
    const job = this.activeJobs.get(transferId);
    if (job) {
      job.isPaused = true;
      job.abortController.abort();
      this.activeJobs.delete(transferId);
    }

    await prisma.transfer.update({
      where: { id: transferId },
      data: { status: 'PAUSED', speedBps: 0, etaSeconds: null },
    });

    await this.log(transferId, 'INFO', 'Transfer paused by user.');

    const transfer = await prisma.transfer.findUnique({ where: { id: transferId } });
    if (transfer) {
      this.emitProgress(transfer);
    }
  }

  /**
   * Resumes a paused transfer job.
   */
  public async resumeTransfer(transferId: string): Promise<void> {
    const transfer = await prisma.transfer.findUnique({ where: { id: transferId } });
    if (!transfer) {
      throw new Error('Transfer not found');
    }

    if (transfer.status === 'STREAMING' || transfer.status === 'CONNECTING') {
      return; // Already running
    }

    await prisma.transfer.update({
      where: { id: transferId },
      data: { status: 'QUEUED', errorMessage: null },
    });

    await this.log(transferId, 'INFO', 'Transfer resumed by user. Re-entering queue...');

    setImmediate(() => {
      this.executeTransfer(transferId).catch(async (err) => {
        await this.handleTransferFailure(transferId, err);
      });
    });
  }

  /**
   * Cancels a transfer and cleans up resources.
   */
  public async cancelTransfer(transferId: string): Promise<void> {
    const job = this.activeJobs.get(transferId);
    if (job) {
      job.abortController.abort();
      this.activeJobs.delete(transferId);
    }

    const transfer = await prisma.transfer.findUnique({ where: { id: transferId } });
    if (transfer?.resumableUri) {
      try {
        await request(transfer.resumableUri, {
          method: 'DELETE',
          headers: { 'Content-Length': '0' },
        });
      } catch {
        // Ignore errors when aborting resumable session
      }
    }

    await prisma.transfer.update({
      where: { id: transferId },
      data: { status: 'CANCELLED', speedBps: 0, etaSeconds: null },
    });

    await this.log(transferId, 'INFO', 'Transfer cancelled.');

    if (transfer) {
      this.emitProgress({
        ...transfer,
        status: 'CANCELLED',
        speedBps: 0,
        etaSeconds: null,
      });
    }
  }

  /**
   * Retries a failed or cancelled transfer.
   */
  public async retryTransfer(transferId: string): Promise<void> {
    await prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: 'QUEUED',
        errorMessage: null,
        retries: { increment: 1 },
      },
    });

    await this.log(transferId, 'INFO', 'Retrying transfer...');

    setImmediate(() => {
      this.executeTransfer(transferId).catch(async (err) => {
        await this.handleTransferFailure(transferId, err);
      });
    });
  }

  private async handleTransferFailure(transferId: string, err: any): Promise<void> {
    const message = err?.message || 'Unknown transfer error occurred';
    await prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: 'FAILED',
        errorMessage: message,
        speedBps: 0,
        etaSeconds: null,
      },
    });

    await this.log(transferId, 'ERROR', `Transfer failed: ${message}`);

    const transfer = await prisma.transfer.findUnique({ where: { id: transferId } });
    if (transfer) {
      this.emitProgress({
        ...transfer,
        status: 'FAILED',
        errorMessage: message,
        speedBps: 0,
        etaSeconds: null,
      });
    }
  }
}
