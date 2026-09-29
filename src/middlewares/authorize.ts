import type { NextFunction, Request, Response } from 'express';
import type { Role } from '../constants/enums';
import { AuthenticationError, AuthorizationError } from '../utils/errors';

export function authorize(...roles: readonly Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthenticationError());
      return;
    }
    if (req.user.role === 'SUPER_ADMIN' || req.user.roles.includes('SUPER_ADMIN')) {
      next();
      return;
    }
    const allowed = roles.some((role) => req.user?.role === role || req.user?.roles.includes(role));
    if (!allowed) {
      next(new AuthorizationError());
      return;
    }
    next();
  };
}

export function hasRole(user: { role: Role; roles: Role[] }, roles: readonly Role[]): boolean {
  if (user.role === 'SUPER_ADMIN' || user.roles.includes('SUPER_ADMIN')) {
    return true;
  }
  return roles.some((role) => user.role === role || user.roles.includes(role));
}
