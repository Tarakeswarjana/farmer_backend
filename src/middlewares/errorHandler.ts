import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

interface MongoDuplicateError {
  code: number;
  keyPattern?: Record<string, number>;
}

function isDuplicate(error: unknown): error is MongoDuplicateError {
  return Boolean(error && typeof error === 'object' && (error as MongoDuplicateError).code === 11000);
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    error: { code: 'NOT_FOUND', details: [] },
  });
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    const detail = error.issues.find((issue) => issue.message && issue.message !== 'Validation failed')?.message;
    res.status(400).json({
      success: false,
      message: detail || 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      error: { code: error.code, details: error.details },
    });
    return;
  }

  if (isDuplicate(error)) {
    res.status(409).json({
      success: false,
      message: 'A record with the same unique value already exists',
      error: { code: 'CONFLICT', details: [] },
    });
    return;
  }

  const named = error as { name?: string; message?: string };
  if (named.name === 'CastError') {
    res.status(400).json({
      success: false,
      message: 'Invalid identifier',
      error: { code: 'BAD_REQUEST', details: [] },
    });
    return;
  }

  logger.error({
    event: 'UNHANDLED_ERROR',
    requestId: req.requestId,
    name: named.name,
    message: named.message,
    path: req.originalUrl,
  });

  res.status(500).json({
    success: false,
    message: env.isProduction ? 'Internal server error' : named.message || 'Internal server error',
    error: { code: 'INTERNAL_ERROR', details: [] },
  });
}
