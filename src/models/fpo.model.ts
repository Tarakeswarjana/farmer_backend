import { Schema, model } from 'mongoose';
import { VERIFICATION_STATUSES } from '../constants/enums';
import { jsonOptions, pointSchema } from './shared';

const fpoSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    registrationNumber: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    contactPerson: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, required: true, trim: true },
    village: { type: String, trim: true },
    block: { type: String, trim: true },
    district: { type: String, required: true, trim: true, index: true },
    state: { type: String, required: true, trim: true, default: 'West Bengal' },
    pincode: { type: String, trim: true },
    location: { type: pointSchema, required: true },
    memberCount: { type: Number, default: 0 },
    memberFarmerIds: [{ type: Schema.Types.ObjectId, ref: 'FarmerProfile' }],
    primaryCrops: [{ type: Schema.Types.ObjectId, ref: 'Crop' }],
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING', index: true },
    isVerified: { type: Boolean, default: false },
    documents: [
      {
        documentId: { type: Schema.Types.ObjectId, ref: 'DocumentFile' },
        documentType: { type: String },
      },
    ],
    adminUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

fpoSchema.index({ location: '2dsphere' });
jsonOptions(fpoSchema);

export const FpoModel = model('Fpo', fpoSchema);
