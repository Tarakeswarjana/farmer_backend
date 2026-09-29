import type { Role } from '../constants/enums';

export interface AuthUser {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: Role;
  roles: Role[];
  isActive: boolean;
  isBlocked: boolean;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
}

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  roles: Role[];
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}
