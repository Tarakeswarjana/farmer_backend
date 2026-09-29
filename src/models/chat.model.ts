import { Schema, model } from 'mongoose';
import { MESSAGE_TYPES } from '../constants/enums';
import { jsonOptions } from './shared';

const conversationSchema = new Schema(
  {
    participants: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    listingId: { type: Schema.Types.ObjectId, ref: 'VegetableListing' },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    lastMessage: { type: String },
    lastMessageAt: { type: Date, index: true },
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1, listingId: 1, orderId: 1 });
jsonOptions(conversationSchema);

const messageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    messageType: { type: String, enum: MESSAGE_TYPES, default: 'TEXT' },
    attachments: [{ type: String }],
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
jsonOptions(messageSchema);

export const ConversationModel = model('Conversation', conversationSchema);
export const MessageModel = model('Message', messageSchema);
