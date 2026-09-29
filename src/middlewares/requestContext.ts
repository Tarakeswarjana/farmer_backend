import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { stripOperatorKeys } from '../utils/sanitize';

export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && incoming.length < 80 ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = stripOperatorKeys(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    Object.assign(req.query, stripOperatorKeys({ ...req.query }));
    for (const key of Object.keys(req.query)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete req.query[key];
      }
    }
  }
  next();
}
