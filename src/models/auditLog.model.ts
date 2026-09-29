import { Schema, model } from 'mongoose';
import { AUDIT_ACTIONS } from '../constants/enums';
import { jsonOptions } from './shared';

const auditSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true, index: true },
    entity: { type: String, required: true },
    entityId: { type: String, required: true, index: true },
    oldValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditSchema.index({ createdAt: -1 });
jsonOptions(auditSchema);

export const AuditLogModel = model('AuditLog', auditSchema);
