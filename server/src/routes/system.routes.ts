import { FastifyInstance } from 'fastify';
import os from 'os';

export async function systemRoutes(app: FastifyInstance) {
  app.get('/health', async () => {
    const memory = process.memoryUsage();
    return {
      status: 'healthy',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      memory: {
        rssMb: Math.round(memory.rss / (1024 * 1024)),
        heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024)),
      },
    };
  });

  app.get('/info', async () => {
    return {
      appName: 'DriveDrop Local',
      version: '1.0.0',
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      totalMemMb: Math.round(os.totalmem() / (1024 * 1024)),
      freeMemMb: Math.round(os.freemem() / (1024 * 1024)),
      disclaimers: {
        zeroDiskUsage: 'DriveDrop Local pipes HTTP streams straight into Google Drive resumable upload sessions. Temporary RAM buffer is bounded (~8MB).',
        googleDriveDailyLimit: 'Google Drive enforces a daily 750 GB upload limit across all API and web uploads per user account.',
        resumableExpiry: 'Google Drive resumable upload sessions expire after approximately 7 days of inactivity.',
        legalNotice: 'Emulator integration is solely intended for organizing legally owned backups, homebrew, and public domain games. DriveDrop Local does not supply, download, or index copyright-infringing content.',
      },
    };
  });
}
