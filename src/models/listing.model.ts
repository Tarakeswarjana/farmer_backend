import { Schema, model } from 'mongoose';
import { LISTING_STATUSES, QUALITY_GRADES, UNITS } from '../constants/enums';
import { jsonOptions, pointSchema } from './shared';

const qualitySchema = new Schema(
  {
    size: { type: String, trim: true },
    color: { type: String, trim: true },
    moisture: { type: String, trim: true },
    organic: { type: Boolean },
    notes: { type: String, trim: true },
  },
  { _id: false },
);

const pickupSchema = new Schema(
  {
    address: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true },
    location: { type: pointSchema, required: true },
  },
  { _id: false },
);

const listingSchema = new Schema(
  {
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmerProfileId: { type: Schema.Types.ObjectId, ref: 'FarmerProfile', required: true, index: true },
    fpoId: { type: Schema.Types.ObjectId, ref: 'Fpo' },
    cropId: { type: Schema.Types.ObjectId, ref: 'Crop', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    availableQuantity: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: UNITS, required: true },
    qualityGrade: { type: String, enum: QUALITY_GRADES, required: true, index: true },
    qualityParameters: { type: qualitySchema, default: () => ({}) },
    expectedPricePaise: { type: Number, required: true, min: 1 },
    minimumPricePaise: { type: Number, min: 1 },
    harvestDate: { type: Date, required: true },
    availableFrom: { type: Date, required: true, index: true },
    availableUntil: { type: Date, required: true, index: true },
    location: { type: pointSchema, required: true },
    pickupLocation: { type: pickupSchema },
    preferredMarketId: { type: Schema.Types.ObjectId, ref: 'Market', index: true },
    district: { type: String, trim: true, index: true },
    state: { type: String, trim: true },
    images: [{ type: String }],
    status: { type: String, enum: LISTING_STATUSES, default: 'DRAFT', index: true },
    isNegotiable: { type: Boolean, default: true },
    allowBidding: { type: Boolean, default: true },
  },
  { timestamps: true },
);

listingSchema.index({ farmerId: 1, status: 1, createdAt: -1 });
listingSchema.index({ cropId: 1, status: 1, availableFrom: 1 });
listingSchema.index({ preferredMarketId: 1, status: 1 });
listingSchema.index({ status: 1, createdAt: -1 });
listingSchema.index({ district: 1, status: 1 });
listingSchema.index({ location: '2dsphere' });
listingSchema.index({ title: 'text', description: 'text' });
jsonOptions(listingSchema);

export const ListingModel = model('VegetableListing', listingSchema);
