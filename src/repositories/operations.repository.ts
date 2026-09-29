import type { FilterQuery } from 'mongoose';
import mongoose from 'mongoose';
import { AuditLogModel } from '../models/auditLog.model';
import { ConversationModel, MessageModel } from '../models/chat.model';
import { DailyStatModel } from '../models/dailyStat.model';
import { DeliveryModel } from '../models/delivery.model';
import { DisputeModel } from '../models/dispute.model';
import { DocumentModel } from '../models/document.model';
import { NotificationModel } from '../models/notification.model';
import { ReviewModel } from '../models/review.model';
import { OrderModel } from '../models/order.model';

export class DeliveryRepository {
  create(data: Record<string, unknown>) {
    return new DeliveryModel(data).save();
  }

  findById(id: string) {
    return DeliveryModel.findById(id).exec();
  }

  findByOrderId(orderId: string) {
    return DeliveryModel.findOne({ orderId }).exec();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      DeliveryModel.find(filter as never).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      DeliveryModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  count(filter: FilterQuery<unknown>) {
    return DeliveryModel.countDocuments(filter as never);
  }
}

export class NotificationRepository {
  create(data: Record<string, unknown>) {
    return new NotificationModel(data).save();
  }

  findById(id: string) {
    return NotificationModel.findById(id).exec();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      NotificationModel.find(filter as never).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      NotificationModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  markRead(id: string, userId: string) {
    return NotificationModel.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    ).exec();
  }

  markAllRead(userId: string) {
    return NotificationModel.updateMany(
      { userId, channel: 'IN_APP', isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    ).exec();
  }
}

export class ChatRepository {
  createConversation(data: Record<string, unknown>) {
    return new ConversationModel(data).save();
  }

  findConversation(id: string) {
    return ConversationModel.findById(id).exec();
  }

  findBetween(filter: FilterQuery<unknown>) {
    return ConversationModel.findOne(filter as never).exec();
  }

  async listConversations(userId: string, skip: number, limit: number) {
    const filter = { participants: userId };
    const [items, total] = await Promise.all([
      ConversationModel.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(limit).exec(),
      ConversationModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  createMessage(data: Record<string, unknown>) {
    return new MessageModel(data).save();
  }

  findMessage(id: string) {
    return MessageModel.findById(id).exec();
  }

  async listMessages(conversationId: string, skip: number, limit: number, sort: Record<string, 1 | -1>) {
    const filter = { conversationId };
    const [items, total] = await Promise.all([
      MessageModel.find(filter).sort(sort).skip(skip).limit(limit).exec(),
      MessageModel.countDocuments(filter),
    ]);
    return { items, total };
  }
}

export class ReviewRepository {
  create(data: Record<string, unknown>) {
    return new ReviewModel(data).save();
  }

  findByOrderAndReviewer(orderId: string, reviewerId: string) {
    return ReviewModel.findOne({ orderId, reviewerId }).exec();
  }

  async listForUser(userId: string, skip: number, limit: number) {
    const filter = { revieweeId: userId };
    const [items, total] = await Promise.all([
      ReviewModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      ReviewModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  async averageFor(userId: string) {
    const rows = await ReviewModel.aggregate<{ avg: number; count: number }>([
      { $match: { revieweeId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    return { avg: rows[0]?.avg ?? 0, count: rows[0]?.count ?? 0 };
  }
}

export class DisputeRepository {
  create(data: Record<string, unknown>) {
    return new DisputeModel(data).save();
  }

  findById(id: string) {
    return DisputeModel.findById(id).exec();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      DisputeModel.find(filter as never).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      DisputeModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }

  count(filter: FilterQuery<unknown> = {}) {
    return DisputeModel.countDocuments(filter as never);
  }
}

export class DocumentRepository {
  create(data: Record<string, unknown>) {
    return new DocumentModel(data).save();
  }

  findById(id: string) {
    return DocumentModel.findById(id).exec();
  }

  async listForUser(userId: string, skip: number, limit: number) {
    const filter = { uploadedBy: userId };
    const [items, total] = await Promise.all([
      DocumentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      DocumentModel.countDocuments(filter),
    ]);
    return { items, total };
  }

  updateById(id: string, data: Record<string, unknown>) {
    return DocumentModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }
}

export class AuditRepository {
  create(data: Record<string, unknown>) {
    return new AuditLogModel(data).save();
  }

  async list(filter: FilterQuery<unknown>, skip: number, limit: number) {
    const [items, total] = await Promise.all([
      AuditLogModel.find(filter as never).sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      AuditLogModel.countDocuments(filter as never),
    ]);
    return { items, total };
  }
}

export class StatsRepository {
  upsertDaily(date: string, data: Record<string, unknown>) {
    return DailyStatModel.updateOne({ date }, { $set: data }, { upsert: true }).exec();
  }

  topCrops(limit = 5) {
    return OrderModel.aggregate([
      { $match: { orderStatus: { $ne: 'CANCELLED' } } },
      { $group: { _id: '$cropId', volume: { $sum: '$quantity' }, gmvPaise: { $sum: '$totalAmountPaise' } } },
      { $sort: { volume: -1 } },
      { $limit: limit },
      { $lookup: { from: 'crops', localField: '_id', foreignField: '_id', as: 'crop' } },
      { $unwind: { path: '$crop', preserveNullAndEmptyArrays: true } },
    ]);
  }

  topMarkets(limit = 5) {
    return OrderModel.aggregate([
      { $match: { orderStatus: { $ne: 'CANCELLED' }, marketId: { $ne: null } } },
      { $group: { _id: '$marketId', orders: { $sum: 1 }, gmvPaise: { $sum: '$totalAmountPaise' } } },
      { $sort: { orders: -1 } },
      { $limit: limit },
      { $lookup: { from: 'markets', localField: '_id', foreignField: '_id', as: 'market' } },
      { $unwind: { path: '$market', preserveNullAndEmptyArrays: true } },
    ]);
  }

  recentOrderPrices(since: Date) {
    return OrderModel.aggregate<{
      _id: { cropId: unknown; marketId: unknown; unit: string };
      prices: number[];
    }>([
      {
        $match: {
          createdAt: { $gte: since },
          orderStatus: { $nin: ['CANCELLED'] },
          marketId: { $ne: null },
        },
      },
      {
        $group: {
          _id: { cropId: '$cropId', marketId: '$marketId', unit: '$unit' },
          prices: { $push: '$unitPricePaise' },
        },
      },
    ]);
  }
}
