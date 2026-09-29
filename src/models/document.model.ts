import { Schema, model } from 'mongoose';
import { DOCUMENT_TYPES } from '../constants/enums';
import { jsonOptions } from './shared';

const documentSchema = new Schema(
  {
    fileUrl: { type: String, required: true },
    fileKey: { type: String, required: true, unique: true },
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    documentType: { type: String, enum: DOCUMENT_TYPES, required: true },
    ownerType: { type: String, enum: ['FARMER', 'BUYER', 'FPO', 'USER'], required: true },
    ownerId: { type: Schema.Types.ObjectId },
    storage: { type: String, enum: ['local', 's3'], required: true },
  },
  { timestamps: true },
);

documentSchema.index({ uploadedBy: 1, createdAt: -1 });
jsonOptions(documentSchema);

export const DocumentModel = model('DocumentFile', documentSchema);
