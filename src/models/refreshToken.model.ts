import { Schema, model } from 'mongoose';
import { jsonOptions } from './shared';

const refreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    replacedByJti: { type: String },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
jsonOptions(refreshTokenSchema);

export const RefreshTokenModel = model('RefreshToken', refreshTokenSchema);
