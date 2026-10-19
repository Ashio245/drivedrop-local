import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.routes.js';
import { transferRoutes } from './routes/transfer.routes.js';
import { driveRoutes } from './routes/drive.routes.js';
import { libraryRoutes } from './routes/library.routes.js';
import { settingsRoutes } from './routes/settings.routes.js';
import { systemRoutes } from './routes/system.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = fastify({
    logger: {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
    bodyLimit: 10 * 1024 * 1024, // 10MB JSON body limit for configs/metadata
  });

  // Enable CORS for local client
  await app.register(cors, {
    origin: [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  // Register API modules
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(transferRoutes, { prefix: '/api/transfers' });
  await app.register(driveRoutes, { prefix: '/api/drive' });
  await app.register(libraryRoutes, { prefix: '/api/library' });
  await app.register(settingsRoutes, { prefix: '/api/settings' });
  await app.register(systemRoutes, { prefix: '/api/system' });

  // Root health check
  app.get('/', async () => {
    return {
      service: 'DriveDrop Local Backend',
      status: 'online',
      version: '1.0.0',
      documentation: '/context/prd.md',
    };
  });

  // Global Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode || 500;
    reply.status(statusCode).send({
      error: error.message || 'Internal Server Error',
      statusCode,
    });
  });

  return app;
}
