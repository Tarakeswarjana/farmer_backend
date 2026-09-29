import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { generateOpenApiDocument } from './config/swagger';
import { registerDomainListeners } from './events/registerListeners';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { globalRateLimit } from './middlewares/rateLimiter';
import { requestContext, sanitizeInput } from './middlewares/requestContext';
import { healthRouter } from './routes/health';
import { v1Router } from './routes/v1';
import { logger } from './utils/logger';

export function createApp() {
  registerDomainListeners();
  const app = express();
  if (env.isProduction) {
    app.set('trust proxy', 1);
  }
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.frontendUrl.split(',').map((value) => value.trim()),
      credentials: true,
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Idempotency-Key',
        'X-Request-Id',
        'X-Webhook-Signature',
        'X-Razorpay-Signature',
      ],
    }),
  );
  app.use(compression());
  app.use(requestContext);
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url?.startsWith('/health') ?? false },
    }),
  );
  app.use(globalRateLimit);
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buffer) => {
        (req as express.Request).rawBody = buffer;
      },
    }),
  );
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));
  app.use(sanitizeInput);
  app.use(
    '/uploads/public',
    express.static(path.join(process.cwd(), 'uploads', 'public'), { index: false, dotfiles: 'deny' }),
  );

  const spec = generateOpenApiDocument();
  app.get('/api-docs.json', (_req, res) => {
    res.json(spec);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, { swaggerOptions: { persistAuthorization: true } }));
  app.use('/health', healthRouter);
  app.use('/api/v1', v1Router);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
