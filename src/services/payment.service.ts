import type { ClientSession } from 'mongoose';
import { ADMIN_ROLES } from '../constants/roles';
import type { PaymentMethod, PaymentProviderName, PaymentStatus } from '../constants/enums';
import { domainBus } from '../events/bus';
import { hasRole } from '../middlewares/authorize';
import type { PaymentProvider } from '../interfaces/payment-provider';
import type { ParsedWebhookEvent } from '../interfaces/payment-provider';
import { selectPaymentProvider } from '../providers/payment';
import { OrderRepository, PaymentRepository, WebhookRepository } from '../repositories/trade.repository';
import type { AuthUser } from '../types/auth';
import type { RequestMeta } from '../types/common';
import { randomId, signaturesMatch, signPayload } from '../utils/crypto';
import { AuthenticationError, AuthorizationError, BadRequestError, ConflictError, NotFoundError, UnprocessableError, isDuplicateKey } from '../utils/errors';
import { sameId } from '../utils/ids';
import { logger } from '../utils/logger';
import { rupeesToPaise } from '../utils/money';
import { presentPayment } from '../utils/presenters';
import { sha256 } from '../utils/crypto';
import { runInTransaction } from '../utils/transaction';
import { AuditService } from './audit.service';
import { OrderService } from './order.service';

interface CreatePaymentInput {
  orderId: string;
  amount?: number;
  method: PaymentMethod;
  provider?: PaymentProviderName;
  idempotencyKey?: string;
}

export class PaymentService {
  constructor(
    private readonly payments: PaymentRepository,
    private readonly orders: OrderRepository,
    private readonly webhooks: WebhookRepository,
    private readonly providers: PaymentProvider[],
    private readonly orderService: OrderService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthUser, input: CreatePaymentInput, meta: RequestMeta) {
    const order = await this.orders.findById(input.orderId);
    if (!order) throw new NotFoundError('Order not found');
    if (!sameId(order.buyerId, actor.id) && !hasRole(actor, ADMIN_ROLES)) {
      throw new AuthorizationError('Only the buyer can create a payment');
    }
    if (order.orderStatus === 'CANCELLED') throw new ConflictError('Cancelled orders cannot be paid');
    const amountPaise = input.amount ? rupeesToPaise(input.amount) : order.totalAmountPaise;
    if (amountPaise <= 0 || amountPaise > order.totalAmountPaise) {
      throw new UnprocessableError('Payment amount is invalid for this order');
    }
    const requestHash = sha256(JSON.stringify({ orderId: input.orderId, amountPaise, method: input.method, provider: input.provider ?? '' }));
    if (input.idempotencyKey) {
      const existing = await this.payments.findByIdempotency(actor.id, input.idempotencyKey);
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new ConflictError('Idempotency key was already used for a different payment');
        }
        return { payment: presentPayment(existing), providerPayload: existing.metadata ?? {} };
      }
    }
    const provider = selectPaymentProvider(this.providers, input.method, input.provider);
    try {
      const payment = await this.payments.create({
        orderId: order._id,
        buyerId: actor.id,
        amountPaise,
        currency: 'INR',
        method: input.method,
        provider: provider.name,
        status: 'PENDING',
        idempotencyKey: input.idempotencyKey,
        requestHash,
        metadata: {},
      });
      const created = await provider.createPayment({
        paymentId: String(payment._id),
        orderId: String(order._id),
        orderNumber: order.orderNumber,
        amountPaise,
        currency: 'INR',
        method: input.method,
        customerPhone: actor.phone,
      });
      payment.provider = created.provider;
      payment.providerOrderId = created.providerOrderId;
      payment.metadata = created.providerPayload;
      await payment.save();
      if (order.paymentStatus === 'UNPAID') {
        order.paymentStatus = 'PENDING';
        await order.save();
      }
      await this.audit.record({
        userId: actor.id,
        action: 'PAYMENT',
        entity: 'Payment',
        entityId: String(payment._id),
        newValue: { status: 'PENDING', orderNumber: order.orderNumber },
        meta,
      });
      return { payment: presentPayment(payment), providerPayload: created.providerPayload };
    } catch (error) {
      if (input.idempotencyKey && isDuplicateKey(error)) {
        const existing = await this.payments.findByIdempotency(actor.id, input.idempotencyKey);
        if (existing) return { payment: presentPayment(existing), providerPayload: existing.metadata ?? {} };
      }
      throw error;
    }
  }

  async verify(actor: AuthUser, input: { paymentId: string; providerPaymentId?: string; signature?: string }) {
    const payment = await this.payments.findById(input.paymentId);
    if (!payment) throw new NotFoundError('Payment not found');
    const order = await this.orders.findById(String(payment.orderId));
    if (!order) throw new NotFoundError('Order not found');
    const allowed = sameId(order.buyerId, actor.id) || sameId(order.farmerId, actor.id) || hasRole(actor, ADMIN_ROLES);
    if (!allowed) throw new AuthorizationError();
    if (payment.status === 'SUCCESS') return presentPayment(payment);
    const provider = this.providers.find((item) => item.name === payment.provider);
    if (!provider) throw new BadRequestError('Payment provider is not available');
    const verified = await provider.verifyPayment({
      paymentId: String(payment._id),
      providerOrderId: payment.providerOrderId ?? undefined,
      providerPaymentId: input.providerPaymentId,
      signature: input.signature,
      amountPaise: payment.amountPaise,
    });
    if (!verified) {
      payment.status = 'FAILED';
      await payment.save();
      await domainBus.publish({
        event: 'PAYMENT_FAILED',
        userIds: [String(order.buyerId)],
        title: 'Payment failed',
        body: `Payment for order ${order.orderNumber} failed.`,
        entityType: 'payment',
        entityId: String(payment._id),
        dedupeKey: `payment-failed:${String(payment._id)}`,
      });
      throw new BadRequestError('Payment verification failed');
    }
    payment.status = 'SUCCESS';
    payment.paidAt = new Date();
    payment.transactionId = input.providerPaymentId ?? payment.transactionId ?? randomId('txn');
    await payment.save();
    await this.orderService.syncPayment(String(order._id));
    await domainBus.publish({
      event: 'PAYMENT_SUCCESS',
      userIds: [String(order.buyerId), String(order.farmerId)],
      title: 'Payment received',
      body: `Payment for order ${order.orderNumber} succeeded.`,
      entityType: 'payment',
      entityId: String(payment._id),
      dedupeKey: `payment-success:${String(payment._id)}`,
    });
    logger.info({ event: 'PAYMENT_SUCCESS', orderId: order.orderNumber, userId: actor.id });
    return presentPayment(payment);
  }

  async get(actor: AuthUser, id: string) {
    const payment = await this.payments.findById(id);
    if (!payment) throw new NotFoundError('Payment not found');
    const order = await this.orders.findById(String(payment.orderId));
    const allowed = order && (sameId(order.buyerId, actor.id) || sameId(order.farmerId, actor.id) || hasRole(actor, ADMIN_ROLES));
    if (!allowed) throw new AuthorizationError();
    return presentPayment(payment);
  }

  async refund(actor: AuthUser, id: string, input: { amount?: number; reason?: string }) {
    const payment = await this.payments.findById(id);
    if (!payment) throw new NotFoundError('Payment not found');
    const order = await this.orders.findById(String(payment.orderId));
    if (!order) throw new NotFoundError('Order not found');
    if (!sameId(order.buyerId, actor.id) && !hasRole(actor, ADMIN_ROLES)) {
      throw new AuthorizationError('Only the buyer or an admin can refund this payment');
    }
    if (payment.status === 'REFUNDED') return presentPayment(payment);
    if (payment.status !== 'SUCCESS' && payment.status !== 'PARTIAL_REFUND') {
      throw new ConflictError('Only successful payments can be refunded');
    }
    const remaining = payment.amountPaise - (payment.refundedPaise ?? 0);
    const refundPaise = input.amount ? rupeesToPaise(input.amount) : remaining;
    if (refundPaise <= 0 || refundPaise > remaining) throw new UnprocessableError('Refund amount is invalid');
    const provider = this.providers.find((item) => item.name === payment.provider);
    if (!provider) throw new BadRequestError('Payment provider is not available');
    const result = await provider.refund({
      paymentId: String(payment._id),
      providerPaymentId: payment.transactionId ?? undefined,
      amountPaise: refundPaise,
      reason: input.reason,
    });
    payment.refundedPaise = (payment.refundedPaise ?? 0) + refundPaise;
    payment.status = payment.refundedPaise >= payment.amountPaise ? 'REFUNDED' : 'PARTIAL_REFUND';
    payment.metadata = { ...(payment.metadata as object), refundId: result.refundId };
    await payment.save();
    await this.orderService.syncPayment(String(order._id));
    return presentPayment(payment);
  }

  async webhook(rawBody: Buffer, signature?: string, razorpaySignature?: string) {
    const presented = razorpaySignature || signature || '';
    if (!presented || !signaturesMatch(signPayload(rawBody), presented)) {
      throw new AuthenticationError('Invalid webhook signature');
    }
    const parsed = parseWebhookBody(rawBody);
    try {
      const outcome = await runInTransaction(async (session) => {
        const existing = await this.webhooks.find(parsed.provider, parsed.eventId, session);
        if (existing) return { duplicate: true as const, paymentId: parsed.paymentId };
        const payment = await this.payments.findById(parsed.paymentId, session);
        if (!payment) throw new NotFoundError('Payment not found');
        await this.webhooks.create(
          { provider: parsed.provider, eventId: parsed.eventId, paymentId: payment._id, status: parsed.status },
          session,
        );
        await this.applyWebhookStatus(payment, parsed, session);
        return { duplicate: false as const, paymentId: String(payment._id), orderId: String(payment.orderId), status: parsed.status };
      });
      if (!outcome.duplicate && outcome.status === 'SUCCESS') {
        const payment = await this.payments.findById(outcome.paymentId);
        const order = payment ? await this.orders.findById(String(payment.orderId)) : null;
        if (order) {
          await domainBus.publish({
            event: 'PAYMENT_SUCCESS',
            userIds: [String(order.buyerId), String(order.farmerId)],
            title: 'Payment received',
            body: `Payment for order ${order.orderNumber} succeeded.`,
            entityType: 'payment',
            entityId: outcome.paymentId,
            dedupeKey: `payment-success:${outcome.paymentId}`,
          });
        }
      }
      return { received: true, duplicate: outcome.duplicate };
    } catch (error) {
      if (isDuplicateKey(error)) return { received: true, duplicate: true };
      throw error;
    }
  }

  private async applyWebhookStatus(
    payment: {
      status: PaymentStatus;
      paidAt?: Date | null;
      transactionId?: string | null;
      orderId: unknown;
      save: (options?: { session?: ClientSession | null }) => Promise<unknown>;
    },
    parsed: ParsedWebhookEvent,
    session: ClientSession,
  ) {
    if (parsed.status === 'SUCCESS' && payment.status !== 'SUCCESS' && payment.status !== 'REFUNDED') {
      payment.status = 'SUCCESS';
      payment.paidAt = new Date();
      if (parsed.providerPaymentId) payment.transactionId = parsed.providerPaymentId;
      await payment.save({ session });
      await this.orderService.syncPayment(String(payment.orderId), session as never);
    } else if (parsed.status === 'FAILED' && payment.status === 'PENDING') {
      payment.status = 'FAILED';
      await payment.save({ session });
      await this.orderService.syncPayment(String(payment.orderId), session as never);
    } else if (parsed.status === 'REFUNDED' && payment.status === 'SUCCESS') {
      payment.status = 'REFUNDED';
      await payment.save({ session });
      await this.orderService.syncPayment(String(payment.orderId), session as never);
    }
  }
}

function parseWebhookBody(rawBody: Buffer): ParsedWebhookEvent {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new BadRequestError('Webhook payload is not valid JSON');
  }
  const payload = body.payload as { payment?: { entity?: Record<string, unknown> } } | undefined;
  const entity = payload?.payment?.entity;
  if (entity && typeof entity === 'object') {
    const notes = (entity.notes as Record<string, string> | undefined) ?? {};
    const paymentId = notes.paymentId;
    if (!paymentId) throw new BadRequestError('Webhook payment reference is missing');
    const captured = entity.status === 'captured' || body.event === 'payment.captured';
    return {
      eventId: String(body.event ?? 'razorpay') + ':' + String(entity.id ?? paymentId),
      paymentId,
      status: captured ? 'SUCCESS' : 'FAILED',
      providerPaymentId: entity.id ? String(entity.id) : undefined,
      provider: 'RAZORPAY',
    };
  }
  if (typeof body.eventId !== 'string' || typeof body.paymentId !== 'string' || typeof body.status !== 'string') {
    throw new BadRequestError('Webhook payload is missing required fields');
  }
  const status = body.status as ParsedWebhookEvent['status'];
  if (!['SUCCESS', 'FAILED', 'AUTHORIZED', 'REFUNDED'].includes(status)) {
    throw new BadRequestError('Unsupported webhook status');
  }
  return {
    eventId: body.eventId,
    paymentId: body.paymentId,
    status,
    providerPaymentId: typeof body.providerPaymentId === 'string' ? body.providerPaymentId : undefined,
    provider: body.provider === 'RAZORPAY' ? 'RAZORPAY' : 'MOCK',
  };
}
