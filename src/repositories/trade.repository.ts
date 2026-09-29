import type { ClientSession, FilterQuery } from 'mongoose';
import { ListingModel } from '../models/listing.model';
import { OfferModel } from '../models/offer.model';
import { OrderModel } from '../models/order.model';
import { PaymentModel } from '../models/payment.model';
import { RequirementModel } from '../models/requirement.model';
import { WebhookEventModel } from '../models/webhookEvent.model';

export class ListingRepository {
  create(data: Record<string, unknown>) {
    return new ListingModel(data).save();
  }

  findById(id: string, session?: ClientSession) {
    const query = ListingModel.findById(id);
    if (session) query.session(session);
    return query.exec();
  }

  async search(filter: FilterQuery<unknown>, skip: number, limit: number, sort: Record<string, 1 | -1>) {
    const [items, total] = await Promise.all([
      ListingModel.find(filter as never).sort(sort).skip(skip).limit(limit).exec(),
      ListingModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  list(filter: FilterQuery<unknown>, skip: number, limit: number, sort: Record<string, 1 | -1> = { createdAt: -1 }) {
    return this.search(filter, skip, limit, sort);
  }

  async nearby(
    filter: FilterQuery<unknown>,
    lng: number,
    lat: number,
    radius: number,
    skip: number,
    limit: number,
  ) {
    const items = await ListingModel.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distanceMeters',
          maxDistance: radius,
          spherical: true,
          query: filter,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);
    const total = await ListingModel.countDocuments({
      ...(filter as Record<string, unknown>),
      location: { $geoWithin: { $centerSphere: [[lng, lat], radius / 6_378_100] } },
    } as never);
    return { items, total };
  }

  reserve(id: string, quantity: number, session: ClientSession) {
    return ListingModel.findOneAndUpdate(
      {
        _id: id,
        availableQuantity: { $gte: quantity },
        status: { $in: ['ACTIVE', 'PARTIALLY_SOLD'] },
        availableUntil: { $gt: new Date() },
      },
      { $inc: { availableQuantity: -quantity } },
      { new: true, session },
    ).exec();
  }

  expireDue(now: Date) {
    return ListingModel.updateMany(
      { status: { $in: ['ACTIVE', 'PARTIALLY_SOLD'] }, availableUntil: { $lt: now } },
      { $set: { status: 'EXPIRED' } },
    ).exec();
  }

  count(filter: FilterQuery<unknown>) {
    return ListingModel.countDocuments(filter as never);
  }

  findExpiring(from: Date, to: Date) {
    return ListingModel.find({
      status: { $in: ['ACTIVE', 'PARTIALLY_SOLD'] },
      availableUntil: { $gte: from, $lte: to },
    }).exec();
  }
}

export class OfferRepository {
  create(data: Record<string, unknown>) {
    return new OfferModel(data).save();
  }

  findById(id: string, session?: ClientSession) {
    const query = OfferModel.findById(id);
    if (session) query.session(session);
    return query.exec();
  }

  markAccepted(id: string, session: ClientSession) {
    return OfferModel.findOneAndUpdate(
      { _id: id, status: { $in: ['PENDING', 'COUNTERED'] }, expiresAt: { $gt: new Date() } },
      { $set: { status: 'ACCEPTED' } },
      { new: true, session },
    ).exec();
  }

  findOpen(listingId: string, buyerId: string) {
    return OfferModel.findOne({
      listingId,
      buyerId,
      status: { $in: ['PENDING', 'COUNTERED'] },
    }).exec();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      OfferModel.find(filter as never).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      OfferModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  rejectUnfulfillable(listingId: string, remaining: number, exceptOfferId: string, session: ClientSession) {
    return OfferModel.updateMany(
      {
        listingId,
        _id: { $ne: exceptOfferId },
        status: { $in: ['PENDING', 'COUNTERED'] },
        quantity: { $gt: remaining },
      },
      { $set: { status: 'REJECTED' } },
      { session },
    ).exec();
  }

  rejectOpenForListing(listingId: string, session?: ClientSession) {
    const query = OfferModel.updateMany(
      { listingId, status: { $in: ['PENDING', 'COUNTERED'] } },
      { $set: { status: 'REJECTED' } },
    );
    if (session) query.session(session);
    return query.exec();
  }

  expireDue(now: Date) {
    return OfferModel.updateMany(
      { status: { $in: ['PENDING', 'COUNTERED'] }, expiresAt: { $lt: now } },
      { $set: { status: 'EXPIRED' } },
    ).exec();
  }
}

export class OrderRepository {
  create(data: Record<string, unknown>, session?: ClientSession) {
    return OrderModel.create([data as never], { session }).then((docs) => docs[0]);
  }

  findById(id: string, session?: ClientSession) {
    const query = OrderModel.findById(id);
    if (session) query.session(session);
    return query.exec();
  }

  findByNumber(orderNumber: string) {
    return OrderModel.findOne({ orderNumber }).exec();
  }

  findByOfferId(offerId: string, session?: ClientSession) {
    const query = OrderModel.findOne({ offerId });
    if (session) query.session(session);
    return query.exec();
  }

  findByIdempotency(buyerId: string, idempotencyKey: string) {
    return OrderModel.findOne({ buyerId, idempotencyKey }).exec();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number, sort: Record<string, 1 | -1>) {
    const [items, total] = await Promise.all([
      OrderModel.find(filter as never).sort(sort).skip(skip).limit(limit).exec(),
      OrderModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  count(filter: FilterQuery<unknown>) {
    return OrderModel.countDocuments(filter as never);
  }

  sumGmv(filter: FilterQuery<unknown>) {
    return OrderModel.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: '$totalAmountPaise' } } },
    ]);
  }
}

export class RequirementRepository {
  create(data: Record<string, unknown>) {
    return new RequirementModel(data).save();
  }

  findById(id: string) {
    return RequirementModel.findById(id).exec();
  }

  updateById(id: string, data: Record<string, unknown>) {
    return RequirementModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number, sort: Record<string, 1 | -1>) {
    const [items, total] = await Promise.all([
      RequirementModel.find(filter as never).sort(sort).skip(skip).limit(limit).exec(),
      RequirementModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  openForCrop(cropId: string, limit = 20) {
    return RequirementModel.find({ cropId, status: 'OPEN', expiresAt: { $gt: new Date() } })
      .limit(limit)
      .exec();
  }

  expireDue(now: Date) {
    return RequirementModel.updateMany(
      { status: 'OPEN', expiresAt: { $lt: now } },
      { $set: { status: 'EXPIRED' } },
    ).exec();
  }
}

export class PaymentRepository {
  create(data: Record<string, unknown>) {
    return new PaymentModel(data).save();
  }

  findById(id: string, session?: ClientSession) {
    const query = PaymentModel.findById(id);
    if (session) query.session(session);
    return query.exec();
  }

  findByIdempotency(buyerId: string, idempotencyKey: string) {
    return PaymentModel.findOne({ buyerId, idempotencyKey }).exec();
  }

  findByOrder(orderId: string, session?: ClientSession) {
    const query = PaymentModel.find({ orderId });
    if (session) query.session(session);
    return query.exec();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      PaymentModel.find(filter as never).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      PaymentModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  count(filter: FilterQuery<unknown>) {
    return PaymentModel.countDocuments(filter as never);
  }
}

export class WebhookRepository {
  find(provider: string, eventId: string, session?: ClientSession) {
    const query = WebhookEventModel.findOne({ provider, eventId });
    if (session) query.session(session);
    return query.exec();
  }

  create(data: Record<string, unknown>, session?: ClientSession) {
    return WebhookEventModel.create([data as never], { session }).then((docs) => docs[0]);
  }
}
