import { Schema, model } from 'mongoose';
import { jsonOptions } from './shared';

const webhookSchema = new Schema(
  {
    provider: { type: String, required: true },
    eventId: { type: String, required: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    status: { type: String, required: true },
    processedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

webhookSchema.index({ provider: 1, eventId: 1 }, { unique: true });
jsonOptions(webhookSchema);

export const WebhookEventModel = model('WebhookEvent', webhookSchema);
