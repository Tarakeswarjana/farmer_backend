import { Schema, model } from 'mongoose';
import { QUALITY_GRADES, REQUIREMENT_STATUSES, UNITS } from '../constants/enums';
import { jsonOptions, pointSchema } from './shared';

const requirementSchema = new Schema(
  {
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    buyerProfileId: { type: Schema.Types.ObjectId, ref: 'BuyerProfile', required: true },
    cropId: { type: Schema.Types.ObjectId, ref: 'Crop', required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    fulfilledQuantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, enum: UNITS, required: true },
    targetPricePaise: { type: Number, required: true, min: 1 },
    qualityGrade: { type: String, enum: QUALITY_GRADES },
    requiredDate: { type: Date, required: true, index: true },
    marketId: { type: Schema.Types.ObjectId, ref: 'Market', index: true },
    district: { type: String, trim: true, index: true },
    state: { type: String, trim: true },
    location: { type: pointSchema },
    notes: { type: String, trim: true },
    status: { type: String, enum: REQUIREMENT_STATUSES, default: 'OPEN', index: true },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

requirementSchema.index({ cropId: 1, status: 1, requiredDate: 1 });
requirementSchema.index({ buyerId: 1, status: 1, createdAt: -1 });
requirementSchema.index({ location: '2dsphere' }, { sparse: true });
jsonOptions(requirementSchema);

export const RequirementModel = model('PurchaseRequirement', requirementSchema);
