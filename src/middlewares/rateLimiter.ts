import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import type { RedisReply } from 'rate-limit-redis';
import { getRedis } from '../config/redis';

function sendRateLimited(_req: unknown, res: { status(code: number): { json(body: unknown): void } }): void {
  res.status(429).json({
    success: false,
    message: 'Too many requests. Please try again later.',
    error: { code: 'RATE_LIMITED', details: [] },
  });
}

function store() {
  const redis = getRedis();
  if (!redis) {
    return undefined;
  }
  return new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<RedisReply>,
  });
}

const relaxed = process.env.NODE_ENV === 'test';

export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: relaxed ? 10_000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path.startsWith('/health'),
  handler: sendRateLimited,
  store: store(),
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: relaxed ? 10_000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendRateLimited,
  store: store(),
});

export const sensitiveAuthRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: relaxed ? 10_000 : 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: sendRateLimited,
  store: store(),
});
