import { Schema, model } from 'mongoose';
import { PAYMENT_METHODS, PAYMENT_PROVIDERS, PAYMENT_STATUSES } from '../constants/enums';
import { jsonOptions } from './shared';

const paymentSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, required: true, default: 'INR' },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    provider: { type: String, enum: PAYMENT_PROVIDERS, required: true },
    transactionId: { type: String, index: true },
    providerOrderId: { type: String },
    status: { type: String, enum: PAYMENT_STATUSES, default: 'PENDING', index: true },
    paidAt: { type: Date },
    refundedPaise: { type: Number, default: 0, min: 0 },
    metadata: { type: Schema.Types.Mixed },
    idempotencyKey: { type: String },
    requestHash: { type: String },
  },
  { timestamps: true },
);

paymentSchema.index(
  { buyerId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
jsonOptions(paymentSchema);

export const PaymentModel = model('Payment', paymentSchema);
