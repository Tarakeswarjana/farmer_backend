import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

let client: Redis | null = null;
let ready = false;

export async function connectRedis(): Promise<void> {
  if (!env.redisUrl || env.isTest) {
    ready = false;
    return;
  }
  const redis = new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableReadyCheck: true,
  });
  try {
    await redis.connect();
    client = redis;
    ready = true;
    logger.info({ event: 'REDIS_CONNECTED' });
  } catch {
    ready = false;
    redis.disconnect();
    logger.warn({ event: 'REDIS_UNAVAILABLE' });
  }
}

export function getRedis(): Redis | null {
  return ready ? client : null;
}

export function isRedisReady(): boolean {
  return ready && client !== null;
}

export async function pingRedis(): Promise<boolean> {
  if (!client || !ready) {
    return false;
  }
  try {
    return (await client.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  if (!client || !ready) {
    return null;
  }
  return client.get(key);
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  if (!client || !ready) {
    return;
  }
  await client.set(key, value, 'EX', ttlSeconds);
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    ready = false;
  }
}
