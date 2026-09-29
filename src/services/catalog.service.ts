import { ADMIN_ROLES } from '../constants/roles';
import { hasRole } from '../middlewares/authorize';
import { CropRepository, MarketRepository, MarketPriceRepository } from '../repositories/catalog.repository';
import type { AuthUser } from '../types/auth';
import { ConflictError, NotFoundError } from '../utils/errors';
import { assertRadius, toGeoPoint } from '../utils/geo';
import { percentToBps } from '../utils/money';
import { buildMeta, buildSort, toPageQuery } from '../utils/pagination';
import { presentCrop, presentMarket, presentMarketPrice } from '../utils/presenters';
import { startOfUtcDay } from '../utils/ids';
import { rupeesToPaise } from '../utils/money';
import { escapeRegex } from '../utils/sanitize';

export class CropService {
  constructor(private readonly crops: CropRepository) {}

  async create(input: {
    name: string;
    localNames?: string[];
    bengaliName?: string;
    category: string;
    unit: string;
    image?: string;
    description?: string;
    season: string;
  }) {
    const nameKey = input.name.trim().toLowerCase();
    if (await this.crops.findByNameKey(nameKey)) {
      throw new ConflictError('Crop already exists');
    }
    const crop = await this.crops.create({ ...input, name: input.name.trim(), nameKey, isActive: true });
    return presentCrop(crop);
  }

  async list(actor: AuthUser | undefined, query: {
    page?: number;
    limit?: number;
    q?: string;
    category?: string;
    isActive?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = toPageQuery(query);
    const filter: Record<string, unknown> = {};
    const admin = actor ? hasRole(actor, ADMIN_ROLES) : false;
    filter.isActive = admin && query.isActive !== undefined ? query.isActive : true;
    if (query.category) filter.category = query.category;
    if (query.q) {
      filter.name = new RegExp(escapeRegex(query.q), 'i');
    }
    const sort = buildSort(query.sortBy, page.sortOrder, ['name', 'createdAt', 'category'], 'name');
    const result = await this.crops.list(filter, page.skip, page.limit, sort);
    return { items: result.items.map((item) => presentCrop(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async get(id: string) {
    const crop = await this.crops.findById(id);
    if (!crop) {
      throw new NotFoundError('Crop not found');
    }
    return presentCrop(crop);
  }

  async update(id: string, input: Record<string, unknown>) {
    const crop = await this.crops.findById(id);
    if (!crop) throw new NotFoundError('Crop not found');
    if (typeof input.name === 'string') {
      const nameKey = input.name.trim().toLowerCase();
      const existing = await this.crops.findByNameKey(nameKey);
      if (existing && String(existing._id) !== id) throw new ConflictError('Crop already exists');
      input.nameKey = nameKey;
      input.name = input.name.trim();
    }
    const updated = await this.crops.updateById(id, input);
    if (!updated) throw new NotFoundError('Crop not found');
    return presentCrop(updated);
  }

  async resolve(crop: string) {
    if (/^[a-fA-F0-9]{24}$/.test(crop)) {
      return this.crops.findById(crop);
    }
    return this.crops.findByNameKey(crop.trim().toLowerCase());
  }
}

export class MarketService {
  constructor(private readonly markets: MarketRepository) {}

  async create(input: {
    name: string;
    marketCode: string;
    marketType: string;
    address: string;
    village?: string;
    block?: string;
    district: string;
    state?: string;
    pincode?: string;
    location: { longitude: number; latitude: number };
    operatingDays?: string[];
    openingTime?: string;
    closingTime?: string;
    commodities?: string[];
    commissionRate?: number;
    managerUserId?: string;
  }) {
    if (await this.markets.findByCode(input.marketCode)) {
      throw new ConflictError('Market code already exists');
    }
    const market = await this.markets.create({
      ...input,
      marketCode: input.marketCode.toUpperCase(),
      state: input.state ?? 'West Bengal',
      location: toGeoPoint(input.location.longitude, input.location.latitude),
      commissionBps: percentToBps(input.commissionRate ?? 0),
      isActive: true,
      isDemo: false,
    });
    return presentMarket(market);
  }

  async list(query: {
    page?: number;
    limit?: number;
    district?: string;
    marketType?: string;
    q?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    includeInactive?: boolean;
  }) {
    const page = toPageQuery(query);
    const filter: Record<string, unknown> = {};
    if (!query.includeInactive) filter.isActive = true;
    if (query.district) filter.district = query.district;
    if (query.marketType) filter.marketType = query.marketType;
    if (query.q) filter.name = new RegExp(escapeRegex(query.q), 'i');
    const sort = buildSort(query.sortBy, page.sortOrder, ['name', 'createdAt', 'district'], 'name');
    const result = await this.markets.list(filter, page.skip, page.limit, sort);
    return { items: result.items.map((item) => presentMarket(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async get(id: string) {
    const market = await this.markets.findById(id);
    if (!market) throw new NotFoundError('Market not found');
    return presentMarket(market);
  }

  async update(id: string, input: Record<string, unknown> & { location?: { longitude: number; latitude: number }; commissionRate?: number }) {
    const market = await this.markets.findById(id);
    if (!market) throw new NotFoundError('Market not found');
    const data: Record<string, unknown> = { ...input };
    if (input.location) {
      data.location = toGeoPoint(input.location.longitude, input.location.latitude);
    }
    if (input.commissionRate !== undefined) {
      data.commissionBps = percentToBps(input.commissionRate);
      delete data.commissionRate;
    }
    const updated = await this.markets.updateById(id, data);
    if (!updated) throw new NotFoundError('Market not found');
    return presentMarket(updated);
  }

  async nearby(query: { lat: number; lng: number; radius?: number; page?: number; limit?: number }) {
    const radius = assertRadius(query.radius ?? 20_000);
    const page = toPageQuery(query);
    const result = await this.markets.nearby(query.lng, query.lat, radius, page.skip, page.limit);
    return { items: result.items.map((item) => presentMarket(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }
}

export class MarketPriceService {
  constructor(
    private readonly prices: MarketPriceRepository,
    private readonly crops: CropRepository,
    private readonly markets: MarketRepository,
  ) {}

  async create(input: {
    cropId: string;
    marketId: string;
    date: string;
    minimumPrice: number;
    maximumPrice: number;
    modalPrice: number;
    unit: string;
    source?: string;
  }) {
    if (!(await this.crops.findById(input.cropId))) throw new NotFoundError('Crop not found');
    if (!(await this.markets.findById(input.marketId))) throw new NotFoundError('Market not found');
    const minimumPricePaise = rupeesToPaise(input.minimumPrice);
    const maximumPricePaise = rupeesToPaise(input.maximumPrice);
    const modalPricePaise = rupeesToPaise(input.modalPrice);
    if (minimumPricePaise > modalPricePaise || modalPricePaise > maximumPricePaise) {
      throw new ConflictError('Modal price must sit between minimum and maximum');
    }
    const date = startOfUtcDay(new Date(input.date));
    const existing = await this.prices.list({ cropId: input.cropId, marketId: input.marketId, date, source: input.source ?? 'MANUAL' }, 0, 1);
    if (existing.items[0]) {
      const updated = await this.prices.upsertDerived(
        { cropId: input.cropId, marketId: input.marketId, date, source: input.source ?? 'MANUAL' },
        { minimumPricePaise, maximumPricePaise, modalPricePaise, unit: input.unit },
      );
      void updated;
      const refreshed = await this.prices.list({ cropId: input.cropId, marketId: input.marketId, date, source: input.source ?? 'MANUAL' }, 0, 1);
      return presentMarketPrice(refreshed.items[0]);
    }
    const created = await this.prices.create({
      cropId: input.cropId,
      marketId: input.marketId,
      date,
      minimumPricePaise,
      maximumPricePaise,
      modalPricePaise,
      unit: input.unit,
      source: input.source ?? 'MANUAL',
    });
    return presentMarketPrice(created);
  }

  async list(query: {
    page?: number;
    limit?: number;
    cropId?: string;
    marketId?: string;
    from?: string;
    to?: string;
  }) {
    const page = toPageQuery(query);
    const filter: Record<string, unknown> = {};
    if (query.cropId) filter.cropId = query.cropId;
    if (query.marketId) filter.marketId = query.marketId;
    if (query.from || query.to) {
      const date: Record<string, Date> = {};
      if (query.from) date.$gte = startOfUtcDay(new Date(query.from));
      if (query.to) date.$lte = startOfUtcDay(new Date(query.to));
      filter.date = date;
    }
    const result = await this.prices.list(filter, page.skip, page.limit);
    return { items: result.items.map((item) => presentMarketPrice(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async history(cropId: string, query: { marketId?: string; from?: string; to?: string; page?: number; limit?: number }) {
    if (!(await this.crops.findById(cropId))) throw new NotFoundError('Crop not found');
    return this.list({ ...query, cropId });
  }
}
