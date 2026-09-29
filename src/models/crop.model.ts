import { Schema, model } from 'mongoose';
import { CROP_CATEGORIES, SEASONS, UNITS } from '../constants/enums';
import { jsonOptions } from './shared';

const cropSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true, lowercase: true, trim: true },
    localNames: [{ type: String, trim: true }],
    bengaliName: { type: String, trim: true },
    category: { type: String, enum: CROP_CATEGORIES, required: true, index: true },
    unit: { type: String, enum: UNITS, required: true, default: 'KG' },
    image: { type: String },
    description: { type: String, trim: true },
    season: { type: String, enum: SEASONS, required: true },
    isActive: { type: Boolean, default: true, index: true },
    isSeeded: { type: Boolean, default: false },
  },
  { timestamps: true },
);

cropSchema.index({ name: 'text', bengaliName: 'text', localNames: 'text' });
jsonOptions(cropSchema);

export const CropModel = model('Crop', cropSchema);
