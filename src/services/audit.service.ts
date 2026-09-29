import type { AuditAction } from '../constants/enums';
import { AuditRepository } from '../repositories/operations.repository';
import type { RequestMeta } from '../types/common';
import { logger } from '../utils/logger';
import { redactSensitive } from '../utils/sanitize';

export class AuditService {
  constructor(private readonly audits: AuditRepository) {}

  async record(input: {
    userId?: string;
    action: AuditAction;
    entity: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
    meta?: RequestMeta;
  }): Promise<void> {
    try {
      await this.audits.create({
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        oldValue: input.oldValue === undefined ? undefined : redactSensitive(input.oldValue),
        newValue: input.newValue === undefined ? undefined : redactSensitive(input.newValue),
        ipAddress: input.meta?.ipAddress,
        userAgent: input.meta?.userAgent,
      });
    } catch {
      logger.error({ event: 'AUDIT_WRITE_FAILED', action: input.action, entity: input.entity });
    }
  }
}
