import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { SettingsService } from '../services/settings.service.js';

export async function settingsRoutes(app: FastifyInstance) {
  const settingsService = SettingsService.getInstance();

  app.get('/', async () => {
    return await settingsService.getSettings();
  });

  app.put('/', async (req, reply) => {
    const schema = z.record(z.string());
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Settings payload must be a key-value object of strings' });
    }

    await settingsService.updateSettings(parsed.data);
    return { success: true, message: 'Settings saved successfully' };
  });
}
