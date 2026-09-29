import { Schema, model } from 'mongoose';
import { jsonOptions } from './shared';

const dailyStatSchema = new Schema(
  {
    date: { type: String, required: true, unique: true },
    totalFarmers: { type: Number, default: 0 },
    totalBuyers: { type: Number, default: 0 },
    orders: { type: Number, default: 0 },
    gmvPaise: { type: Number, default: 0 },
    generatedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

jsonOptions(dailyStatSchema);

export const DailyStatModel = model('DailyStatistic', dailyStatSchema);
