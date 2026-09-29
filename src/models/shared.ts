import { Schema, type SchemaDefinition } from 'mongoose';

export const pointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], required: true, default: 'Point' },
    coordinates: {
      type: [Number],
      required: true,
    },
  },
  { _id: false },
);

export const addressFields: SchemaDefinition = {
  address: { type: String, trim: true },
  village: { type: String, trim: true },
  gramPanchayat: { type: String, trim: true },
  block: { type: String, trim: true },
  district: { type: String, trim: true },
  state: { type: String, trim: true, default: 'West Bengal' },
  pincode: { type: String, trim: true },
};

export function jsonOptions(schema: Schema): void {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,
    transform(_doc, ret: Record<string, unknown>) {
      delete ret.password;
      return ret;
    },
  });
  schema.set('toObject', { virtuals: true, versionKey: false });
}
