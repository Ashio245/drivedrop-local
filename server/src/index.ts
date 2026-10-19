import { buildApp } from './app.js';
import { config } from './config.js';
import { prisma } from './lib/prisma.js';
import { EmulatorService } from './services/emulator.service.js';

async function main() {
  const app = await buildApp();

  // Initialize default platform configurations in SQLite
  try {
    await EmulatorService.getInstance().ensureDefaultPlatforms();
  } catch (err) {
    app.log.warn({ err }, 'Could not ensure default platforms on startup');
  }

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Shutting down DriveDrop Local server...`);
    try {
      await app.close();
      await prisma.$disconnect();
      app.log.info('DriveDrop Local server gracefully terminated.');
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`\n=======================================================`);
    console.log(`  🚀 DriveDrop Local Server is running!`);
    console.log(`  ➜ Local:   http://${config.host}:${config.port}`);
    console.log(`  ➜ Health:  http://${config.host}:${config.port}/api/system/health`);
    console.log(`  ➜ Database: SQLite (${config.databaseUrl})`);
    console.log(`=======================================================\n`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
