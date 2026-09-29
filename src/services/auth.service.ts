import { env } from '../config/env';
import { OTP_TTL_MS, type SelfRegisterRole } from '../constants/enums';
import { OtpRepository, RefreshTokenRepository, UserRepository } from '../repositories/user.repository';
import type { AuthUser } from '../types/auth';
import type { RequestMeta } from '../types/common';
import { hashValue, randomOtp } from '../utils/crypto';
import {
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  ConflictError,
} from '../utils/errors';
import { logger } from '../utils/logger';
import { hashPassword, verifyPassword } from '../utils/password';
import { normalizeEmail, normalizePhone } from '../utils/phone';
import { presentUser } from '../utils/presenters';
import { expiryFromDuration, newJti, signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/tokens';
import { AuditService } from './audit.service';

interface RegisterInput {
  name: string;
  phone: string;
  email?: string;
  password: string;
  role: SelfRegisterRole;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: RefreshTokenRepository,
    private readonly otps: OtpRepository,
    private readonly audit: AuditService,
  ) {}

  async register(input: RegisterInput) {
    const phone = normalizePhone(input.phone);
    const email = normalizeEmail(input.email);
    if (await this.users.findByPhone(phone)) {
      throw new ConflictError('Phone number is already registered');
    }
    if (email && (await this.users.findByEmail(email))) {
      throw new ConflictError('Email is already registered');
    }
    const user = await this.users.create({
      name: input.name.trim(),
      phone,
      email,
      password: await hashPassword(input.password),
      role: input.role,
      roles: [input.role],
      isPhoneVerified: false,
      isEmailVerified: false,
      isActive: true,
      isBlocked: false,
    });
    const debugCode = await this.issueOtp(String(user._id), 'PHONE_VERIFY');
    logger.info({ event: 'USER_REGISTERED', userId: String(user._id), role: input.role });
    return {
      user: presentUser(user),
      ...(debugCode ? { debugCode } : {}),
    };
  }

  async login(input: { identifier: string; password: string }, meta: RequestMeta) {
    const identifier = input.identifier.trim();
    const user = identifier.includes('@')
      ? await this.users.findForAuth({ email: normalizeEmail(identifier) })
      : await this.users.findForAuth({ phone: normalizePhone(identifier) });
    const matches = user ? await verifyPassword(input.password, user.password) : false;
    if (!user || !matches) {
      throw new AuthenticationError('Invalid phone/email or password');
    }
    if (user.isBlocked) {
      throw new AuthorizationError('Account is blocked');
    }
    if (!user.isActive) {
      throw new AuthorizationError('Account is inactive');
    }
    user.lastLoginAt = new Date();
    await user.save();
    const tokens = await this.issueTokens(user, meta);
    await this.audit.record({
      userId: String(user._id),
      action: 'LOGIN',
      entity: 'User',
      entityId: String(user._id),
      meta,
    });
    logger.info({ event: 'USER_LOGIN', userId: String(user._id) });
    return { user: presentUser(user), ...tokens };
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    const payload = verifyRefreshToken(refreshToken);
    const stored = await this.tokens.findByJti(payload.jti);
    if (!stored || String(stored.userId) !== payload.sub) {
      throw new AuthenticationError('Invalid refresh token');
    }
    if (stored.revokedAt || stored.expiresAt < new Date()) {
      await this.tokens.revokeAll(payload.sub);
      throw new AuthenticationError('Refresh token is no longer valid');
    }
    const user = await this.users.findById(payload.sub);
    if (!user || user.isBlocked || !user.isActive) {
      throw new AuthenticationError('Account is inactive or blocked');
    }
    const jti = newJti();
    const rotated = await this.tokens.revoke(payload.jti, jti);
    if (!rotated) {
      await this.tokens.revokeAll(payload.sub);
      throw new AuthenticationError('Refresh token reuse detected');
    }
    await this.tokens.create({
      userId: user._id,
      jti,
      expiresAt: expiryFromDuration(env.jwt.refreshExpiresIn),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return {
      user: presentUser(user),
      accessToken: signAccessToken({ id: String(user._id), role: user.role, roles: user.roles }),
      refreshToken: signRefreshToken(String(user._id), jti),
    };
  }

  async logout(actor: AuthUser, refreshToken: string) {
    const payload = verifyRefreshToken(refreshToken);
    if (payload.sub !== actor.id) {
      throw new AuthorizationError('Refresh token does not belong to this account');
    }
    await this.tokens.revoke(payload.jti);
    return { loggedOut: true };
  }

  async forgotPassword(input: { identifier: string }) {
    const identifier = input.identifier.trim();
    const user = identifier.includes('@')
      ? await this.users.findByEmail(normalizeEmail(identifier) ?? '')
      : await this.users.findByPhone(safePhone(identifier));
    let debugCode: string | undefined;
    if (user) {
      debugCode = await this.issueOtp(String(user._id), 'PASSWORD_RESET');
    }
    return {
      message: 'If the account exists, a reset code has been sent',
      ...(debugCode ? { debugCode } : {}),
    };
  }

  async resetPassword(input: { identifier: string; code: string; newPassword: string }) {
    const user = await this.findByIdentifier(input.identifier);
    if (!user) {
      throw new BadRequestError('Invalid or expired code');
    }
    await this.consumeOtp(String(user._id), 'PASSWORD_RESET', input.code);
    user.password = await hashPassword(input.newPassword);
    await user.save();
    await this.tokens.revokeAll(String(user._id));
    return { reset: true };
  }

  async verifyPhone(input: { phone: string; code: string }) {
    const user = await this.users.findByPhone(normalizePhone(input.phone));
    if (!user) {
      throw new BadRequestError('Invalid or expired code');
    }
    await this.consumeOtp(String(user._id), 'PHONE_VERIFY', input.code);
    user.isPhoneVerified = true;
    await user.save();
    return presentUser(user);
  }

  async verifyEmail(input: { email: string; code: string }) {
    const email = normalizeEmail(input.email);
    const user = email ? await this.users.findByEmail(email) : null;
    if (!user) {
      throw new BadRequestError('Invalid or expired code');
    }
    await this.consumeOtp(String(user._id), 'EMAIL_VERIFY', input.code);
    user.isEmailVerified = true;
    await user.save();
    return presentUser(user);
  }

  async sendEmailCode(userId: string) {
    const user = await this.users.findById(userId);
    if (!user?.email) {
      throw new BadRequestError('Add an email address before verification');
    }
    const debugCode = await this.issueOtp(String(user._id), 'EMAIL_VERIFY');
    return debugCode ? { debugCode } : { sent: true };
  }

  private async findByIdentifier(identifier: string) {
    if (identifier.includes('@')) {
      return this.users.findByEmail(normalizeEmail(identifier) ?? '');
    }
    return this.users.findByPhone(safePhone(identifier));
  }

  private async issueTokens(
    user: { _id: unknown; role: AuthUser['role']; roles: AuthUser['roles'] },
    meta: RequestMeta,
  ) {
    const jti = newJti();
    await this.tokens.create({
      userId: user._id,
      jti,
      expiresAt: expiryFromDuration(env.jwt.refreshExpiresIn),
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    return {
      accessToken: signAccessToken({ id: String(user._id), role: user.role, roles: user.roles }),
      refreshToken: signRefreshToken(String(user._id), jti),
    };
  }

  private async issueOtp(userId: string, purpose: 'PHONE_VERIFY' | 'EMAIL_VERIFY' | 'PASSWORD_RESET') {
    const code = randomOtp();
    await this.otps.issue(userId, purpose, hashValue(code), new Date(Date.now() + OTP_TTL_MS));
    logger.info({ event: 'OTP_DISPATCHED', purpose, userId });
    return env.isProduction ? undefined : code;
  }

  private async consumeOtp(userId: string, purpose: 'PHONE_VERIFY' | 'EMAIL_VERIFY' | 'PASSWORD_RESET', code: string) {
    const otp = await this.otps.findActive(userId, purpose);
    if (!otp) {
      throw new BadRequestError('Invalid or expired code');
    }
    if ((otp.attempts ?? 0) >= 5) {
      throw new BadRequestError('Too many invalid attempts');
    }
    if (otp.codeHash !== hashValue(code)) {
      await this.otps.incrementAttempts(String(otp._id));
      throw new BadRequestError('Invalid or expired code');
    }
    await this.otps.consume(String(otp._id));
  }
}

function safePhone(identifier: string): string {
  try {
    return normalizePhone(identifier);
  } catch {
    return identifier;
  }
}
