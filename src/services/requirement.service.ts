import { BUYER_ROLES } from '../constants/roles';
import { hasRole } from '../middlewares/authorize';
import { CropRepository, MarketRepository } from '../repositories/catalog.repository';
import { BuyerRepository } from '../repositories/profile.repository';
import { RequirementRepository } from '../repositories/trade.repository';
import type { AuthUser } from '../types/auth';
import { AuthorizationError, NotFoundError, UnprocessableError } from '../utils/errors';
import { toGeoPoint } from '../utils/geo';
import { sameId } from '../utils/ids';
import { rupeesToPaise } from '../utils/money';
import { buildMeta, buildSort, toPageQuery } from '../utils/pagination';
import { presentRequirement } from '../utils/presenters';

interface RequirementInput {
  cropId: string;
  quantity: number;
  unit: string;
  targetPrice: number;
  qualityGrade?: string;
  requiredDate: string;
  marketId?: string;
  district?: string;
  state?: string;
  location?: { longitude: number; latitude: number };
  notes?: string;
  expiresAt?: string;
}

export class RequirementService {
  constructor(
    private readonly requirements: RequirementRepository,
    private readonly buyers: BuyerRepository,
    private readonly crops: CropRepository,
    private readonly markets: MarketRepository,
  ) {}

  async create(actor: AuthUser, input: RequirementInput) {
    if (!hasRole(actor, BUYER_ROLES)) throw new AuthorizationError('Only buyers can post requirements');
    const buyer = await this.buyers.verifyIfPending(actor.id);
    if (!buyer?.isVerified) throw new AuthorizationError('Only verified buyers can post requirements');
    if (!(await this.crops.findById(input.cropId))) throw new NotFoundError('Crop not found');
    if (input.marketId && !(await this.markets.findById(input.marketId))) throw new NotFoundError('Market not found');
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new UnprocessableError('Quantity must be a positive integer');
    }
    const requiredDate = new Date(input.requiredDate);
    const created = await this.requirements.create({
      buyerId: actor.id,
      buyerProfileId: buyer._id,
      cropId: input.cropId,
      quantity: input.quantity,
      unit: input.unit,
      targetPricePaise: rupeesToPaise(input.targetPrice),
      qualityGrade: input.qualityGrade,
      requiredDate,
      marketId: input.marketId,
      district: input.district ?? buyer.district,
      state: input.state ?? buyer.state,
      location: input.location ? toGeoPoint(input.location.longitude, input.location.latitude) : buyer.location,
      notes: input.notes,
      status: 'OPEN',
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : requiredDate,
    });
    return presentRequirement(created);
  }

  async list(actor: AuthUser | undefined, query: {
    page?: number;
    limit?: number;
    cropId?: string;
    marketId?: string;
    district?: string;
    status?: string;
    mine?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = toPageQuery(query);
    const filter: Record<string, unknown> = {};
    if (query.mine && actor) filter.buyerId = actor.id;
    else filter.status = query.status ?? 'OPEN';
    if (query.status && (query.mine || (actor && hasRole(actor, ['ADMIN', 'SUPER_ADMIN'])))) filter.status = query.status;
    if (query.cropId) filter.cropId = query.cropId;
    if (query.marketId) filter.marketId = query.marketId;
    if (query.district) filter.district = query.district;
    const sort = buildSort(query.sortBy, page.sortOrder, ['createdAt', 'requiredDate', 'quantity'], 'createdAt');
    const result = await this.requirements.list(filter, page.skip, page.limit, sort);
    return { items: result.items.map((item) => presentRequirement(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async get(id: string) {
    const item = await this.requirements.findById(id);
    if (!item) throw new NotFoundError('Requirement not found');
    return presentRequirement(item);
  }

  async update(actor: AuthUser, id: string, input: Partial<RequirementInput> & { status?: string }) {
    const item = await this.requireOwner(actor, id);
    if (input.quantity !== undefined) item.quantity = input.quantity;
    if (input.targetPrice !== undefined) item.targetPricePaise = rupeesToPaise(input.targetPrice);
    if (input.requiredDate) item.requiredDate = new Date(input.requiredDate);
    if (input.notes !== undefined) item.notes = input.notes;
    if (input.status && ['OPEN', 'FULFILLED', 'CANCELLED'].includes(input.status)) item.status = input.status as 'OPEN';
    await item.save();
    return presentRequirement(item);
  }

  async remove(actor: AuthUser, id: string) {
    const item = await this.requireOwner(actor, id);
    item.status = 'CANCELLED';
    await item.save();
    return presentRequirement(item);
  }

  private async requireOwner(actor: AuthUser, id: string) {
    const item = await this.requirements.findById(id);
    if (!item) throw new NotFoundError('Requirement not found');
    if (!sameId(item.buyerId, actor.id) && !hasRole(actor, ['ADMIN', 'SUPER_ADMIN'])) {
      throw new AuthorizationError();
    }
    return item;
  }
}
