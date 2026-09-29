import type { Response } from 'express';
import type { PaginationMeta } from '../types/common';

export function sendSuccess<T>(
  res: Response,
  options: { statusCode?: number; message: string; data: T; meta?: PaginationMeta | null },
): Response {
  return res.status(options.statusCode ?? 200).json({
    success: true,
    message: options.message,
    data: options.data,
    meta: options.meta ?? null,
  });
}
