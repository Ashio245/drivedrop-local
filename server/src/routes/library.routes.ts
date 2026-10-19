import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { EmulatorService, SUPPORTED_PLATFORMS } from '../services/emulator.service.js';

export async function libraryRoutes(app: FastifyInstance) {
  const emulatorService = EmulatorService.getInstance();
  await emulatorService.ensureDefaultPlatforms();

  // List library items
  app.get('/', async (req) => {
    const { platform, search } = req.query as { platform?: string; search?: string };

    const where: any = {};
    if (platform && platform !== 'ALL') {
      where.platform = platform;
    }
    if (search) {
      where.title = { contains: search };
    }

    const items = await prisma.libraryItem.findMany({
      where,
      orderBy: { title: 'asc' },
    });

    return { items };
  });

  // Classify a game/backup item
  app.post('/', async (req, reply) => {
    const schema = z.object({
      title: z.string().min(1, 'Title is required'),
      platform: z.string().min(1, 'Platform is required'),
      region: z.string().optional(),
      version: z.string().optional(),
      fileType: z.string().optional(),
      driveFileId: z.string().optional(),
      drivePath: z.string().optional(),
      localPath: z.string().optional(),
      artworkUrl: z.string().optional(),
      tags: z.string().optional(),
      notes: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const item = await prisma.libraryItem.create({
      data: parsed.data,
    });

    return item;
  });

  // Update item
  app.patch('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      title: z.string().optional(),
      platform: z.string().optional(),
      region: z.string().optional(),
      version: z.string().optional(),
      fileType: z.string().optional(),
      drivePath: z.string().optional(),
      localPath: z.string().optional(),
      artworkUrl: z.string().optional(),
      tags: z.string().optional(),
      notes: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const updated = await prisma.libraryItem.update({
      where: { id },
      data: parsed.data,
    });

    return updated;
  });

  // Delete item
  app.delete('/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await prisma.libraryItem.delete({ where: { id } });
      return { success: true };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Launch item with configured emulator
  app.post('/:id/launch', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const result = await emulatorService.launchGame(id);
      return result;
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // List platforms and their emulator configs
  app.get('/platforms', async () => {
    const configs = await prisma.emulatorConfig.findMany();
    const map = new Map(configs.map(c => [c.id, c]));

    const platforms = SUPPORTED_PLATFORMS.map(p => {
      const c = map.get(p.id);
      return {
        id: p.id,
        name: p.name,
        fileExtensions: p.fileExtensions,
        defaultExecutable: p.defaultExecutable,
        executablePath: c?.executablePath || '',
        defaultArgs: c?.defaultArgs || '',
        isEnabled: c ? c.isEnabled : true,
      };
    });

    return { platforms };
  });

  // Update emulator path/args for platform
  app.put('/platforms/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      executablePath: z.string().optional(),
      defaultArgs: z.string().optional(),
      isEnabled: z.boolean().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    const platform = SUPPORTED_PLATFORMS.find(p => p.id === id);
    const platformName = platform?.name || id;

    const updated = await prisma.emulatorConfig.upsert({
      where: { id },
      create: {
        id,
        platformName,
        executablePath: parsed.data.executablePath || '',
        defaultArgs: parsed.data.defaultArgs || '',
        isEnabled: parsed.data.isEnabled ?? true,
      },
      update: {
        executablePath: parsed.data.executablePath,
        defaultArgs: parsed.data.defaultArgs,
        isEnabled: parsed.data.isEnabled,
      },
    });

    return updated;
  });
}
