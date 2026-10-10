import { ADMIN_ROLES, FARMER_ROLES } from '../constants/roles';
import { LIVE_LISTING_STATUSES, type ListingStatus } from '../constants/enums';
import { hasRole } from '../middlewares/authorize';
import { CropRepository, MarketRepository } from '../repositories/catalog.repository';
import { FarmerRepository, FpoRepository } from '../repositories/profile.repository';
import { ListingRepository, OfferRepository } from '../repositories/trade.repository';
import { UserRepository } from '../repositories/user.repository';
import type { AuthUser } from '../types/auth';
import type { RequestMeta } from '../types/common';
import { AuthorizationError, ConflictError, NotFoundError, UnprocessableError, isDuplicateKey } from '../utils/errors';
import { assertRadius, toGeoPoint } from '../utils/geo';
import { sameId } from '../utils/ids';
import { rupeesToPaise } from '../utils/money';
import { buildMeta, buildSort, toPageQuery } from '../utils/pagination';
import { presentListing } from '../utils/presenters';
import { escapeRegex } from '../utils/sanitize';
import { AuditService } from './audit.service';

const PRIVATE_STATUSES: ListingStatus[] = ['DRAFT', 'CANCELLED', 'EXPIRED', 'SOLD'];

interface ListingInput {
  cropId: string;
  fpoId?: string;
  title?: string;
  description?: string;
  quantity: number;
  unit: string;
  qualityGrade: string;
  qualityParameters?: {
    size?: string;
    color?: string;
    moisture?: string;
    organic?: boolean;
    notes?: string;
  };
  expectedPrice: number;
  minimumPrice?: number;
  harvestDate: string;
  availableFrom: string;
  availableUntil: string;
  marketId?: string;
  preferredMarketId?: string;
  location?: { longitude: number; latitude: number };
  pickupLocation?: { address: string; landmark?: string; longitude: number; latitude: number };
  images?: string[];
  isNegotiable?: boolean;
  allowBidding?: boolean;
  district?: string;
  state?: string;
}

interface ListingQuery {
  page?: number;
  limit?: number;
  crop?: string;
  cropId?: string;
  marketId?: string;
  district?: string;
  farmer?: string;
  farmerId?: string;
  fpo?: string;
  fpoId?: string;
  minPrice?: number;
  maxPrice?: number;
  minQuantity?: number;
  quality?: string;
  qualityGrade?: string;
  availableFrom?: string;
  availableUntil?: string;
  status?: ListingStatus;
  q?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  lat?: number;
  lng?: number;
  radius?: number;
}

export class ListingService {
  constructor(
    private readonly listings: ListingRepository,
    private readonly farmers: FarmerRepository,
    private readonly crops: CropRepository,
    private readonly markets: MarketRepository,
    private readonly fpos: FpoRepository,
    private readonly offers: OfferRepository,
    private readonly audit: AuditService,
    private readonly users: UserRepository,
  ) {}

  async create(actor: AuthUser, input: ListingInput, meta: RequestMeta) {
    if (!hasRole(actor, FARMER_ROLES)) {
      throw new AuthorizationError('Only farmers can create listings');
    }
    const profile = await this.ensureFarmerProfile(actor, input);
    const prepared = await this.prepare(actor, profile, input, true);
    const listing = await this.listings.create({
      ...prepared,
      farmerId: actor.id,
      farmerProfileId: profile._id,
      availableQuantity: prepared.quantity,
      status: 'DRAFT',
    });
    await this.audit.record({
      userId: actor.id,
      action: 'CREATE_LISTING',
      entity: 'VegetableListing',
      entityId: String(listing._id),
      newValue: { status: 'DRAFT', quantity: listing.quantity },
      meta,
    });
    return presentListing(listing);
  }

  async update(actor: AuthUser, id: string, input: Partial<ListingInput>, meta: RequestMeta) {
    const listing = await this.requireOwned(actor, id);
    if (['SOLD', 'CANCELLED', 'EXPIRED'].includes(listing.status)) {
      throw new ConflictError('This listing can no longer be edited');
    }
    const profile = await this.farmers.findByUserId(String(listing.farmerId));
    if (!profile) throw new NotFoundError('Farmer profile not found');
    const prepared = await this.prepare(actor, profile, { ...this.currentInput(listing), ...input }, false);
    const reserved = listing.quantity - listing.availableQuantity;
    if (prepared.quantity < reserved) {
      throw new UnprocessableError('Quantity cannot be lower than the amount already reserved');
    }
    listing.availableQuantity = prepared.quantity - reserved;
    Object.assign(listing, prepared);
    if (listing.availableQuantity === 0 && listing.status !== 'DRAFT') listing.status = 'SOLD';
    await listing.save();
    await this.audit.record({
      userId: actor.id,
      action: 'UPDATE_LISTING',
      entity: 'VegetableListing',
      entityId: id,
      newValue: { status: listing.status, quantity: listing.quantity },
      meta,
    });
    return presentListing(listing);
  }

  async publish(actor: AuthUser, id: string) {
    const listing = await this.requireOwned(actor, id);
    const profile = await this.farmers.findByUserId(String(listing.farmerId));
    if (!profile) {
      throw new UnprocessableError('Farmer profile not found');
    }
    if (listing.status !== 'DRAFT') {
      throw new ConflictError('Only draft listings can be published');
    }
    if (listing.availableUntil <= new Date()) {
      throw new UnprocessableError('Listing availability has already ended');
    }
    if (!profile.isVerified) {
      profile.verificationStatus = 'VERIFIED';
      profile.isVerified = true;
      await profile.save();
    }
    listing.status = 'ACTIVE';
    await listing.save();
    return presentListing(listing);
  }

  async cancel(actor: AuthUser, id: string) {
    const listing = await this.requireOwned(actor, id);
    if (['SOLD', 'CANCELLED', 'EXPIRED'].includes(listing.status)) {
      throw new ConflictError('Listing cannot be cancelled');
    }
    listing.status = 'CANCELLED';
    await listing.save();
    await this.offers.rejectOpenForListing(id);
    return presentListing(listing);
  }

  async remove(actor: AuthUser, id: string) {
    const listing = await this.requireOwned(actor, id);
    if (listing.status === 'DRAFT' && listing.availableQuantity === listing.quantity) {
      await listing.deleteOne();
      return { deleted: true };
    }
    return this.cancel(actor, id);
  }

  async get(id: string, actor?: AuthUser) {
    const listing = await this.listings.findById(id);
    if (!listing) throw new NotFoundError('Listing not found');
    if (PRIVATE_STATUSES.includes(listing.status) && !this.canSeePrivate(actor, listing.farmerId)) {
      throw new NotFoundError('Listing not found');
    }
    return presentListing(listing);
  }

  async search(actor: AuthUser | undefined, query: ListingQuery) {
    const page = toPageQuery(query);
    const filter = await this.filterFrom(actor, query);
    const sortField = query.sortBy === 'expectedPrice' ? 'expectedPricePaise' : query.sortBy;
    const sort = buildSort(sortField, page.sortOrder, ['createdAt', 'expectedPricePaise', 'quantity', 'availableFrom'], 'createdAt');
    if (query.lat !== undefined && query.lng !== undefined) {
      const radius = assertRadius(query.radius ?? 20_000);
      const result = await this.listings.nearby(filter, query.lng, query.lat, radius, page.skip, page.limit);
      return { items: result.items.map((item) => presentListing(item)), meta: buildMeta(page.page, page.limit, result.total) };
    }
    const result = await this.listings.search(filter, page.skip, page.limit, sort);
    return { items: result.items.map((item) => presentListing(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async mine(actor: AuthUser, query: ListingQuery) {
    return this.search(actor, { ...query, farmerId: actor.id, status: query.status });
  }

  private async filterFrom(actor: AuthUser | undefined, query: ListingQuery) {
    const filter: Record<string, unknown> = {};
    const ownerView = Boolean(query.farmerId && actor && (query.farmerId === actor.id || hasRole(actor, ADMIN_ROLES)));
    if (query.status) {
      if (PRIVATE_STATUSES.includes(query.status) && !ownerView && !(actor && hasRole(actor, ADMIN_ROLES))) {
        throw new AuthorizationError('You cannot filter by that listing status');
      }
      filter.status = query.status;
    } else if (!ownerView) {
      filter.status = { $in: LIVE_LISTING_STATUSES };
      filter.availableUntil = { $gt: new Date() };
    }
    const cropToken = query.cropId ?? query.crop;
    if (cropToken) {
      const crop = /^[a-fA-F0-9]{24}$/.test(cropToken)
        ? await this.crops.findById(cropToken)
        : await this.crops.findByNameKey(cropToken.trim().toLowerCase());
      if (!crop) throw new NotFoundError('Crop not found');
      filter.cropId = crop._id;
    }
    if (query.marketId) filter.preferredMarketId = query.marketId;
    if (query.district) filter.district = new RegExp(`^${escapeRegex(query.district)}$`, 'i');
    if (query.farmerId || query.farmer) filter.farmerId = query.farmerId ?? query.farmer;
    if (query.fpoId || query.fpo) filter.fpoId = query.fpoId ?? query.fpo;
    if (query.quality || query.qualityGrade) filter.qualityGrade = query.quality ?? query.qualityGrade;
    if (query.minQuantity) filter.availableQuantity = { $gte: query.minQuantity };
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      const price: Record<string, number> = {};
      if (query.minPrice !== undefined) price.$gte = rupeesToPaise(query.minPrice);
      if (query.maxPrice !== undefined) price.$lte = rupeesToPaise(query.maxPrice);
      filter.expectedPricePaise = price;
    }
    if (query.availableFrom) {
      const current = (filter.availableUntil as Record<string, Date> | undefined) ?? {};
      filter.availableUntil = { ...current, $gte: new Date(query.availableFrom) };
    }
    if (query.availableUntil) filter.availableFrom = { $lte: new Date(query.availableUntil) };
    if (query.q?.trim()) {
      const pattern = new RegExp(escapeRegex(query.q.trim()), 'i');
      const [matchedCrops, matchedMarkets] = await Promise.all([
        this.crops.list(
          { $or: [{ name: pattern }, { bengaliName: pattern }, { localNames: pattern }] },
          0,
          200,
          { name: 1 },
        ),
        this.markets.list(
          { $or: [{ name: pattern }, { village: pattern }, { block: pattern }, { district: pattern }, { address: pattern }] },
          0,
          200,
          { name: 1 },
        ),
      ]);
      const matches: Record<string, unknown>[] = [{ title: pattern }, { description: pattern }];
      if (matchedCrops.items.length) matches.push({ cropId: { $in: matchedCrops.items.map((crop) => crop._id) } });
      if (matchedMarkets.items.length) matches.push({ preferredMarketId: { $in: matchedMarkets.items.map((market) => market._id) } });
      filter.$or = matches;
    }
    return filter;
  }

  private async ensureFarmerProfile(actor: AuthUser, input: ListingInput) {
    const existing = await this.farmers.findByUserId(actor.id);
    if (existing) return existing;

    const user = await this.users.findById(actor.id);
    if (!user) throw new NotFoundError('User not found');

    const location = await this.profileLocation(input, user.location);
    const district = input.district?.trim() || user.district?.trim() || 'Not specified';
    const state = input.state?.trim() || user.state?.trim() || 'West Bengal';
    const address = user.address?.trim() || input.pickupLocation?.address?.trim() || district;

    try {
      return await this.farmers.create({
        userId: actor.id,
        farmerName: user.name,
        phone: user.phone,
        address,
        village: user.village,
        district,
        state,
        pincode: user.pincode?.trim() || '000000',
        location,
        verificationStatus: 'PENDING',
        isVerified: false,
        rating: 0,
        ratingCount: 0,
        totalOrders: 0,
        totalSalesPaise: 0,
      });
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
      const raced = await this.farmers.findByUserId(actor.id);
      if (!raced) throw error;
      return raced;
    }
  }

  private async profileLocation(
    input: ListingInput,
    saved?: { type?: string; coordinates?: number[] } | null,
  ) {
    if (input.location) return toGeoPoint(input.location.longitude, input.location.latitude);
    if (input.pickupLocation) return toGeoPoint(input.pickupLocation.longitude, input.pickupLocation.latitude);
    if (saved?.coordinates?.length === 2) {
      return { type: 'Point', coordinates: [saved.coordinates[0], saved.coordinates[1]] };
    }
    const marketId = input.preferredMarketId ?? input.marketId;
    if (marketId) {
      const market = await this.markets.findById(marketId);
      const coordinates = market?.location?.coordinates;
      if (market && coordinates?.length === 2) {
        return { type: 'Point', coordinates: [coordinates[0], coordinates[1]] };
      }
    }
    throw new UnprocessableError('A pickup location is required before a listing can be created');
  }

  private async prepare(
    actor: AuthUser,
    profile: { _id: unknown; location: { type: 'Point'; coordinates: number[] }; district: string; state: string },
    input: ListingInput,
    creating: boolean,
  ) {
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new UnprocessableError('Quantity must be a positive integer');
    }
    const crop = await this.crops.findById(input.cropId);
    if (!crop || !crop.isActive) throw new NotFoundError('Crop not found');
    const expectedPricePaise = rupeesToPaise(input.expectedPrice);
    const minimumPricePaise = input.minimumPrice !== undefined ? rupeesToPaise(input.minimumPrice) : undefined;
    if (minimumPricePaise !== undefined && minimumPricePaise > expectedPricePaise) {
      throw new UnprocessableError('Minimum price cannot exceed the expected price');
    }
    const availableFrom = new Date(input.availableFrom);
    const availableUntil = new Date(input.availableUntil);
    if (Number.isNaN(availableFrom.getTime()) || Number.isNaN(availableUntil.getTime()) || availableUntil <= availableFrom) {
      throw new UnprocessableError('availableUntil must be after availableFrom');
    }
    const marketId = input.preferredMarketId ?? input.marketId;
    if (marketId) {
      const market = await this.markets.findById(marketId);
      if (!market || !market.isActive) throw new NotFoundError('Market not found');
    }
    if (input.fpoId) {
      const fpo = await this.fpos.findById(input.fpoId);
      if (!fpo) throw new NotFoundError('FPO not found');
      const member = fpo.memberFarmerIds.some((item) => sameId(item, profile._id));
      if (!member && !sameId(fpo.adminUserId, actor.id)) {
        throw new AuthorizationError('You are not a member of this FPO');
      }
    }
    const location = input.location
      ? toGeoPoint(input.location.longitude, input.location.latitude)
      : profile.location;
    if (!location) throw new UnprocessableError('A pickup location is required');
    return {
      cropId: crop._id,
      fpoId: input.fpoId,
      title: input.title?.trim() || `${crop.name} - ${input.quantity} ${input.unit}`,
      description: input.description,
      quantity: input.quantity,
      unit: input.unit,
      qualityGrade: input.qualityGrade,
      qualityParameters: input.qualityParameters ?? {},
      expectedPricePaise,
      minimumPricePaise,
      harvestDate: new Date(input.harvestDate),
      availableFrom,
      availableUntil,
      location,
      pickupLocation: input.pickupLocation
        ? {
            address: input.pickupLocation.address,
            landmark: input.pickupLocation.landmark,
            location: toGeoPoint(input.pickupLocation.longitude, input.pickupLocation.latitude),
          }
        : undefined,
      preferredMarketId: marketId,
      district: input.district ?? profile.district,
      state: input.state ?? profile.state ?? 'West Bengal',
      images: input.images ?? [],
      isNegotiable: input.isNegotiable ?? true,
      allowBidding: input.allowBidding ?? true,
    };
    void creating;
  }

  private currentInput(listing: {
    cropId: unknown;
    quantity: number;
    unit: string;
    qualityGrade: string;
    expectedPricePaise: number;
    minimumPricePaise?: number | null;
    harvestDate: Date;
    availableFrom: Date;
    availableUntil: Date;
    title: string;
    description?: string | null;
    isNegotiable: boolean;
    allowBidding: boolean;
    district?: string | null;
    state?: string | null;
    fpoId?: unknown;
    preferredMarketId?: unknown;
    images?: string[] | null;
    location?: { coordinates?: number[] } | null;
  }): ListingInput {
    return {
      cropId: String(listing.cropId),
      quantity: listing.quantity,
      unit: listing.unit,
      qualityGrade: listing.qualityGrade,
      expectedPrice: listing.expectedPricePaise / 100,
      minimumPrice: listing.minimumPricePaise != null ? listing.minimumPricePaise / 100 : undefined,
      harvestDate: listing.harvestDate.toISOString(),
      availableFrom: listing.availableFrom.toISOString(),
      availableUntil: listing.availableUntil.toISOString(),
      title: listing.title,
      description: listing.description ?? undefined,
      isNegotiable: listing.isNegotiable,
      allowBidding: listing.allowBidding,
      district: listing.district ?? undefined,
      state: listing.state ?? undefined,
      fpoId: listing.fpoId ? String(listing.fpoId) : undefined,
      preferredMarketId: listing.preferredMarketId ? String(listing.preferredMarketId) : undefined,
      images: listing.images ?? undefined,
      location: listing.location?.coordinates
        ? { longitude: listing.location.coordinates[0], latitude: listing.location.coordinates[1] }
        : undefined,
    };
  }

  private async requireOwned(actor: AuthUser, id: string) {
    const listing = await this.listings.findById(id);
    if (!listing) throw new NotFoundError('Listing not found');
    if (!sameId(listing.farmerId, actor.id) && !hasRole(actor, ADMIN_ROLES)) {
      throw new AuthorizationError('Only the listing owner can change this listing');
    }
    return listing;
  }

  private canSeePrivate(actor: AuthUser | undefined, farmerId: unknown) {
    if (!actor) return false;
    return sameId(actor.id, farmerId) || hasRole(actor, ADMIN_ROLES);
  }
}
