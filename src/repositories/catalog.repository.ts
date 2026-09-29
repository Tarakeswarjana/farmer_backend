import type { FilterQuery } from 'mongoose';
import { CropModel } from '../models/crop.model';
import { MarketModel } from '../models/market.model';
import { MarketPriceModel } from '../models/marketPrice.model';

export class CropRepository {
  create(data: Record<string, unknown>) {
    return new CropModel(data).save();
  }

  findById(id: string) {
    return CropModel.findById(id).exec();
  }

  findByNameKey(nameKey: string) {
    return CropModel.findOne({ nameKey }).exec();
  }

  updateById(id: string, data: Record<string, unknown>) {
    return CropModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number, sort: Record<string, 1 | -1>) {
    const [items, total] = await Promise.all([
      CropModel.find(filter as never).sort(sort).skip(skip).limit(limit).exec(),
      CropModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }
}

export class MarketRepository {
  create(data: Record<string, unknown>) {
    return new MarketModel(data).save();
  }

  findById(id: string) {
    return MarketModel.findById(id).exec();
  }

  findByCode(marketCode: string) {
    return MarketModel.findOne({ marketCode: marketCode.toUpperCase() }).exec();
  }

  updateById(id: string, data: Record<string, unknown>) {
    return MarketModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number, sort: Record<string, 1 | -1>) {
    const [items, total] = await Promise.all([
      MarketModel.find(filter as never).sort(sort).skip(skip).limit(limit).exec(),
      MarketModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  async nearby(lng: number, lat: number, radius: number, skip: number, limit: number) {
    const filter = { isActive: true };
    const items = await MarketModel.aggregate([
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
    const total = await MarketModel.countDocuments({
      ...filter,
      location: { $geoWithin: { $centerSphere: [[lng, lat], radius / 6_378_100] } },
    });
    return { items, total };
  }

  count(filter: FilterQuery<unknown> = {}) {
    return MarketModel.countDocuments(filter as never);
  }
}

export class MarketPriceRepository {
  create(data: Record<string, unknown>) {
    return new MarketPriceModel(data).save();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      MarketPriceModel.find(filter as never).sort({ date: -1 }).skip(skip).limit(limit).exec(),
      MarketPriceModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  latestFor(cropId: string, marketId?: string, limit = 5) {
    const filter: Record<string, unknown> = { cropId };
    if (marketId) {
      filter.marketId = marketId;
    }
    return MarketPriceModel.find(filter).sort({ date: -1 }).limit(limit).exec();
  }

  upsertDerived(filter: Record<string, unknown>, data: Record<string, unknown>) {
    return MarketPriceModel.updateOne(filter, { $set: data }, { upsert: true }).exec();
  }
}
