import type { ClientSession } from 'mongoose';
import { ADMIN_ROLES, BUYER_ROLES } from '../constants/roles';
import type { OrderStatus } from '../constants/enums';
import { domainBus } from '../events/bus';
import { hasRole } from '../middlewares/authorize';
import { MarketRepository } from '../repositories/catalog.repository';
import { FarmerRepository, BuyerRepository } from '../repositories/profile.repository';
import { CounterRepository } from '../repositories/user.repository';
import { ListingRepository, OfferRepository, OrderRepository, PaymentRepository } from '../repositories/trade.repository';
import type { AuthUser } from '../types/auth';
import type { RequestMeta } from '../types/common';
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  UnprocessableError,
  isDuplicateKey,
} from '../utils/errors';
import { sameId } from '../utils/ids';
import { calculateOrderAmounts, rupeesToPaise } from '../utils/money';
import { assertOrderTransition, CANCELLABLE_ORDER_STATUSES, releasesInventory } from '../utils/orderState';
import { buildMeta, buildSort, toPageQuery } from '../utils/pagination';
import { presentOrder } from '../utils/presenters';
import { runInTransaction } from '../utils/transaction';
import { logger } from '../utils/logger';
import { AuditService } from './audit.service';

interface PlaceInput {
  buyerId: string;
  listingId: string;
  quantity: number;
  unitPricePaise: number;
  offerId?: string;
  deliveryLocation?: { address: string; landmark?: string; longitude?: number; latitude?: number };
  transportChargePaise?: number;
  discountPaise?: number;
  scheduledPickupDate?: Date;
  scheduledDeliveryDate?: Date;
  notes?: string;
  idempotencyKey?: string;
}

export class OrderService {
  constructor(
    private readonly orders: OrderRepository,
    private readonly listings: ListingRepository,
    private readonly offers: OfferRepository,
    private readonly farmers: FarmerRepository,
    private readonly buyers: BuyerRepository,
    private readonly markets: MarketRepository,
    private readonly counters: CounterRepository,
    private readonly payments: PaymentRepository,
    private readonly audit: AuditService,
  ) {}

  async createDirect(
    actor: AuthUser,
    input: {
      listingId: string;
      quantity: number;
      deliveryLocation?: PlaceInput['deliveryLocation'];
      transportCharge?: number;
      discount?: number;
      scheduledPickupDate?: string;
      scheduledDeliveryDate?: string;
      notes?: string;
      idempotencyKey?: string;
    },
    meta: RequestMeta,
  ) {
    this.assertBuyer(actor);
    const buyer = await this.buyers.findByUserId(actor.id);
    if (!buyer?.isVerified) {
      throw new AuthorizationError('Only verified buyers can place orders');
    }
    if (input.idempotencyKey) {
      const existing = await this.orders.findByIdempotency(actor.id, input.idempotencyKey);
      if (existing) {
        if (String(existing.listingId) !== input.listingId || existing.quantity !== input.quantity) {
          throw new ConflictError('Idempotency key was already used for a different order');
        }
        return presentOrder(existing);
      }
    }
    const listing = await this.listings.findById(input.listingId);
    if (!listing) throw new NotFoundError('Listing not found');
    await this.counters.ensure(`order-${new Date().getUTCFullYear()}`);
    try {
      const order = await runInTransaction(async (session) => {
        const current = await this.listings.findById(input.listingId, session);
        if (!current) throw new NotFoundError('Listing not found');
        this.assertPurchasable(current, actor.id);
        const farmer = await this.farmers.findByUserId(String(current.farmerId));
        if (!farmer?.isVerified) throw new AuthorizationError('The farmer is not verified');
        const reserved = await this.listings.reserve(String(current._id), input.quantity, session);
        if (!reserved) throw new ConflictError('Insufficient available quantity');
        reserved.status = reserved.availableQuantity === 0 ? 'SOLD' : 'PARTIALLY_SOLD';
        await reserved.save({ session });
        await this.offers.rejectUnfulfillable(String(current._id), reserved.availableQuantity, '000000000000000000000000', session);
        return this.insertOrder(session, current, {
          buyerId: actor.id,
          listingId: input.listingId,
          quantity: input.quantity,
          unitPricePaise: current.expectedPricePaise,
          deliveryLocation: input.deliveryLocation,
          transportChargePaise: input.transportCharge ? rupeesToPaise(input.transportCharge) : 0,
          discountPaise: input.discount ? rupeesToPaise(input.discount) : 0,
          scheduledPickupDate: input.scheduledPickupDate ? new Date(input.scheduledPickupDate) : undefined,
          scheduledDeliveryDate: input.scheduledDeliveryDate ? new Date(input.scheduledDeliveryDate) : undefined,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
        });
      });
      await this.afterCreate(order, meta);
      return presentOrder(order);
    } catch (error) {
      if (input.idempotencyKey && isDuplicateKey(error)) {
        const existing = await this.orders.findByIdempotency(actor.id, input.idempotencyKey);
        if (existing) return presentOrder(existing);
      }
      throw error;
    }
  }

  async createFromOffer(
    session: ClientSession,
    listing: NonNullable<Awaited<ReturnType<ListingRepository['findById']>>>,
    input: PlaceInput,
  ) {
    return this.insertOrder(session, listing, input);
  }

  async list(actor: AuthUser, query: {
    page?: number;
    limit?: number;
    status?: OrderStatus;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const page = toPageQuery(query);
    const filter: Record<string, unknown> = {};
    if (!hasRole(actor, ADMIN_ROLES)) {
      filter.$or = [{ buyerId: actor.id }, { farmerId: actor.id }];
    }
    if (query.status) filter.orderStatus = query.status;
    const sort = buildSort(query.sortBy, page.sortOrder, ['createdAt', 'totalAmountPaise', 'orderStatus'], 'createdAt');
    const result = await this.orders.list(filter, page.skip, page.limit, sort);
    return { items: result.items.map((item) => presentOrder(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async get(actor: AuthUser, id: string) {
    const order = await this.requireVisible(actor, id);
    return presentOrder(order);
  }

  async transition(actor: AuthUser, id: string, to: OrderStatus, meta: RequestMeta) {
    if (to === 'CANCELLED') return this.cancel(actor, id, meta);
    const order = await runInTransaction(async (session) => {
      const current = await this.orders.findById(id, session);
      if (!current) throw new NotFoundError('Order not found');
      this.assertVisible(actor, current, to);
      if (current.orderStatus === to) return current;
      this.assertActorCanMove(actor, current, to);
      assertOrderTransition(current.orderStatus, to);
      const previous = current.orderStatus;
      current.orderStatus = to;
      await current.save({ session });
      if (to === 'COMPLETED') {
        await this.farmers.incrementSales(String(current.farmerId), current.subtotalPaise, session);
      }
      return Object.assign(current, { previous });
    });
    await this.audit.record({
      userId: actor.id,
      action: 'ORDER_STATUS_CHANGE',
      entity: 'Order',
      entityId: id,
      newValue: { orderStatus: to, orderNumber: order.orderNumber },
      meta,
    });
    await this.notifyStatus(order, to);
    logger.info({ event: 'ORDER_STATUS_CHANGED', orderId: order.orderNumber, userId: actor.id, status: to });
    return presentOrder(order);
  }

  async confirm(actor: AuthUser, id: string, meta: RequestMeta) {
    return this.transition(actor, id, 'CONFIRMED', meta);
  }

  async complete(actor: AuthUser, id: string, meta: RequestMeta) {
    return this.transition(actor, id, 'COMPLETED', meta);
  }

  async cancel(actor: AuthUser, id: string, meta: RequestMeta) {
    const order = await runInTransaction(async (session) => {
      const current = await this.orders.findById(id, session);
      if (!current) throw new NotFoundError('Order not found');
      this.assertVisible(actor, current);
      if (current.orderStatus === 'CANCELLED') return current;
      const admin = hasRole(actor, ADMIN_ROLES);
      if (!CANCELLABLE_ORDER_STATUSES.includes(current.orderStatus) && !admin) {
        throw new ConflictError('Order cannot be cancelled');
      }
      if (['PAID', 'PARTIALLY_PAID'].includes(current.paymentStatus) && !admin) {
        throw new UnprocessableError('Refund the payment before cancelling this order');
      }
      assertOrderTransition(current.orderStatus, 'CANCELLED');
      if (releasesInventory(current.orderStatus) && !current.inventoryReleased) {
        const listing = await this.listings.findById(String(current.listingId), session);
        if (listing && ['ACTIVE', 'PARTIALLY_SOLD', 'SOLD'].includes(listing.status) && listing.availableUntil > new Date()) {
          listing.availableQuantity = Math.min(listing.quantity, listing.availableQuantity + current.quantity);
          listing.status = listing.availableQuantity === listing.quantity ? 'ACTIVE' : 'PARTIALLY_SOLD';
          await listing.save({ session });
        }
        current.inventoryReleased = true;
      }
      current.orderStatus = 'CANCELLED';
      await current.save({ session });
      return current;
    });
    await this.audit.record({
      userId: actor.id,
      action: 'ORDER_STATUS_CHANGE',
      entity: 'Order',
      entityId: id,
      newValue: { orderStatus: 'CANCELLED', orderNumber: order.orderNumber },
      meta,
    });
    await domainBus.publish({
      event: 'ORDER_CANCELLED',
      userIds: [String(order.buyerId), String(order.farmerId)],
      title: 'Order cancelled',
      body: `Order ${order.orderNumber} was cancelled.`,
      entityType: 'order',
      entityId: String(order._id),
      dedupeKey: `order-cancelled:${String(order._id)}`,
    });
    return presentOrder(order);
  }

  async syncPayment(orderId: string, session?: ClientSession) {
    const order = await this.orders.findById(orderId, session);
    if (!order) return;
    const payments = await this.payments.findByOrder(orderId, session);
    const net = payments.reduce((sum, payment) => {
      if (payment.status === 'SUCCESS' || payment.status === 'PARTIAL_REFUND' || payment.status === 'REFUNDED') {
        return sum + payment.amountPaise - (payment.refundedPaise ?? 0);
      }
      return sum;
    }, 0);
    if (net <= 0 && payments.some((payment) => payment.status === 'REFUNDED')) order.paymentStatus = 'REFUNDED';
    else if (net <= 0 && payments.some((payment) => payment.status === 'PENDING')) order.paymentStatus = 'PENDING';
    else if (net <= 0) order.paymentStatus = 'UNPAID';
    else if (net >= order.totalAmountPaise) order.paymentStatus = 'PAID';
    else order.paymentStatus = 'PARTIALLY_PAID';
    await order.save({ session });
  }

  private async insertOrder(
    session: ClientSession,
    listing: NonNullable<Awaited<ReturnType<ListingRepository['findById']>>>,
    input: PlaceInput,
  ) {
    const year = new Date().getUTCFullYear();
    const seq = await this.counters.next(`order-${year}`, session);
    const orderNumber = `VEG-${year}-${String(seq).padStart(6, '0')}`;
    let commissionBps = 0;
    if (listing.preferredMarketId) {
      const market = await this.markets.findById(String(listing.preferredMarketId));
      commissionBps = market?.commissionBps ?? 0;
    }
    const amounts = calculateOrderAmounts({
      quantity: input.quantity,
      unitPricePaise: input.unitPricePaise,
      commissionBps,
      transportChargePaise: input.transportChargePaise ?? 0,
      taxBps: 0,
      discountPaise: input.discountPaise ?? 0,
    });
    const pickup = listing.pickupLocation
      ? { address: listing.pickupLocation.address, location: listing.pickupLocation.location }
      : {
          address: [listing.district, listing.state].filter(Boolean).join(', ') || 'Farm pickup',
          location: listing.location,
        };
    return this.orders.create(
      {
        orderNumber,
        buyerId: input.buyerId,
        farmerId: listing.farmerId,
        fpoId: listing.fpoId,
        listingId: listing._id,
        offerId: input.offerId,
        cropId: listing.cropId,
        quantity: input.quantity,
        unit: listing.unit,
        unitPricePaise: input.unitPricePaise,
        ...this.paiseFields(amounts),
        pickupLocation: pickup,
        deliveryLocation: input.deliveryLocation
          ? {
              address: input.deliveryLocation.address,
              landmark: input.deliveryLocation.landmark,
              location:
                input.deliveryLocation.longitude !== undefined && input.deliveryLocation.latitude !== undefined
                  ? { type: 'Point', coordinates: [input.deliveryLocation.longitude, input.deliveryLocation.latitude] }
                  : undefined,
            }
          : undefined,
        marketId: listing.preferredMarketId,
        scheduledPickupDate: input.scheduledPickupDate,
        scheduledDeliveryDate: input.scheduledDeliveryDate,
        paymentStatus: 'UNPAID',
        orderStatus: 'PENDING',
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
        inventoryReleased: false,
      },
      session,
    );
  }

  private paiseFields(amounts: ReturnType<typeof calculateOrderAmounts>) {
    return {
      subtotalPaise: amounts.subtotalPaise,
      commissionPaise: amounts.commissionPaise,
      transportChargePaise: amounts.transportChargePaise,
      taxPaise: amounts.taxPaise,
      discountPaise: amounts.discountPaise,
      totalAmountPaise: amounts.totalAmountPaise,
    };
  }

  private assertBuyer(actor: AuthUser) {
    if (!hasRole(actor, BUYER_ROLES)) throw new AuthorizationError('Only buyers can place orders');
    if (!actor.isPhoneVerified) throw new AuthorizationError('Verify your phone before placing an order');
  }

  private assertPurchasable(listing: { status: string; availableUntil: Date; farmerId: unknown }, buyerId: string) {
    if (!['ACTIVE', 'PARTIALLY_SOLD'].includes(listing.status) || listing.availableUntil <= new Date()) {
      throw new UnprocessableError('Listing is not available for purchase');
    }
    if (sameId(listing.farmerId, buyerId)) throw new UnprocessableError('You cannot buy your own listing');
  }

  private assertVisible(actor: AuthUser, order: { buyerId: unknown; farmerId: unknown }, to?: OrderStatus) {
    if (hasRole(actor, ADMIN_ROLES)) return;
    const logistics = to === 'READY_FOR_PICKUP' || to === 'PICKED_UP' || to === 'IN_TRANSIT' || to === 'DELIVERED';
    if (logistics && hasRole(actor, ['TRANSPORTER'])) return;
    if (!sameId(order.buyerId, actor.id) && !sameId(order.farmerId, actor.id)) {
      throw new AuthorizationError('You cannot access this order');
    }
  }

  private async requireVisible(actor: AuthUser, id: string) {
    const order = await this.orders.findById(id);
    if (!order) throw new NotFoundError('Order not found');
    this.assertVisible(actor, order);
    return order;
  }

  private assertActorCanMove(
    actor: AuthUser,
    order: { buyerId: unknown; farmerId: unknown; orderStatus: OrderStatus },
    to: OrderStatus,
  ) {
    if (hasRole(actor, ADMIN_ROLES)) return;
    const farmer = sameId(order.farmerId, actor.id);
    const buyer = sameId(order.buyerId, actor.id);
    if (to === 'CONFIRMED') {
      if (!farmer) throw new AuthorizationError('Only the farmer can confirm the order');
      return;
    }
    if (to === 'READY_FOR_PICKUP' || to === 'PICKED_UP' || to === 'IN_TRANSIT' || to === 'DELIVERED') {
      if (farmer || hasRole(actor, ['TRANSPORTER'])) return;
      throw new AuthorizationError('You cannot update delivery progress for this order');
    }
    if (to === 'COMPLETED') {
      if (!farmer && !buyer) throw new AuthorizationError();
      if (order.orderStatus !== 'DELIVERED') throw new ConflictError('Order can be completed after delivery');
      return;
    }
    if (to === 'DISPUTED' && (farmer || buyer)) return;
    throw new AuthorizationError('You cannot change the order to this status');
  }

  private async afterCreate(order: { _id: unknown; orderNumber: string; buyerId: unknown; farmerId: unknown }, meta: RequestMeta) {
    await this.audit.record({
      userId: String(order.buyerId),
      action: 'CREATE_ORDER',
      entity: 'Order',
      entityId: String(order._id),
      newValue: { orderNumber: order.orderNumber },
      meta,
    });
    await domainBus.publish({
      event: 'NEW_ORDER',
      userIds: [String(order.buyerId), String(order.farmerId)],
      title: 'New order',
      body: `Order ${order.orderNumber} has been created.`,
      entityType: 'order',
      entityId: String(order._id),
      dedupeKey: `new-order:${String(order._id)}`,
    });
    logger.info({ event: 'ORDER_CREATED', orderId: order.orderNumber, userId: String(order.buyerId) });
  }

  private async notifyStatus(order: { _id: unknown; orderNumber: string; buyerId: unknown; farmerId: unknown }, to: OrderStatus) {
    if (to === 'CONFIRMED') {
      await domainBus.publish({
        event: 'ORDER_CONFIRMED',
        userIds: [String(order.buyerId), String(order.farmerId)],
        title: 'Order confirmed',
        body: `Order ${order.orderNumber} is confirmed.`,
        entityType: 'order',
        entityId: String(order._id),
        dedupeKey: `order-confirmed:${String(order._id)}`,
      });
    }
  }
}
