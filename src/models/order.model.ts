import { Schema, model } from 'mongoose';
import { ORDER_PAYMENT_STATUSES, ORDER_STATUSES, UNITS } from '../constants/enums';
import { jsonOptions, pointSchema } from './shared';

const placeSchema = new Schema(
  {
    address: { type: String, required: true, trim: true },
    landmark: { type: String, trim: true },
    location: { type: pointSchema, required: false },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    buyerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    farmerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fpoId: { type: Schema.Types.ObjectId, ref: 'Fpo' },
    listingId: { type: Schema.Types.ObjectId, ref: 'VegetableListing', required: true, index: true },
    offerId: { type: Schema.Types.ObjectId, ref: 'Offer' },
    cropId: { type: Schema.Types.ObjectId, ref: 'Crop', required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, enum: UNITS, required: true },
    unitPricePaise: { type: Number, required: true, min: 0 },
    subtotalPaise: { type: Number, required: true, min: 0 },
    commissionPaise: { type: Number, required: true, min: 0, default: 0 },
    transportChargePaise: { type: Number, required: true, min: 0, default: 0 },
    taxPaise: { type: Number, required: true, min: 0, default: 0 },
    discountPaise: { type: Number, required: true, min: 0, default: 0 },
    totalAmountPaise: { type: Number, required: true, min: 0 },
    pickupLocation: { type: placeSchema, required: true },
    deliveryLocation: { type: placeSchema },
    marketId: { type: Schema.Types.ObjectId, ref: 'Market', index: true },
    scheduledPickupDate: { type: Date },
    scheduledDeliveryDate: { type: Date },
    paymentStatus: { type: String, enum: ORDER_PAYMENT_STATUSES, default: 'UNPAID', index: true },
    orderStatus: { type: String, enum: ORDER_STATUSES, default: 'PENDING', index: true },
    notes: { type: String, trim: true },
    idempotencyKey: { type: String },
    inventoryReleased: { type: Boolean, default: false },
  },
  { timestamps: true },
);

orderSchema.index({ buyerId: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ farmerId: 1, orderStatus: 1, createdAt: -1 });
orderSchema.index({ createdAt: -1, orderStatus: 1 });
orderSchema.index(
  { buyerId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
jsonOptions(orderSchema);

export const OrderModel = model('Order', orderSchema);
