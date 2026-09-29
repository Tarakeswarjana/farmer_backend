import type { ClientSession, FilterQuery } from 'mongoose';
import type { OtpPurpose } from '../constants/enums';
import { CounterModel } from '../models/counter.model';
import { OtpModel } from '../models/otp.model';
import { RefreshTokenModel } from '../models/refreshToken.model';
import { UserModel } from '../models/user.model';

export class UserRepository {
  findById(id: string) {
    return UserModel.findById(id).exec();
  }

  findByPhone(phone: string) {
    return UserModel.findOne({ phone }).exec();
  }

  findByEmail(email: string) {
    return UserModel.findOne({ email }).exec();
  }

  findForAuth(identifier: { phone?: string; email?: string }) {
    return UserModel.findOne(identifier).select('+password').exec();
  }

  create(data: Record<string, unknown>) {
    return new UserModel(data).save();
  }

  updateById(id: string, data: Record<string, unknown>) {
    return UserModel.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number, sort: Record<string, 1 | -1>) {
    const [items, total] = await Promise.all([
      UserModel.find(filter as never)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .exec(),
      UserModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  count(filter: FilterQuery<unknown>) {
    return UserModel.countDocuments(filter as never);
  }
}

export class RefreshTokenRepository {
  create(data: Record<string, unknown>) {
    return new RefreshTokenModel(data).save();
  }

  findByJti(jti: string) {
    return RefreshTokenModel.findOne({ jti }).exec();
  }

  revoke(jti: string, replacedByJti?: string) {
    return RefreshTokenModel.findOneAndUpdate(
      { jti, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), replacedByJti } },
      { new: false },
    ).exec();
  }

  revokeAll(userId: string) {
    return RefreshTokenModel.updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    ).exec();
  }
}

export class OtpRepository {
  async issue(userId: string, purpose: OtpPurpose, codeHash: string, expiresAt: Date) {
    await OtpModel.updateMany(
      { userId, purpose, consumedAt: { $exists: false } },
      { $set: { consumedAt: new Date() } },
    ).exec();
    return OtpModel.create({ userId, purpose, codeHash, expiresAt, attempts: 0 });
  }

  findActive(userId: string, purpose: OtpPurpose) {
    return OtpModel.findOne({
      userId,
      purpose,
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    })
      .sort({ createdAt: -1 })
      .exec();
  }

  incrementAttempts(id: string) {
    return OtpModel.updateOne({ _id: id }, { $inc: { attempts: 1 } }).exec();
  }

  consume(id: string) {
    return OtpModel.updateOne({ _id: id }, { $set: { consumedAt: new Date() } }).exec();
  }

  deleteExpired(before: Date) {
    return OtpModel.deleteMany({
      $or: [{ expiresAt: { $lt: before } }, { consumedAt: { $lt: before } }],
    }).exec();
  }
}

export class CounterRepository {
  ensure(key: string) {
    return CounterModel.updateOne({ _id: key }, { $setOnInsert: { seq: 0 } }, { upsert: true }).exec();
  }

  async next(key: string, session: ClientSession) {
    const counter = await CounterModel.findOneAndUpdate(
      { _id: key },
      { $inc: { seq: 1 } },
      { new: true, session },
    ).exec();
    return counter?.seq ?? 1;
  }
}
