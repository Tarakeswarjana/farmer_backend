import type { ClientSession, FilterQuery } from 'mongoose';
import { BuyerProfileModel } from '../models/buyerProfile.model';
import { FarmerProfileModel } from '../models/farmerProfile.model';
import { FpoModel } from '../models/fpo.model';
import { TransporterModel } from '../models/transporter.model';

async function nearby(
  model: typeof FarmerProfileModel | typeof BuyerProfileModel,
  filter: FilterQuery<unknown>,
  lng: number,
  lat: number,
  radius: number,
  skip: number,
  limit: number,
) {
  const items = await model.aggregate([
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
  const total = await model.countDocuments({
    ...(filter as Record<string, unknown>),
    location: { $geoWithin: { $centerSphere: [[lng, lat], radius / 6_378_100] } },
  } as never);
  return { items, total };
}

export class FarmerRepository {
  create(data: Record<string, unknown>) {
    return new FarmerProfileModel(data).save();
  }

  findById(id: string) {
    return FarmerProfileModel.findById(id).exec();
  }

  findByUserId(userId: string) {
    return FarmerProfileModel.findOne({ userId }).exec();
  }

  updateById(id: string, data: Record<string, unknown>) {
    return FarmerProfileModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  nearby(lng: number, lat: number, radius: number, skip: number, limit: number, verifiedOnly = true) {
    return nearby(
      FarmerProfileModel,
      verifiedOnly ? { isVerified: true } : {},
      lng,
      lat,
      radius,
      skip,
      limit,
    );
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number, sort: Record<string, 1 | -1>) {
    const [items, total] = await Promise.all([
      FarmerProfileModel.find(filter as never).sort(sort).skip(skip).limit(limit).exec(),
      FarmerProfileModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  count(filter: FilterQuery<unknown>) {
    return FarmerProfileModel.countDocuments(filter as never);
  }

  incrementSales(userId: string, amountPaise: number, session?: ClientSession) {
    const query = FarmerProfileModel.updateOne(
      { userId },
      { $inc: { totalOrders: 1, totalSalesPaise: amountPaise } },
    );
    if (session) {
      query.session(session);
    }
    return query.exec();
  }

  async setRating(userId: string, rating: number, ratingCount: number) {
    return FarmerProfileModel.updateOne({ userId }, { $set: { rating, ratingCount } }).exec();
  }
}

export class BuyerRepository {
  create(data: Record<string, unknown>) {
    return new BuyerProfileModel(data).save();
  }

  findById(id: string) {
    return BuyerProfileModel.findById(id).exec();
  }

  findByUserId(userId: string) {
    return BuyerProfileModel.findOne({ userId }).exec();
  }

  updateById(id: string, data: Record<string, unknown>) {
    return BuyerProfileModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  nearby(lng: number, lat: number, radius: number, skip: number, limit: number) {
    return nearby(BuyerProfileModel, { isVerified: true }, lng, lat, radius, skip, limit);
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number, sort: Record<string, 1 | -1>) {
    const [items, total] = await Promise.all([
      BuyerProfileModel.find(filter as never).sort(sort).skip(skip).limit(limit).exec(),
      BuyerProfileModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  count(filter: FilterQuery<unknown>) {
    return BuyerProfileModel.countDocuments(filter as never);
  }

  setRating(userId: string, rating: number, ratingCount: number) {
    return BuyerProfileModel.updateOne({ userId }, { $set: { rating, ratingCount } }).exec();
  }
}

export class FpoRepository {
  create(data: Record<string, unknown>) {
    return new FpoModel(data).save();
  }

  findById(id: string) {
    return FpoModel.findById(id).exec();
  }

  updateById(id: string, data: Record<string, unknown>) {
    return FpoModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number, sort: Record<string, 1 | -1>) {
    const [items, total] = await Promise.all([
      FpoModel.find(filter as never).sort(sort).skip(skip).limit(limit).exec(),
      FpoModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  count(filter: FilterQuery<unknown> = {}) {
    return FpoModel.countDocuments(filter as never);
  }
}

export class TransporterRepository {
  create(data: Record<string, unknown>) {
    return new TransporterModel(data).save();
  }

  findById(id: string) {
    return TransporterModel.findById(id).exec();
  }

  findByUserId(userId: string) {
    return TransporterModel.findOne({ userId }).exec();
  }

  updateById(id: string, data: Record<string, unknown>) {
    return TransporterModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }
}
