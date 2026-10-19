import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { GoogleAuthService } from '../services/google-auth.service.js';

export async function authRoutes(app: FastifyInstance) {
  const authService = GoogleAuthService.getInstance();

  // Status check
  app.get('/status', async () => {
    return await authService.getStatus();
  });

  // Save OAuth credentials
  app.post('/configure-oauth', async (req, reply) => {
    const schema = z.object({
      clientId: z.string().min(1, 'Client ID is required'),
      clientSecret: z.string().min(1, 'Client Secret is required'),
      redirectUri: z.string().optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    await authService.saveOAuthConfig(parsed.data);
    return { success: true, message: 'Google OAuth credentials saved securely.' };
  });

  // Generate OAuth consent URL
  app.get('/login-url', async (req, reply) => {
    try {
      const { fullScope } = req.query as { fullScope?: string };
      const url = await authService.generateAuthUrl(fullScope === 'true');
      return { url };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Handle OAuth callback (GET via browser redirect or POST via client exchange)
  app.get('/callback', async (req, reply) => {
    const { code, error } = req.query as { code?: string; error?: string };

    if (error) {
      return reply.type('text/html').send(`
        <html>
          <body style="font-family: sans-serif; background: #09090b; color: #f43f5e; padding: 40px; text-align: center;">
            <h2>Google Authentication Cancelled or Failed</h2>
            <p>${error}</p>
            <p><a href="/" style="color: #38bdf8;">Return to DriveDrop Local</a></p>
          </body>
        </html>
      `);
    }

    if (!code) {
      return reply.status(400).send({ error: 'Missing code parameter' });
    }

    try {
      await authService.handleCallback(code);
      // Redirect back to app
      return reply.redirect('/?auth=success');
    } catch (err: any) {
      return reply.type('text/html').send(`
        <html>
          <body style="font-family: sans-serif; background: #09090b; color: #f43f5e; padding: 40px; text-align: center;">
            <h2>Authentication Error</h2>
            <p>${err.message}</p>
            <p><a href="/" style="color: #38bdf8;">Return to DriveDrop Local</a></p>
          </body>
        </html>
      `);
    }
  });

  app.post('/callback', async (req, reply) => {
    const schema = z.object({
      code: z.string().min(1, 'Authorization code is required'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.errors[0].message });
    }

    try {
      const user = await authService.handleCallback(parsed.data.code);
      return { success: true, user };
    } catch (err: any) {
      return reply.status(400).send({ error: err.message });
    }
  });

  // Disconnect and revoke token
  app.post('/disconnect', async () => {
    await authService.disconnect();
    return { success: true, message: 'Google account disconnected and tokens revoked.' };
  });
}
