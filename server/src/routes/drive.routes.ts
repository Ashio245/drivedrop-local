import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GoogleDriveService } from '../services/google-drive.service.js';

export async function driveRoutes(app: FastifyInstance) {
  const driveService = GoogleDriveService.getInstance();

  // Storage Quota
  app.get('/about', async (req, reply) => {
    try {
      return await driveService.getAbout();
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // List files/folders
  app.get('/files', async (req, reply) => {
    const { folderId, pageToken, q, orderBy, onlyFolders } = req.query as {
      folderId?: string;
      pageToken?: string;
      q?: string;
      orderBy?: string;
      onlyFolders?: string;
    };

    try {
      return await driveService.listFiles({
        folderId,
        pageToken,
        q,
        orderBy,
        onlyFolders: onlyFolders === 'true',
      });
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Create folder
  app.post('/folders', async (req, reply) => {
    const schema = z.object({
      name: z.string().min(1, 'Folder name is required'),
      parentId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    try {
      const folder = await driveService.createFolder(parsed.data.name, parsed.data.parentId);
      return folder;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Rename or Move file
  app.patch('/files/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      name: z.string().optional(),
      targetFolderId: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    try {
      let updatedFile;
      if (parsed.data.name) {
        updatedFile = await driveService.renameFile(id, parsed.data.name);
      }
      if (parsed.data.targetFolderId) {
        updatedFile = await driveService.moveFile(id, parsed.data.targetFolderId);
      }
      return updatedFile || { success: true };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Delete / Trash file
  app.delete('/files/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { permanent } = req.query as { permanent?: string };

    try {
      await driveService.deleteFile(id, permanent === 'true');
      return { success: true };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Extract ZIP or RAR archive in Google Drive
  app.post('/extract', async (req, reply) => {
    const schema = z.object({
      fileId: z.string().min(1, 'fileId is required'),
      targetFolderId: z.string().optional(),
      password: z.string().optional(),
      deleteArchiveAfter: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    try {
      const extractorService = (await import('../services/archive-extractor.service.js')).ArchiveExtractorService.getInstance();
      const result = await extractorService.extractArchive(parsed.data);
      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // SSE progress stream for active extractions
  app.get('/extract/events', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders();

    reply.raw.write(': connected\n\n');

    const extractorService = (await import('../services/archive-extractor.service.js')).ArchiveExtractorService.getInstance();
    const onProgress = (event: any) => {
      reply.raw.write(`event: extract_progress\ndata: ${JSON.stringify(event)}\n\n`);
    };

    extractorService.on('progress', onProgress);

    const heartbeat = setInterval(() => {
      reply.raw.write(': ping\n\n');
    }, 15000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      extractorService.off('progress', onProgress);
    });
  });
}
