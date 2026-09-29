import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserModel } from '../models/user.model';
import type { AccessTokenPayload, AuthUser } from '../types/auth';
import { AuthenticationError } from '../utils/errors';

function isAccessPayload(payload: unknown): payload is AccessTokenPayload {
  if (!payload || typeof payload !== 'object') {
    return false;
  }
  const value = payload as Partial<AccessTokenPayload>;
  return value.type === 'access' && typeof value.sub === 'string' && typeof value.role === 'string';
}

export function toAuthUser(user: {
  _id: { toString(): string };
  name: string;
  phone: string;
  email?: string | null;
  role: AuthUser['role'];
  roles: AuthUser['roles'];
  isActive: boolean;
  isBlocked: boolean;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
}): AuthUser {
  return {
    id: user._id.toString(),
    name: user.name,
    phone: user.phone,
    email: user.email ?? undefined,
    role: user.role,
    roles: user.roles,
    isActive: user.isActive,
    isBlocked: user.isBlocked,
    isPhoneVerified: user.isPhoneVerified,
    isEmailVerified: user.isEmailVerified,
  };
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      throw new AuthenticationError();
    }
    const token = header.slice('Bearer '.length).trim();
    const decoded = jwt.verify(token, env.jwt.accessSecret);
    if (!isAccessPayload(decoded)) {
      throw new AuthenticationError('Invalid access token');
    }
    const user = await UserModel.findById(decoded.sub);
    if (!user || !user.isActive || user.isBlocked) {
      throw new AuthenticationError('Account is inactive or blocked');
    }
    req.user = toAuthUser(user);
    next();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      next(error);
      return;
    }
    next(new AuthenticationError('Invalid or expired access token'));
  }
}
