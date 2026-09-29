import { Schema, model, type InferSchemaType } from 'mongoose';
import { ROLES } from '../constants/enums';
import { jsonOptions, pointSchema } from './shared';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    roles: { type: [{ type: String, enum: ROLES }], required: true },
    profileImage: { type: String },
    isPhoneVerified: { type: Boolean, default: false },
    isEmailVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    isDemo: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    address: { type: String, trim: true },
    village: { type: String, trim: true },
    district: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    location: { type: pointSchema, required: false },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ location: '2dsphere' }, { sparse: true });
jsonOptions(userSchema);

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId };
export const UserModel = model('User', userSchema);
