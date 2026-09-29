import type { Request } from 'express';
import type { RequestMeta } from '../types/common';

export function sameId(left: unknown, right: unknown): boolean {
  if (left == null || right == null) {
    return false;
  }
  return String(left) === String(right);
}

export function requestMeta(req: Request): RequestMeta {
  return {
    ipAddress: req.ip,
    userAgent: req.get('user-agent')?.slice(0, 300),
  };
}

export function startOfTodayInKolkata(now = new Date()): Date {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return new Date(`${date}T00:00:00+05:30`);
}

export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
