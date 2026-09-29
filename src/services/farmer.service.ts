import { FARMER_ROLES } from '../constants/roles';
import { hasRole } from '../middlewares/authorize';
import { FarmerRepository } from '../repositories/profile.repository';
import { CropRepository } from '../repositories/catalog.repository';
import type { AuthUser } from '../types/auth';
import { encryptString, maskAccountNumber } from '../utils/crypto';
import { ConflictError, NotFoundError, UnprocessableError } from '../utils/errors';
import { assertRadius, toGeoPoint } from '../utils/geo';
import { buildMeta, toPageQuery } from '../utils/pagination';
import { presentFarmer } from '../utils/presenters';

interface FarmerInput {
  farmerName: string;
  farmName?: string;
  fatherName?: string;
  phone: string;
  address: string;
  village?: string;
  gramPanchayat?: string;
  block?: string;
  district: string;
  state?: string;
  pincode: string;
  location: { longitude: number; latitude: number };
  farmSize?: number;
  farmSizeUnit?: string;
  primaryCrops?: string[];
  farmingType?: string;
  bankDetails?: {
    accountHolderName: string;
    accountNumber: string;
    ifsc: string;
    bankName: string;
    branch?: string;
  };
}

export class FarmerService {
  constructor(
    private readonly farmers: FarmerRepository,
    private readonly crops: CropRepository,
  ) {}

  async create(actor: AuthUser, input: FarmerInput) {
    if (!hasRole(actor, FARMER_ROLES)) {
      throw new UnprocessableError('Only farmer accounts can create a farmer profile');
    }
    if (await this.farmers.findByUserId(actor.id)) {
      throw new ConflictError('Farmer profile already exists');
    }
    await this.assertCrops(input.primaryCrops ?? []);
    const profile = await this.farmers.create({
      ...this.toData(input),
      userId: actor.id,
      phone: input.phone,
      verificationStatus: 'PENDING',
      isVerified: false,
      rating: 0,
      ratingCount: 0,
      totalOrders: 0,
      totalSalesPaise: 0,
    });
    return presentFarmer(profile, { includePrivate: true });
  }

  async mine(actor: AuthUser) {
    const profile = await this.farmers.findByUserId(actor.id);
    if (!profile) {
      throw new NotFoundError('Farmer profile not found');
    }
    return presentFarmer(profile, { includePrivate: true });
  }

  async update(actor: AuthUser, input: Partial<FarmerInput>) {
    const profile = await this.farmers.findByUserId(actor.id);
    if (!profile) {
      throw new NotFoundError('Farmer profile not found');
    }
    if (input.primaryCrops) {
      await this.assertCrops(input.primaryCrops);
    }
    const data = this.toData(input);
    const updated = await this.farmers.updateById(String(profile._id), data);
    if (!updated) {
      throw new NotFoundError('Farmer profile not found');
    }
    return presentFarmer(updated, { includePrivate: true });
  }

  async getById(id: string, actor?: AuthUser) {
    const profile = await this.farmers.findById(id);
    if (!profile) {
      throw new NotFoundError('Farmer profile not found');
    }
    const includePrivate = Boolean(actor && (actor.id === String(profile.userId) || hasRole(actor, ['ADMIN', 'SUPER_ADMIN'])));
    return presentFarmer(profile, { includePrivate });
  }

  async nearby(query: { lat: number; lng: number; radius?: number; page?: number; limit?: number }) {
    const radius = assertRadius(query.radius ?? 20_000);
    const page = toPageQuery(query);
    const result = await this.farmers.nearby(query.lng, query.lat, radius, page.skip, page.limit);
    return {
      items: result.items.map((item) => presentFarmer(item)),
      meta: buildMeta(page.page, page.limit, result.total),
    };
  }

  async setVerification(id: string, status: 'PENDING' | 'VERIFIED' | 'REJECTED') {
    const profile = await this.farmers.findById(id);
    if (!profile) {
      throw new NotFoundError('Farmer profile not found');
    }
    profile.verificationStatus = status;
    profile.isVerified = status === 'VERIFIED';
    await profile.save();
    return presentFarmer(profile, { includePrivate: true });
  }

  private async assertCrops(ids: string[]) {
    for (const id of ids) {
      const crop = await this.crops.findById(id);
      if (!crop) {
        throw new NotFoundError('One or more crops were not found');
      }
    }
  }

  private toData(input: Partial<FarmerInput>) {
    const data: Record<string, unknown> = {};
    const fields = [
      'farmerName',
      'farmName',
      'fatherName',
      'phone',
      'address',
      'village',
      'gramPanchayat',
      'block',
      'district',
      'state',
      'pincode',
      'farmSize',
      'farmSizeUnit',
      'farmingType',
      'primaryCrops',
    ] as const;
    for (const field of fields) {
      if (input[field] !== undefined) {
        data[field] = input[field];
      }
    }
    if (input.state === undefined && input.district) {
      data.state = 'West Bengal';
    }
    if (input.location) {
      data.location = toGeoPoint(input.location.longitude, input.location.latitude);
    }
    if (input.bankDetails) {
      data.bankDetails = {
        accountHolderName: input.bankDetails.accountHolderName,
        accountNumberEncrypted: encryptString(input.bankDetails.accountNumber),
        accountNumberMasked: maskAccountNumber(input.bankDetails.accountNumber),
        ifsc: input.bankDetails.ifsc.toUpperCase(),
        bankName: input.bankDetails.bankName,
        branch: input.bankDetails.branch,
      };
    }
    return data;
  }
}
