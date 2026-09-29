import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { Role } from '../constants/enums';
import type { AccessTokenPayload, RefreshTokenPayload } from '../types/auth';
import { AuthenticationError } from './errors';

export function signAccessToken(user: { id: string; role: Role; roles: Role[] }): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    role: user.role,
    roles: user.roles,
    type: 'access',
  };
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(userId: string, jti: string): string {
  const payload: RefreshTokenPayload = { sub: userId, jti, type: 'refresh' };
  return jwt.sign(payload, env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = jwt.verify(token, env.jwt.refreshSecret);
    if (!decoded || typeof decoded !== 'object') {
      throw new AuthenticationError('Invalid refresh token');
    }
    const payload = decoded as Partial<RefreshTokenPayload>;
    if (payload.type !== 'refresh' || !payload.sub || !payload.jti) {
      throw new AuthenticationError('Invalid refresh token');
    }
    return { sub: payload.sub, jti: payload.jti, type: 'refresh' };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Invalid or expired refresh token');
  }
}

export function newJti(): string {
  return crypto.randomUUID();
}

export function durationToMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * multipliers[unit];
}

export function expiryFromDuration(value: string): Date {
  return new Date(Date.now() + durationToMs(value));
}
