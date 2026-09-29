import { Schema, model } from 'mongoose';
import { VEHICLE_TYPES, VERIFICATION_STATUSES } from '../constants/enums';
import { jsonOptions, pointSchema } from './shared';

const vehicleSchema = new Schema(
  {
    vehicleNumber: { type: String, required: true, trim: true, uppercase: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    capacity: { type: Number, required: true, min: 1 },
    driverName: { type: String, required: true, trim: true },
    driverPhone: { type: String, required: true, trim: true },
  },
  { _id: true },
);

const areaSchema = new Schema(
  {
    district: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true, default: 'West Bengal' },
  },
  { _id: false },
);

const transporterSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    businessName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    vehicleTypes: [{ type: String, enum: VEHICLE_TYPES }],
    vehicles: [vehicleSchema],
    serviceAreas: [areaSchema],
    location: { type: pointSchema, required: true },
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING' },
    isVerified: { type: Boolean, default: false },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

transporterSchema.index({ location: '2dsphere' });
jsonOptions(transporterSchema);

export const TransporterModel = model('Transporter', transporterSchema);
