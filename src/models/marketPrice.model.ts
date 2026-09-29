import { Schema, model } from 'mongoose';
import { PRICE_SOURCES, UNITS } from '../constants/enums';
import { jsonOptions } from './shared';

const marketPriceSchema = new Schema(
  {
    cropId: { type: Schema.Types.ObjectId, ref: 'Crop', required: true, index: true },
    marketId: { type: Schema.Types.ObjectId, ref: 'Market', required: true, index: true },
    date: { type: Date, required: true, index: true },
    minimumPricePaise: { type: Number, required: true, min: 0 },
    maximumPricePaise: { type: Number, required: true, min: 0 },
    modalPricePaise: { type: Number, required: true, min: 0 },
    unit: { type: String, enum: UNITS, required: true, default: 'KG' },
    source: { type: String, enum: PRICE_SOURCES, required: true, default: 'MANUAL' },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

marketPriceSchema.index({ cropId: 1, marketId: 1, date: -1, source: 1 }, { unique: true });
jsonOptions(marketPriceSchema);

export const MarketPriceModel = model('MarketPrice', marketPriceSchema);
