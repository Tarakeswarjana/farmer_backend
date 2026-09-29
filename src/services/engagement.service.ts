import { ADMIN_ROLES } from '../constants/roles';
import { hasRole } from '../middlewares/authorize';
import { publishRealtime } from '../events/realtime';
import { BuyerRepository, FarmerRepository } from '../repositories/profile.repository';
import { ChatRepository, DisputeRepository, DocumentRepository, ReviewRepository } from '../repositories/operations.repository';
import { OrderRepository } from '../repositories/trade.repository';
import type { AuthUser } from '../types/auth';
import type { StorageProvider } from '../interfaces/storage-provider';
import { AuthorizationError, ConflictError, NotFoundError, UnprocessableError, isDuplicateKey } from '../utils/errors';
import { sameId } from '../utils/ids';
import { buildMeta, buildSort, toPageQuery } from '../utils/pagination';
import { presentConversation, presentDispute, presentDocument, presentMessage, presentReview } from '../utils/presenters';
import { assertOrderTransition } from '../utils/orderState';

export class ChatService {
  constructor(private readonly chat: ChatRepository) {}

  async open(actor: AuthUser, input: { participantId: string; listingId?: string; orderId?: string }) {
    if (input.participantId === actor.id) throw new UnprocessableError('Choose another participant');
    const ids = [actor.id, input.participantId].sort();
    const filter: Record<string, unknown> = { participants: { $all: ids, $size: 2 } };
    if (input.listingId) filter.listingId = input.listingId;
    if (input.orderId) filter.orderId = input.orderId;
    const existing = await this.chat.findBetween(filter);
    if (existing) return presentConversation(existing);
    const created = await this.chat.createConversation({
      participants: ids,
      listingId: input.listingId,
      orderId: input.orderId,
    });
    return presentConversation(created);
  }

  async list(actor: AuthUser, query: { page?: number; limit?: number }) {
    const page = toPageQuery(query);
    const result = await this.chat.listConversations(actor.id, page.skip, page.limit);
    return { items: result.items.map((item) => presentConversation(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async messages(actor: AuthUser, id: string, query: { page?: number; limit?: number; sortOrder?: 'asc' | 'desc' }) {
    await this.requireParticipant(actor, id);
    const page = toPageQuery({ ...query, sortOrder: query.sortOrder ?? 'asc' });
    const sort = buildSort('createdAt', page.sortOrder, ['createdAt'], 'createdAt');
    const result = await this.chat.listMessages(id, page.skip, page.limit, sort);
    return { items: result.items.map((item) => presentMessage(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async postMessage(actor: AuthUser, id: string, input: { message: string; messageType?: string; attachments?: string[] }) {
    const conversation = await this.requireParticipant(actor, id);
    const message = await this.chat.createMessage({
      conversationId: id,
      senderId: actor.id,
      message: input.message,
      messageType: input.messageType ?? 'TEXT',
      attachments: input.attachments ?? [],
      isRead: false,
    });
    conversation.lastMessage = input.message.slice(0, 180);
    conversation.lastMessageAt = new Date();
    await conversation.save();
    publishRealtime({
      type: 'message.created',
      conversationId: id,
      messageId: String(message._id),
      participantIds: conversation.participants.map((item) => String(item)),
    });
    return presentMessage(message);
  }

  async markRead(actor: AuthUser, messageId: string) {
    const message = await this.chat.findMessage(messageId);
    if (!message) throw new NotFoundError('Message not found');
    await this.requireParticipant(actor, String(message.conversationId));
    message.isRead = true;
    message.readAt = new Date();
    await message.save();
    return presentMessage(message);
  }

  private async requireParticipant(actor: AuthUser, conversationId: string) {
    const conversation = await this.chat.findConversation(conversationId);
    if (!conversation) throw new NotFoundError('Conversation not found');
    if (!conversation.participants.some((item) => sameId(item, actor.id))) {
      throw new AuthorizationError('You are not part of this conversation');
    }
    return conversation;
  }
}

export class ReviewService {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly orders: OrderRepository,
    private readonly farmers: FarmerRepository,
    private readonly buyers: BuyerRepository,
  ) {}

  async create(actor: AuthUser, input: { orderId: string; rating: number; comment?: string }) {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new UnprocessableError('Rating must be an integer between 1 and 5');
    }
    const order = await this.orders.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');
    if (order.orderStatus !== 'COMPLETED') throw new UnprocessableError('Only completed orders can be reviewed');
    const reviewerIsBuyer = sameId(order.buyerId, actor.id);
    const reviewerIsFarmer = sameId(order.farmerId, actor.id);
    if (!reviewerIsBuyer && !reviewerIsFarmer) throw new AuthorizationError('You cannot review this order');
    const revieweeId = reviewerIsBuyer ? String(order.farmerId) : String(order.buyerId);
    if (revieweeId === actor.id) throw new UnprocessableError('You cannot review yourself');
    try {
      const review = await this.reviews.create({
        orderId: order._id,
        reviewerId: actor.id,
        revieweeId,
        rating: input.rating,
        comment: input.comment,
      });
      const stats = await this.reviews.averageFor(revieweeId);
      const rounded = Math.round(stats.avg * 10) / 10;
      await this.farmers.setRating(revieweeId, rounded, stats.count);
      await this.buyers.setRating(revieweeId, rounded, stats.count);
      return presentReview(review);
    } catch (error) {
      if (isDuplicateKey(error)) throw new ConflictError('You have already reviewed this order');
      throw error;
    }
  }

  async forUser(userId: string, query: { page?: number; limit?: number }) {
    const page = toPageQuery(query);
    const result = await this.reviews.listForUser(userId, page.skip, page.limit);
    return { items: result.items.map((item) => presentReview(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }
}

export class DisputeService {
  constructor(
    private readonly disputes: DisputeRepository,
    private readonly orders: OrderRepository,
  ) {}

  async create(actor: AuthUser, input: { orderId: string; reason: string; description: string; images?: string[] }) {
    const order = await this.orders.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');
    const buyer = sameId(order.buyerId, actor.id);
    const farmer = sameId(order.farmerId, actor.id);
    if (!buyer && !farmer) throw new AuthorizationError('Only order parties can raise a dispute');
    if (['CANCELLED'].includes(order.orderStatus)) throw new ConflictError('This order cannot be disputed');
    const dispute = await this.disputes.create({
      orderId: order._id,
      raisedBy: actor.id,
      against: buyer ? order.farmerId : order.buyerId,
      reason: input.reason,
      description: input.description,
      images: input.images ?? [],
      status: 'OPEN',
    });
    if (order.orderStatus !== 'DISPUTED' && order.orderStatus !== 'COMPLETED') {
      try {
        assertOrderTransition(order.orderStatus, 'DISPUTED');
        order.orderStatus = 'DISPUTED';
        await order.save();
      } catch {
        order.orderStatus = 'DISPUTED';
        await order.save();
      }
    }
    return presentDispute(dispute);
  }

  async list(actor: AuthUser, query: { page?: number; limit?: number; status?: string }) {
    const page = toPageQuery(query);
    const filter: Record<string, unknown> = hasRole(actor, ADMIN_ROLES)
      ? {}
      : { $or: [{ raisedBy: actor.id }, { against: actor.id }] };
    if (query.status) filter.status = query.status;
    const result = await this.disputes.list(filter, page.skip, page.limit);
    return { items: result.items.map((item) => presentDispute(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async get(actor: AuthUser, id: string) {
    const dispute = await this.disputes.findById(id);
    if (!dispute) throw new NotFoundError('Dispute not found');
    const allowed = hasRole(actor, ADMIN_ROLES) || sameId(dispute.raisedBy, actor.id) || sameId(dispute.against, actor.id);
    if (!allowed) throw new AuthorizationError();
    return presentDispute(dispute);
  }

  async resolve(actor: AuthUser, id: string, input: { status: 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED'; resolution?: string }) {
    const dispute = await this.disputes.findById(id);
    if (!dispute) throw new NotFoundError('Dispute not found');
    if (input.status !== 'UNDER_REVIEW' && !input.resolution) {
      throw new UnprocessableError('A resolution note is required');
    }
    dispute.status = input.status;
    dispute.resolution = input.resolution;
    if (input.status === 'RESOLVED' || input.status === 'REJECTED') {
      dispute.resolvedBy = actor.id as unknown as typeof dispute.resolvedBy;
      dispute.resolvedAt = new Date();
    }
    await dispute.save();
    return presentDispute(dispute);
  }
}

export class DocumentService {
  constructor(
    private readonly documents: DocumentRepository,
    private readonly storage: StorageProvider,
    private readonly farmers: FarmerRepository,
    private readonly buyers: BuyerRepository,
  ) {}

  async upload(actor: AuthUser, file: Express.Multer.File, input: { documentType: string; ownerType: 'FARMER' | 'BUYER' | 'FPO' | 'USER' }) {
    const stored = await this.storage.upload({
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
      folder: 'documents',
      isPrivate: true,
    });
    const document = await this.documents.create({
      fileUrl: stored.fileUrl || `stored://${stored.fileKey}`,
      fileKey: stored.fileKey,
      fileName: file.originalname,
      mimeType: file.mimetype,
      uploadedBy: actor.id,
      documentType: input.documentType,
      ownerType: input.ownerType,
      storage: this.storage.name,
    });
    document.fileUrl = `/api/v1/documents/${String(document._id)}/download`;
    await document.save();
    if (input.ownerType === 'FARMER') {
      const profile = await this.farmers.findByUserId(actor.id);
      if (profile) {
        profile.documents.push({ documentId: document._id, documentType: input.documentType });
        await profile.save();
      }
    }
    if (input.ownerType === 'BUYER') {
      const profile = await this.buyers.findByUserId(actor.id);
      if (profile) {
        profile.documents.push({ documentId: document._id, documentType: input.documentType });
        await profile.save();
      }
    }
    return presentDocument(document);
  }

  async list(actor: AuthUser, query: { page?: number; limit?: number }) {
    const page = toPageQuery(query);
    const result = await this.documents.listForUser(actor.id, page.skip, page.limit);
    return { items: result.items.map((item) => presentDocument(item)), meta: buildMeta(page.page, page.limit, result.total) };
  }

  async read(actor: AuthUser, id: string) {
    const document = await this.documents.findById(id);
    if (!document) throw new NotFoundError('Document not found');
    if (!sameId(document.uploadedBy, actor.id) && !hasRole(actor, ADMIN_ROLES)) {
      throw new AuthorizationError();
    }
    const bytes = await this.storage.read(document.fileKey);
    return { document: presentDocument(document), bytes };
  }
}
