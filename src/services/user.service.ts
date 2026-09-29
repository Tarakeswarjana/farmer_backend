import type { Role } from '../constants/enums';
import { RefreshTokenRepository, UserRepository } from '../repositories/user.repository';
import { FarmerRepository, BuyerRepository, TransporterRepository } from '../repositories/profile.repository';
import type { AuthUser } from '../types/auth';
import { AuthorizationError, BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import { hashPassword, verifyPassword } from '../utils/password';
import { normalizeEmail } from '../utils/phone';
import { presentUser } from '../utils/presenters';
import { toGeoPoint } from '../utils/geo';
import { AuthService } from './auth.service';

export class UserService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: RefreshTokenRepository,
    private readonly farmers: FarmerRepository,
    private readonly buyers: BuyerRepository,
    private readonly transporters: TransporterRepository,
    private readonly auth: AuthService,
  ) {}

  async me(actor: AuthUser) {
    const user = await this.requireUser(actor.id);
    const [farmer, buyer, transporter] = await Promise.all([
      this.farmers.findByUserId(actor.id),
      this.buyers.findByUserId(actor.id),
      this.transporters.findByUserId(actor.id),
    ]);
    return {
      ...presentUser(user),
      farmerProfileId: farmer ? String(farmer._id) : null,
      buyerProfileId: buyer ? String(buyer._id) : null,
      transporterProfileId: transporter ? String(transporter._id) : null,
    };
  }

  async updateMe(actor: AuthUser, input: { name?: string; email?: string; profileImage?: string }) {
    const user = await this.requireUser(actor.id);
    if (input.name) {
      user.name = input.name.trim();
    }
    if (input.profileImage !== undefined) {
      user.profileImage = input.profileImage;
    }
    let emailChanged = false;
    if (input.email !== undefined) {
      const email = normalizeEmail(input.email);
      if (email && email !== user.email) {
        const existing = await this.users.findByEmail(email);
        if (existing && String(existing._id) !== actor.id) {
          throw new ConflictError('Email is already registered');
        }
        user.email = email;
        user.isEmailVerified = false;
        emailChanged = true;
      }
    }
    await user.save();
    let debugCode: string | undefined;
    if (emailChanged) {
      const issued = await this.auth.sendEmailCode(actor.id);
      debugCode = 'debugCode' in issued ? issued.debugCode : undefined;
    }
    return { ...presentUser(user), ...(debugCode ? { debugCode } : {}) };
  }

  async updateLocation(
    actor: AuthUser,
    input: {
      longitude: number;
      latitude: number;
      address?: string;
      village?: string;
      district?: string;
      state?: string;
      pincode?: string;
    },
  ) {
    const user = await this.requireUser(actor.id);
    user.location = toGeoPoint(input.longitude, input.latitude);
    if (input.address !== undefined) user.address = input.address;
    if (input.village !== undefined) user.village = input.village;
    if (input.district !== undefined) user.district = input.district;
    if (input.state !== undefined) user.state = input.state;
    if (input.pincode !== undefined) user.pincode = input.pincode;
    await user.save();
    return presentUser(user);
  }

  async changePassword(actor: AuthUser, input: { currentPassword: string; newPassword: string }) {
    const user = await this.users.findForAuth({ phone: actor.phone });
    if (!user) {
      throw new NotFoundError('User not found');
    }
    const matches = await verifyPassword(input.currentPassword, user.password);
    if (!matches) {
      throw new BadRequestError('Current password is incorrect');
    }
    user.password = await hashPassword(input.newPassword);
    await user.save();
    await this.tokens.revokeAll(actor.id);
    return { changed: true };
  }

  async setBlocked(actor: AuthUser, userId: string, isBlocked: boolean, audit: (userId: string) => Promise<void>) {
    if (actor.id === userId) {
      throw new AuthorizationError('You cannot block your own account');
    }
    const user = await this.requireUser(userId);
    user.isBlocked = isBlocked;
    await user.save();
    if (isBlocked) {
      await this.tokens.revokeAll(userId);
    }
    await audit(userId);
    return presentUser(user);
  }

  async setRoles(actor: AuthUser, userId: string, roles: Role[]) {
    if (roles.includes('SUPER_ADMIN') && actor.role !== 'SUPER_ADMIN') {
      throw new AuthorizationError('Only a super admin can grant that role');
    }
    const user = await this.requireUser(userId);
    user.roles = roles;
    if (!roles.includes(user.role)) {
      user.role = roles[0];
    }
    await user.save();
    return presentUser(user);
  }

  private async requireUser(id: string) {
    const user = await this.users.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }
}
