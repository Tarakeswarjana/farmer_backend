import { Schema, model } from 'mongoose';
import { DISPUTE_STATUSES } from '../constants/enums';
import { jsonOptions } from './shared';

const disputeSchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    against: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    images: [{ type: String }],
    status: { type: String, enum: DISPUTE_STATUSES, default: 'OPEN', index: true },
    resolution: { type: String, trim: true },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

disputeSchema.index({ orderId: 1, raisedBy: 1, status: 1 });
jsonOptions(disputeSchema);

export const DisputeModel = model('Dispute', disputeSchema);
