import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { runMaintenance } from './maintenance';

let worker: Worker | undefined;
let timer: NodeJS.Timeout | undefined;

function connection(): ConnectionOptions {
  const url = new URL(env.redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    maxRetriesPerRequest: null,
  };
}

export async function startJobs(): Promise<void> {
  if (env.isTest) return;
  if (env.redisUrl) {
    const queue = new Queue('marketplace-jobs', { connection: connection() });
    await queue.upsertJobScheduler('maintenance', { every: 5 * 60 * 1000 }, { name: 'maintenance', data: {} });
    worker = new Worker(
      'marketplace-jobs',
      async () => {
        await runMaintenance();
      },
      { connection: connection() },
    );
    worker.on('failed', (job, error) => {
      logger.error({ event: 'JOB_FAILED', job: job?.name, message: error.message });
    });
    logger.info({ event: 'JOBS_STARTED', driver: 'bullmq' });
    return;
  }
  timer = setInterval(() => {
    void runMaintenance().catch((error: Error) => {
      logger.error({ event: 'JOB_FAILED', message: error.message });
    });
  }, 5 * 60 * 1000);
  timer.unref();
  logger.info({ event: 'JOBS_STARTED', driver: 'interval' });
}

export async function stopJobs(): Promise<void> {
  if (timer) clearInterval(timer);
  if (worker) await worker.close();
}
