import { Schema, model } from 'mongoose';
import { MARKET_TYPES, WEEKDAYS } from '../constants/enums';
import { jsonOptions, pointSchema } from './shared';

const marketSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    marketCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
    marketType: { type: String, enum: MARKET_TYPES, required: true, index: true },
    address: { type: String, required: true, trim: true },
    village: { type: String, trim: true },
    block: { type: String, trim: true },
    district: { type: String, required: true, trim: true, index: true },
    state: { type: String, required: true, trim: true, default: 'West Bengal' },
    pincode: { type: String, trim: true },
    location: { type: pointSchema, required: true },
    operatingDays: [{ type: String, enum: WEEKDAYS }],
    openingTime: { type: String, default: '06:00' },
    closingTime: { type: String, default: '14:00' },
    commodities: [{ type: Schema.Types.ObjectId, ref: 'Crop' }],
    commissionBps: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
    managerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    isDemo: { type: Boolean, default: true },
  },
  { timestamps: true },
);

marketSchema.index({ location: '2dsphere' });
marketSchema.index({ district: 1, isActive: 1 });
jsonOptions(marketSchema);

export const MarketModel = model('Market', marketSchema);
