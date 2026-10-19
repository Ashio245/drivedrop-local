import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { StreamManagerService, TransferEvent } from '../services/stream-manager.service.js';

export async function transferRoutes(app: FastifyInstance) {
  const streamManager = StreamManagerService.getInstance();

  // Create new transfer
  app.post('/', async (req, reply) => {
    const schema = z.object({
      url: z.string().url('A valid HTTP or HTTPS URL is required'),
      customFilename: z.string().optional(),
      folderId: z.string().optional(),
      customHeaders: z.record(z.string()).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    try {
      const result = await streamManager.createTransfer(parsed.data);
      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // List transfers
  app.get('/', async (req) => {
    const { status } = req.query as { status?: string };

    const where: any = {};
    if (status && status !== 'ALL') {
      if (status === 'ACTIVE') {
        where.status = { in: ['QUEUED', 'CONNECTING', 'STREAMING'] };
      } else {
        where.status = status;
      }
    }

    const transfers = await prisma.transfer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        _count: {
          select: { logs: true },
        },
      },
    });

    return { transfers };
  });

  // Get transfer details & logs
  app.get('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const transfer = await prisma.transfer.findUnique({
      where: { id },
      include: {
        logs: {
          orderBy: { timestamp: 'desc' },
          take: 50,
        },
      },
    });

    if (!transfer) {
      return reply.status(404).send({ error: 'Transfer not found' });
    }

    return transfer;
  });

  // Pause
  app.post('/:id/pause', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await streamManager.pauseTransfer(id);
      return { success: true, message: 'Transfer paused' };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Resume
  app.post('/:id/resume', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await streamManager.resumeTransfer(id);
      return { success: true, message: 'Transfer resumed' };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Cancel
  app.post('/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await streamManager.cancelTransfer(id);
      return { success: true, message: 'Transfer cancelled' };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Retry
  app.post('/:id/retry', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await streamManager.retryTransfer(id);
      return { success: true, message: 'Transfer scheduled for retry' };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Delete
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await streamManager.cancelTransfer(id);
      await prisma.transfer.delete({ where: { id } });
      return { success: true };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Server-Sent Events (SSE) stream for real-time telemetry
  app.get('/events', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');
    reply.raw.flushHeaders();

    // Send initial handshake comment
    reply.raw.write(': connected\n\n');

    const onProgress = (event: TransferEvent) => {
      reply.raw.write(`event: progress\ndata: ${JSON.stringify(event)}\n\n`);
    };

    streamManager.on('progress', onProgress);

    // Keep connection alive with heartbeat comment every 15s
    const heartbeat = setInterval(() => {
      reply.raw.write(': ping\n\n');
    }, 15000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      streamManager.off('progress', onProgress);
    });
  });
}
