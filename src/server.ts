import { createApp } from './app';
import { connectDatabase, disconnectDatabase } from './config/database';
import { env } from './config/env';
import { connectRedis, disconnectRedis } from './config/redis';
import { startJobs, stopJobs } from './jobs';
import { logger } from './utils/logger';

async function main() {
  await connectDatabase();
  await connectRedis();
  await startJobs();
  const app = createApp();
  const server = app.listen(env.port, () => {
    logger.info({ event: 'SERVER_STARTED', port: env.port });
  });

  const shutdown = async (signal: string) => {
    logger.info({ event: 'SERVER_STOPPING', signal });
    server.close(async () => {
      await stopJobs();
      await disconnectRedis();
      await disconnectDatabase();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

main().catch((error: Error) => {
  logger.error({ event: 'SERVER_START_FAILED', message: error.message });
  process.exit(1);
});
