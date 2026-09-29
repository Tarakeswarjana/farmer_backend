import { BUYER_ROLES } from '../constants/roles';
import { hasRole } from '../middlewares/authorize';
import { BuyerRepository } from '../repositories/profile.repository';
import { CropRepository, MarketRepository } from '../repositories/catalog.repository';
import type { AuthUser } from '../types/auth';
import { ConflictError, NotFoundError, UnprocessableError } from '../utils/errors';
import { assertRadius, toGeoPoint } from '../utils/geo';
import { buildMeta, toPageQuery } from '../utils/pagination';
import { presentBuyer } from '../utils/presenters';

interface BuyerInput {
  businessName: string;
  businessType: string;
  ownerName: string;
  phone: string;
  email?: string;
  gstNumber?: string;
  address: string;
  village?: string;
  block?: string;
  district: string;
  state?: string;
  pincode?: string;
  markets?: string[];
  preferredCrops?: string[];
  buyingCapacity?: number;
  paymentTerms?: string;
  location: { longitude: number; latitude: number };
}

export class BuyerService {
  constructor(
    private readonly buyers: BuyerRepository,
    private readonly crops: CropRepository,
    private readonly markets: MarketRepository,
  ) {}

  async create(actor: AuthUser, input: BuyerInput) {
    if (!hasRole(actor, BUYER_ROLES)) {
      throw new UnprocessableError('Only buyer accounts can create a buyer profile');
    }
    if (await this.buyers.findByUserId(actor.id)) {
      throw new ConflictError('Buyer profile already exists');
    }
    await this.assertRefs(input.preferredCrops ?? [], input.markets ?? []);
    const profile = await this.buyers.create({
      ...this.toData(input),
      userId: actor.id,
      verificationStatus: 'PENDING',
      isVerified: false,
      rating: 0,
      ratingCount: 0,
    });
    return presentBuyer(profile, { includePrivate: true });
  }

  async mine(actor: AuthUser) {
    const profile = await this.buyers.findByUserId(actor.id);
    if (!profile) {
      throw new NotFoundError('Buyer profile not found');
    }
    return presentBuyer(profile, { includePrivate: true });
  }

  async update(actor: AuthUser, input: Partial<BuyerInput>) {
    const profile = await this.buyers.findByUserId(actor.id);
    if (!profile) {
      throw new NotFoundError('Buyer profile not found');
    }
    await this.assertRefs(input.preferredCrops ?? [], input.markets ?? []);
    const updated = await this.buyers.updateById(String(profile._id), this.toData(input));
    if (!updated) {
      throw new NotFoundError('Buyer profile not found');
    }
    return presentBuyer(updated, { includePrivate: true });
  }

  async getById(id: string, actor?: AuthUser) {
    const profile = await this.buyers.findById(id);
    if (!profile) {
      throw new NotFoundError('Buyer profile not found');
    }
    const includePrivate = Boolean(actor && (actor.id === String(profile.userId) || hasRole(actor, ['ADMIN', 'SUPER_ADMIN'])));
    return presentBuyer(profile, { includePrivate });
  }

  async nearby(query: { lat: number; lng: number; radius?: number; page?: number; limit?: number }) {
    const radius = assertRadius(query.radius ?? 20_000);
    const page = toPageQuery(query);
    const result = await this.buyers.nearby(query.lng, query.lat, radius, page.skip, page.limit);
    return {
      items: result.items.map((item) => presentBuyer(item)),
      meta: buildMeta(page.page, page.limit, result.total),
    };
  }

  async setVerification(id: string, status: 'PENDING' | 'VERIFIED' | 'REJECTED') {
    const profile = await this.buyers.findById(id);
    if (!profile) {
      throw new NotFoundError('Buyer profile not found');
    }
    profile.verificationStatus = status;
    profile.isVerified = status === 'VERIFIED';
    await profile.save();
    return presentBuyer(profile, { includePrivate: true });
  }

  private async assertRefs(cropIds: string[], marketIds: string[]) {
    for (const id of cropIds) {
      if (!(await this.crops.findById(id))) {
        throw new NotFoundError('One or more crops were not found');
      }
    }
    for (const id of marketIds) {
      if (!(await this.markets.findById(id))) {
        throw new NotFoundError('One or more markets were not found');
      }
    }
  }

  private toData(input: Partial<BuyerInput>) {
    const data: Record<string, unknown> = {};
    for (const field of [
      'businessName',
      'businessType',
      'ownerName',
      'phone',
      'email',
      'gstNumber',
      'address',
      'village',
      'block',
      'district',
      'state',
      'pincode',
      'markets',
      'preferredCrops',
      'buyingCapacity',
      'paymentTerms',
    ] as const) {
      if (input[field] !== undefined) {
        data[field] = input[field];
      }
    }
    if (input.location) {
      data.location = toGeoPoint(input.location.longitude, input.location.latitude);
    }
    if (!data.state && input.district) {
      data.state = 'West Bengal';
    }
    return data;
  }
}
