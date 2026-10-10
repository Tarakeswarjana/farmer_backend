import { ADMIN_ROLES, BUYER_ROLES } from '../constants/roles';
import { DEFAULT_OFFER_TTL_MS } from '../constants/enums';
import { domainBus } from '../events/bus';
import { hasRole } from '../middlewares/authorize';
import { BuyerRepository, FarmerRepository } from '../repositories/profile.repository';
import { CounterRepository } from '../repositories/user.repository';
import { ListingRepository, OfferRepository, OrderRepository } from '../repositories/trade.repository';
import type { AuthUser } from '../types/auth';
import type { RequestMeta } from '../types/common';
import { AuthorizationError, ConflictError, NotFoundError, UnprocessableError, isDuplicateKey } from '../utils/errors';
import { sameId } from '../utils/ids';
import { logger } from '../utils/logger';
import { rupeesToPaise } from '../utils/money';
import { buildMeta, toPageQuery } from '../utils/pagination';
import { presentOffer, presentOrder } from '../utils/presenters';
import { runInTransaction } from '../utils/transaction';
import { AuditService } from './audit.service';
import { OrderService } from './order.service';

export class OfferService {
  constructor(
    private readonly offers: OfferRepository,
    private readonly listings: ListingRepository,
    private readonly orders: OrderRepository,
    private readonly buyers: BuyerRepository,
    private readonly farmers: FarmerRepository,
    private readonly counters: CounterRepository,
    private readonly orderService: OrderService,
    private readonly audit: AuditService,
  ) {}

  async create(
    actor: AuthUser,
    listingId: string,
    input: { offeredPrice: number; quantity: number; message?: string; expiresAt?: string },
    meta: RequestMeta,
  ) {
    if (!hasRole(actor, BUYER_ROLES)) throw new AuthorizationError('Only buyers can create offers');
    if (!actor.isPhoneVerified) throw new AuthorizationError('Verify your phone before making an offer');
    const buyer = await this.buyers.verifyIfPending(actor.id);
    if (!buyer?.isVerified) throw new AuthorizationError('Only verified buyers can make offers');
    const listing = await this.listings.findById(listingId);
    if (!listing) throw new NotFoundError('Listing not found');
    this.assertListingOpen(listing);
    if (!listing.allowBidding) throw new UnprocessableError('This listing does not accept bids');
    if (sameId(listing.farmerId, actor.id)) throw new UnprocessableError('You cannot bid on your own listing');
    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new UnprocessableError('Quantity must be a positive integer');
    }
    if (input.quantity > listing.availableQuantity) {
      throw new UnprocessableError('Quantity is greater than the available quantity');
    }
    const offeredPricePaise = rupeesToPaise(input.offeredPrice);
    if (!listing.isNegotiable && offeredPricePaise !== listing.expectedPricePaise) {
      throw new UnprocessableError('This listing only accepts its expected price');
    }
    if (listing.minimumPricePaise && offeredPricePaise < listing.minimumPricePaise) {
      throw new UnprocessableError('Offer is below the minimum price');
    }
    const existing = await this.offers.findOpen(listingId, actor.id);
    if (existing) throw new ConflictError('You already have an active offer on this listing');
    const farmer = await this.farmers.findByUserId(String(listing.farmerId));
    if (!farmer?.isVerified) throw new AuthorizationError('The farmer is not verified');
    try {
      const offer = await this.offers.create({
        listingId,
        buyerId: actor.id,
        farmerId: listing.farmerId,
        offeredPricePaise,
        quantity: input.quantity,
        message: input.message,
        status: 'PENDING',
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : new Date(Date.now() + DEFAULT_OFFER_TTL_MS),
      });
      await this.audit.record({
        userId: actor.id,
        action: 'CREATE_OFFER',
        entity: 'Offer',
        entityId: String(offer._id),
        newValue: { listingId, quantity: input.quantity },
        meta,
      });
      await domainBus.publish({
        event: 'NEW_OFFER',
        userIds: [String(listing.farmerId)],
        title: 'New offer',
        body: 'A buyer sent an offer on your listing.',
        entityType: 'offer',
        entityId: String(offer._id),
        dedupeKey: `new-offer:${String(offer._id)}`,
      });
      return presentOffer(offer);
    } catch (error) {
      if (isDuplicateKey(error)) throw new ConflictError('You already have an active offer on this listing');
      throw error;
    }
  }

  async listForListing(actor: AuthUser, listingId: string, query: { page?: number; limit?: number }) {
    const listing = await this.listings.findById(listingId);
    if (!listing) throw new NotFoundError('Listing not found');
    const owner = sameId(listing.farmerId, actor.id) || hasRole(actor, ADMIN_ROLES);
    const filter: Record<string, unknown> = { listingId };
    if (!owner) filter.buyerId = actor.id;
    const page = toPageQuery(query);
    const result = await this.offers.list(filter, page.skip, page.limit);
    return { items: result.items.map((item) => presentOffer(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async mine(actor: AuthUser, query: { page?: number; limit?: number; status?: string }) {
    const page = toPageQuery(query);
    const filter: Record<string, unknown> = { buyerId: actor.id };
    if (query.status) filter.status = query.status;
    const result = await this.offers.list(filter, page.skip, page.limit);
    return { items: result.items.map((item) => presentOffer(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async received(actor: AuthUser, query: { page?: number; limit?: number; status?: string }) {
    const page = toPageQuery(query);
    const filter: Record<string, unknown> = { farmerId: actor.id };
    if (query.status) filter.status = query.status;
    const result = await this.offers.list(filter, page.skip, page.limit);
    return { items: result.items.map((item) => presentOffer(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async accept(actor: AuthUser, id: string, meta: RequestMeta) {
    await this.counters.ensure(`order-${new Date().getUTCFullYear()}`);
    const order = await runInTransaction(async (session) => {
      const offer = await this.offers.findById(id, session);
      if (!offer) throw new NotFoundError('Offer not found');
      const isFarmer = sameId(offer.farmerId, actor.id);
      const isBuyer = sameId(offer.buyerId, actor.id);
      if (offer.status === 'ACCEPTED') {
        if (!isFarmer && !isBuyer && !hasRole(actor, ADMIN_ROLES)) throw new AuthorizationError();
        const existing = await this.orders.findByOfferId(id, session);
        if (!existing) throw new ConflictError('Accepted offer has no order');
        return existing;
      }
      if (offer.expiresAt <= new Date() || offer.status === 'EXPIRED') {
        offer.status = 'EXPIRED';
        await offer.save({ session });
        throw new ConflictError('Offer has expired');
      }
      if (isBuyer) {
        const farmerCountered = offer.status === 'COUNTERED' && offer.lastCounteredBy && !sameId(offer.lastCounteredBy, actor.id);
        if (!farmerCountered) throw new AuthorizationError('Only the listing owner can accept this offer');
      } else if (!isFarmer) {
        throw new AuthorizationError('Only the listing owner can accept this offer');
      }
      const farmerProfile = await this.farmers.findByUserId(String(offer.farmerId));
      if (!farmerProfile?.isVerified) throw new AuthorizationError('Only verified farmers can accept offers');
      const listing = await this.listings.findById(String(offer.listingId), session);
      if (!listing) throw new NotFoundError('Listing not found');
      this.assertListingOpen(listing);
      const locked = await this.offers.markAccepted(id, session);
      if (!locked) throw new ConflictError('Offer cannot be accepted');
      const reserved = await this.listings.reserve(String(listing._id), locked.quantity, session);
      if (!reserved) throw new ConflictError('Insufficient available quantity');
      reserved.status = reserved.availableQuantity === 0 ? 'SOLD' : 'PARTIALLY_SOLD';
      await reserved.save({ session });
      await this.offers.rejectUnfulfillable(String(listing._id), reserved.availableQuantity, id, session);
      return this.orderService.createFromOffer(session, listing, {
        buyerId: String(offer.buyerId),
        listingId: String(listing._id),
        quantity: locked.quantity,
        unitPricePaise: locked.offeredPricePaise,
        offerId: id,
      });
    });
    await this.audit.record({
      userId: actor.id,
      action: 'ACCEPT_OFFER',
      entity: 'Offer',
      entityId: id,
      newValue: { orderNumber: order.orderNumber },
      meta,
    });
    await domainBus.publish({
      event: 'OFFER_ACCEPTED',
      userIds: [String(order.buyerId)],
      title: 'Offer accepted',
      body: `Your offer was accepted. Order ${order.orderNumber} has been created.`,
      entityType: 'offer',
      entityId: id,
      dedupeKey: `offer-accepted:${id}`,
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
    logger.info({ event: 'OFFER_ACCEPTED', orderId: order.orderNumber, userId: actor.id });
    return presentOrder(order);
  }

  async reject(actor: AuthUser, id: string) {
    const offer = await this.offers.findById(id);
    if (!offer) throw new NotFoundError('Offer not found');
    if (!sameId(offer.farmerId, actor.id)) throw new AuthorizationError('Only the listing owner can reject offers');
    if (!['PENDING', 'COUNTERED'].includes(offer.status)) throw new ConflictError('Offer cannot be rejected');
    offer.status = 'REJECTED';
    await offer.save();
    await domainBus.publish({
      event: 'OFFER_REJECTED',
      userIds: [String(offer.buyerId)],
      title: 'Offer rejected',
      body: 'The farmer rejected your offer.',
      entityType: 'offer',
      entityId: id,
      dedupeKey: `offer-rejected:${id}`,
    });
    return presentOffer(offer);
  }

  async counter(
    actor: AuthUser,
    id: string,
    input: { offeredPrice: number; quantity: number; message?: string },
  ) {
    const offer = await this.offers.findById(id);
    if (!offer) throw new NotFoundError('Offer not found');
    if (offer.expiresAt <= new Date()) {
      offer.status = 'EXPIRED';
      await offer.save();
      throw new ConflictError('Offer has expired');
    }
    const isFarmer = sameId(offer.farmerId, actor.id);
    const isBuyer = sameId(offer.buyerId, actor.id);
    if (!isFarmer && !isBuyer) throw new AuthorizationError();
    if (!['PENDING', 'COUNTERED'].includes(offer.status)) throw new ConflictError('Offer cannot be countered');
    if (offer.status === 'PENDING' && !isFarmer) {
      throw new AuthorizationError('Only the listing owner can counter a new offer');
    }
    if (offer.lastCounteredBy && sameId(offer.lastCounteredBy, actor.id)) {
      throw new UnprocessableError('Wait for the other party to respond');
    }
    const listing = await this.listings.findById(String(offer.listingId));
    if (!listing) throw new NotFoundError('Listing not found');
    this.assertListingOpen(listing);
    if (!Number.isInteger(input.quantity) || input.quantity <= 0 || input.quantity > listing.availableQuantity) {
      throw new UnprocessableError('Quantity is greater than the available quantity');
    }
    const price = rupeesToPaise(input.offeredPrice);
    if (listing.minimumPricePaise && price < listing.minimumPricePaise) {
      throw new UnprocessableError('Offer is below the minimum price');
    }
    if (offer.originalPricePaise == null) offer.originalPricePaise = offer.offeredPricePaise;
    if (offer.originalQuantity == null) offer.originalQuantity = offer.quantity;
    offer.offeredPricePaise = price;
    offer.quantity = input.quantity;
    offer.status = 'COUNTERED';
    offer.lastCounteredBy = actor.id as unknown as typeof offer.lastCounteredBy;
    if (input.message) offer.message = input.message;
    offer.expiresAt = new Date(Date.now() + DEFAULT_OFFER_TTL_MS);
    await offer.save();
    const recipient = isFarmer ? String(offer.buyerId) : String(offer.farmerId);
    await domainBus.publish({
      event: 'NEW_OFFER',
      userIds: [recipient],
      title: 'Counter offer',
      body: 'An offer was countered. Review the new price and quantity.',
      entityType: 'offer',
      entityId: id,
      dedupeKey: `offer-counter:${id}:${offer.updatedAt?.getTime() ?? Date.now()}`,
    });
    return presentOffer(offer);
  }

  async cancel(actor: AuthUser, id: string) {
    const offer = await this.offers.findById(id);
    if (!offer) throw new NotFoundError('Offer not found');
    if (!sameId(offer.buyerId, actor.id) && !sameId(offer.farmerId, actor.id)) {
      throw new AuthorizationError();
    }
    if (!['PENDING', 'COUNTERED'].includes(offer.status)) throw new ConflictError('Offer cannot be cancelled');
    offer.status = 'CANCELLED';
    await offer.save();
    return presentOffer(offer);
  }

  private assertListingOpen(listing: { status: string; availableUntil: Date }) {
    if (!['ACTIVE', 'PARTIALLY_SOLD'].includes(listing.status) || listing.availableUntil <= new Date()) {
      throw new UnprocessableError('Expired or inactive listings cannot accept offers');
    }
  }
}
