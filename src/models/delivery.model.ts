import { Schema, model } from 'mongoose';
import { DELIVERY_STATUSES } from '../constants/enums';
import { jsonOptions, pointSchema } from './shared';

const placeSchema = new Schema(
  {
    address: { type: String, required: true, trim: true },
    location: { type: pointSchema, required: false },
  },
  { _id: false },
);

const trackingSchema = new Schema(
  {
    status: { type: String, required: true },
    note: { type: String, trim: true },
    at: { type: Date, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false },
);

const deliverySchema = new Schema(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true, index: true },
    transporterId: { type: Schema.Types.ObjectId, ref: 'Transporter' },
    vehicleId: { type: Schema.Types.ObjectId },
    pickupLocation: { type: placeSchema, required: true },
    dropLocation: { type: placeSchema, required: true },
    scheduledPickup: { type: Date },
    scheduledDelivery: { type: Date },
    distanceMeters: { type: Number, min: 0 },
    estimatedCostPaise: { type: Number, min: 0, default: 0 },
    actualCostPaise: { type: Number, min: 0 },
    status: { type: String, enum: DELIVERY_STATUSES, default: 'REQUESTED', index: true },
    trackingEvents: [trackingSchema],
  },
  { timestamps: true },
);

deliverySchema.index({ transporterId: 1, status: 1 });
deliverySchema.index({ status: 1, createdAt: -1 });
jsonOptions(deliverySchema);

export const DeliveryModel = model('Delivery', deliverySchema);
