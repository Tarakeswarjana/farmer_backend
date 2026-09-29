import { Router } from 'express';
import { healthController } from '../controllers';
import { registerRoute } from '../docs/swagger/registerRoute';
import { z } from '../openapi/setup';
import { ok } from '../validators/schemas';

export const healthRouter = Router();
const healthData = z.object({
  status: z.string().openapi({ example: 'healthy' }),
  database: z.string().optional().openapi({ example: 'connected' }),
  redis: z.string().optional().openapi({ example: 'connected' }),
  timestamp: z.string(),
});

registerRoute({
  router: healthRouter,
  method: 'get',
  path: '/',
  openApiPath: '/health',
  tag: 'Health',
  summary: 'Process health',
  description: 'Reports API, database, and Redis status. A running API with a disconnected dependency returns status degraded.',
  successSchema: ok(healthData),
  handlers: [healthController.live],
});

registerRoute({
  router: healthRouter,
  method: 'get',
  path: '/database',
  openApiPath: '/health/database',
  tag: 'Health',
  summary: 'Database health',
  description: 'Returns 200 when MongoDB is connected and 503 otherwise.',
  successSchema: ok(healthData),
  errors: [503],
  handlers: [healthController.database],
});

registerRoute({
  router: healthRouter,
  method: 'get',
  path: '/redis',
  openApiPath: '/health/redis',
  tag: 'Health',
  summary: 'Redis health',
  description: 'Returns 200 when Redis answers PING and 503 otherwise.',
  successSchema: ok(healthData),
  errors: [503],
  handlers: [healthController.redis],
});
