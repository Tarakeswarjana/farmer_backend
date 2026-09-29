import { Schema, model } from 'mongoose';
import { OTP_PURPOSES } from '../constants/enums';
import { jsonOptions } from './shared';

const otpSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: OTP_PURPOSES, required: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date },
  },
  { timestamps: true },
);

otpSchema.index({ userId: 1, purpose: 1, consumedAt: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });
jsonOptions(otpSchema);

export const OtpModel = model('OtpCode', otpSchema);
