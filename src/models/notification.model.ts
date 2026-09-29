import { Schema, model } from 'mongoose';
import { NOTIFICATION_CHANNELS, NOTIFICATION_EVENTS } from '../constants/enums';
import { jsonOptions } from './shared';

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true },
    event: { type: String, enum: NOTIFICATION_EVENTS, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    status: { type: String, enum: ['PENDING', 'SENT', 'SKIPPED', 'FAILED'], default: 'PENDING' },
    dedupeKey: { type: String, required: true },
  },
  { timestamps: true },
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1, channel: 1 }, { unique: true });
jsonOptions(notificationSchema);

export const NotificationModel = model('Notification', notificationSchema);
