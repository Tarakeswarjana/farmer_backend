import { Schema, model } from 'mongoose';
import { OFFER_STATUSES, OPEN_OFFER_STATUSES } from '../constants/enums';
import { jsonOptions } from './shared';

const offerSchema = new Schema(
  {
    listingId: { type: Schema.Types.ObjectId, ref: 'VegetableListing', required: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    offeredPricePaise: { type: Number, required: true, min: 1 },
    quantity: { type: Number, required: true, min: 1 },
    originalPricePaise: { type: Number },
    originalQuantity: { type: Number },
    message: { type: String, trim: true, maxlength: 500 },
    status: { type: String, enum: OFFER_STATUSES, default: 'PENDING', index: true },
    lastCounteredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    expiresAt: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

offerSchema.index(
  { listingId: 1, buyerId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: [...OPEN_OFFER_STATUSES] } } },
);
offerSchema.index({ farmerId: 1, status: 1, createdAt: -1 });
offerSchema.index({ buyerId: 1, status: 1, createdAt: -1 });
jsonOptions(offerSchema);

export const OfferModel = model('Offer', offerSchema);
