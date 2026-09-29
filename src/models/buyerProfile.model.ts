import { Schema, model } from 'mongoose';
import { BUSINESS_TYPES, VERIFICATION_STATUSES } from '../constants/enums';
import { jsonOptions, pointSchema } from './shared';

const buyerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    businessName: { type: String, required: true, trim: true },
    businessType: { type: String, enum: BUSINESS_TYPES, required: true, index: true },
    ownerName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    gstNumber: { type: String, trim: true, uppercase: true },
    address: { type: String, required: true, trim: true },
    village: { type: String, trim: true },
    block: { type: String, trim: true },
    district: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true, default: 'West Bengal' },
    pincode: { type: String, trim: true },
    markets: [{ type: Schema.Types.ObjectId, ref: 'Market' }],
    preferredCrops: [{ type: Schema.Types.ObjectId, ref: 'Crop' }],
    buyingCapacity: { type: Number, min: 0 },
    buyingCapacityUnit: { type: String, default: 'KG' },
    paymentTerms: { type: String, trim: true },
    location: { type: pointSchema, required: true },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING', index: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
    documents: [
      {
        documentId: { type: Schema.Types.ObjectId, ref: 'DocumentFile' },
        documentType: { type: String },
      },
    ],
  },
  { timestamps: true },
);

buyerSchema.index({ location: '2dsphere' });
buyerSchema.index({ businessType: 1, district: 1 });
jsonOptions(buyerSchema);

export const BuyerProfileModel = model('BuyerProfile', buyerSchema);
