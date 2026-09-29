import { BuyerRepository, FarmerRepository, FpoRepository } from '../repositories/profile.repository';
import { MarketRepository } from '../repositories/catalog.repository';
import { AuditRepository, DeliveryRepository, DisputeRepository, StatsRepository } from '../repositories/operations.repository';
import { ListingRepository, OrderRepository, PaymentRepository } from '../repositories/trade.repository';
import { UserRepository } from '../repositories/user.repository';
import { paiseToRupees } from '../utils/money';
import { buildMeta, buildSort, toPageQuery } from '../utils/pagination';
import { presentAudit, presentBuyer, presentDispute, presentFarmer, presentFpo, presentListing, presentMarket, presentOrder, presentPayment, presentUser } from '../utils/presenters';
import { startOfTodayInKolkata } from '../utils/ids';
import { escapeRegex } from '../utils/sanitize';

export class AdminService {
  constructor(
    private readonly users: UserRepository,
    private readonly farmers: FarmerRepository,
    private readonly buyers: BuyerRepository,
    private readonly fpos: FpoRepository,
    private readonly listings: ListingRepository,
    private readonly orders: OrderRepository,
    private readonly payments: PaymentRepository,
    private readonly markets: MarketRepository,
    private readonly disputes: DisputeRepository,
    private readonly deliveries: DeliveryRepository,
    private readonly stats: StatsRepository,
    private readonly audits: AuditRepository,
  ) {}

  async dashboard() {
    const start = startOfTodayInKolkata();
    const [totalFarmers, activeFarmers, totalBuyers, activeBuyers, totalListings, activeListings, todaysOrders, gmvRows, pendingPayments, completedOrders, activeDeliveries, topVegetables, topMarkets] =
      await Promise.all([
        this.farmers.count({}),
        this.farmers.count({ isVerified: true }),
        this.buyers.count({}),
        this.buyers.count({ isVerified: true }),
        this.listings.count({}),
        this.listings.count({ status: { $in: ['ACTIVE', 'PARTIALLY_SOLD'] } }),
        this.orders.count({ createdAt: { $gte: start }, orderStatus: { $ne: 'CANCELLED' } }),
        this.orders.sumGmv({ orderStatus: { $ne: 'CANCELLED' } }),
        this.payments.count({ status: 'PENDING' }),
        this.orders.count({ orderStatus: 'COMPLETED' }),
        this.deliveries.count({ status: { $in: ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT'] } }),
        this.stats.topCrops(5),
        this.stats.topMarkets(5),
      ]);
    return {
      totalFarmers,
      activeFarmers,
      totalBuyers,
      activeBuyers,
      totalListings,
      activeListings,
      todaysOrders,
      totalGmv: paiseToRupees(gmvRows[0]?.total ?? 0),
      pendingPayments,
      completedOrders,
      activeDeliveries,
      topVegetables: topVegetables.map((row) => ({
        cropId: String(row._id),
        name: (row.crop as { name?: string } | undefined)?.name ?? null,
        volume: row.volume,
        gmv: paiseToRupees(row.gmvPaise),
      })),
      topMarkets: topMarkets.map((row) => ({
        marketId: String(row._id),
        name: (row.market as { name?: string } | undefined)?.name ?? null,
        orders: row.orders,
        gmv: paiseToRupees(row.gmvPaise),
      })),
    };
  }

  async usersList(query: { page?: number; limit?: number; role?: string; q?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
    return this.page(this.users, query, (item) => presentUser(item), ['createdAt', 'name', 'role']);
  }

  async listFarmers(query: { page?: number; limit?: number; district?: string; verificationStatus?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
    return this.page(this.farmers, query, (item) => presentFarmer(item, { includePrivate: true }), ['createdAt', 'district', 'farmerName'], {
      district: query.district,
      verificationStatus: query.verificationStatus,
    });
  }

  async listBuyers(query: { page?: number; limit?: number; businessType?: string; verificationStatus?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
    return this.page(this.buyers, query, (item) => presentBuyer(item, { includePrivate: true }), ['createdAt', 'businessName'], {
      businessType: query.businessType,
      verificationStatus: query.verificationStatus,
    });
  }

  async listFpos(query: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
    return this.page(this.fpos, query, (item) => presentFpo(item), ['createdAt', 'name']);
  }

  async listListings(query: { page?: number; limit?: number; status?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
    return this.page(this.listings, query, (item) => presentListing(item), ['createdAt', 'status'], { status: query.status });
  }

  async listOrders(query: { page?: number; limit?: number; status?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
    return this.page(this.orders, query, (item) => presentOrder(item), ['createdAt', 'orderStatus'], query.status ? { orderStatus: query.status } : {});
  }

  async listPayments(query: { page?: number; limit?: number; status?: string }) {
    const page = toPageQuery(query);
    const filter = query.status ? { status: query.status } : {};
    const result = await this.payments.list(filter, page.skip, page.limit);
    return { items: result.items.map((item) => presentPayment(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async listMarkets(query: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
    return this.page(this.markets, query, (item) => presentMarket(item), ['name', 'createdAt']);
  }

  async listDisputes(query: { page?: number; limit?: number; status?: string }) {
    const page = toPageQuery(query);
    const filter = query.status ? { status: query.status } : {};
    const result = await this.disputes.list(filter, page.skip, page.limit);
    return { items: result.items.map((item) => presentDispute(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async auditLogs(query: { page?: number; limit?: number; action?: string; entity?: string }) {
    const page = toPageQuery(query);
    const filter: Record<string, unknown> = {};
    if (query.action) filter.action = query.action;
    if (query.entity) filter.entity = query.entity;
    const result = await this.audits.list(filter, page.skip, page.limit);
    return { items: result.items.map((item) => presentAudit(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  private async page<T extends { list: (filter: Record<string, unknown>, skip: number, limit: number, sort: Record<string, 1 | -1>) => Promise<{ items: object[]; total: number }> }>(
    repository: T,
    query: { page?: number; limit?: number; role?: string; q?: string; sortBy?: string; sortOrder?: 'asc' | 'desc' },
    map: (item: object) => unknown,
    allowlist: string[],
    extra: Record<string, unknown> = {},
  ) {
    const page = toPageQuery(query);
    const filter: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(extra)) {
      if (value !== undefined) filter[key] = value;
    }
    if (query.role) filter.role = query.role;
    if (query.q) {
      filter.$or = [
        { name: new RegExp(escapeRegex(query.q), 'i') },
        { phone: new RegExp(escapeRegex(query.q), 'i') },
        { farmerName: new RegExp(escapeRegex(query.q), 'i') },
        { businessName: new RegExp(escapeRegex(query.q), 'i') },
      ];
    }
    const sort = buildSort(query.sortBy, page.sortOrder, allowlist, allowlist[0] ?? 'createdAt');
    const result = await repository.list(filter, page.skip, page.limit, sort);
    return { items: result.items.map((item) => map(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }
}
