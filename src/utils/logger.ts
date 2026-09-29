import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: env.logLevel,
  redact: {
    paths: [
      'password',
      '*.password',
      'req.headers.authorization',
      'headers.authorization',
      'accessToken',
      '*.accessToken',
      'refreshToken',
      '*.refreshToken',
      'otp',
      '*.otp',
      'debugCode',
      '*.debugCode',
      'bankDetails',
      '*.bankDetails',
      'accountNumber',
      '*.accountNumber',
      'accountNumberEncrypted',
      '*.accountNumberEncrypted',
      'ifsc',
      '*.ifsc',
      'authorization',
      '*.authorization',
      'signature',
      '*.signature',
      'JWT',
      'token',
      '*.token',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.isDevelopment && !env.isTest
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});
