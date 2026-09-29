import { Schema, model } from 'mongoose';
import { FARM_SIZE_UNITS, FARMING_TYPES, VERIFICATION_STATUSES } from '../constants/enums';
import { pointSchema } from './shared';

const bankSchema = new Schema(
  {
    accountHolderName: { type: String, required: true, trim: true },
    accountNumberEncrypted: { type: String, required: true },
    accountNumberMasked: { type: String, required: true },
    ifsc: { type: String, required: true, trim: true, uppercase: true },
    bankName: { type: String, required: true, trim: true },
    branch: { type: String, trim: true },
  },
  { _id: false },
);

const documentRefSchema = new Schema(
  {
    documentId: { type: Schema.Types.ObjectId, ref: 'DocumentFile', required: true },
    documentType: { type: String, required: true },
  },
  { _id: false },
);

const farmerSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    farmerName: { type: String, required: true, trim: true },
    farmName: { type: String, trim: true },
    fatherName: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    village: { type: String, trim: true },
    gramPanchayat: { type: String, trim: true },
    block: { type: String, trim: true },
    district: { type: String, required: true, trim: true, index: true },
    state: { type: String, required: true, trim: true, default: 'West Bengal' },
    pincode: { type: String, required: true, trim: true },
    location: { type: pointSchema, required: true },
    farmSize: { type: Number, min: 0 },
    farmSizeUnit: { type: String, enum: FARM_SIZE_UNITS },
    primaryCrops: [{ type: Schema.Types.ObjectId, ref: 'Crop' }],
    farmingType: { type: String, enum: FARMING_TYPES },
    bankDetails: { type: bankSchema },
    documents: [documentRefSchema],
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, default: 'PENDING', index: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 },
    totalOrders: { type: Number, default: 0 },
    totalSalesPaise: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false, index: true },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true },
);

farmerSchema.index({ location: '2dsphere' });
farmerSchema.index({ primaryCrops: 1 });
farmerSchema.index({ district: 1, verificationStatus: 1 });
farmerSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret: Record<string, unknown>) {
    const bank = ret.bankDetails as Record<string, unknown> | undefined;
    if (bank) {
      delete bank.accountNumberEncrypted;
    }
    return ret;
  },
});
farmerSchema.set('toObject', { virtuals: true, versionKey: false });

export const FarmerProfileModel = model('FarmerProfile', farmerSchema);
