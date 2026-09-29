import type { NotificationChannelName } from '../constants/enums';
import type { DomainEvent } from '../events/bus';
import { publishRealtime } from '../events/realtime';
import { notificationChannels } from '../providers/notification/channels';
import { NotificationRepository } from '../repositories/operations.repository';
import { UserRepository } from '../repositories/user.repository';
import { isDuplicateKey } from '../utils/errors';
import { logger } from '../utils/logger';
import { presentNotification } from '../utils/presenters';
import { buildMeta, toPageQuery } from '../utils/pagination';
import { NotFoundError } from '../utils/errors';

export class NotificationService {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly users: UserRepository,
  ) {}

  async dispatch(event: DomainEvent): Promise<void> {
    for (const userId of [...new Set(event.userIds)]) {
      const user = await this.users.findById(userId);
      const targets: Array<{ channel: NotificationChannelName; destination?: string }> = [
        { channel: 'IN_APP' },
        { channel: 'SMS', destination: user?.phone },
        { channel: 'EMAIL', destination: user?.email ?? undefined },
        { channel: 'WHATSAPP', destination: user?.phone },
        { channel: 'PUSH' },
      ];
      for (const target of targets) {
        const status =
          target.channel === 'IN_APP'
            ? 'SENT'
            : await this.sendExternal(target.channel, {
                userId,
                title: event.title,
                body: event.body,
                destination: target.destination,
              });
        try {
          await this.notifications.create({
            userId,
            channel: target.channel,
            event: event.event,
            title: event.title,
            body: event.body,
            entityType: event.entityType,
            entityId: event.entityId,
            isRead: false,
            status,
            dedupeKey: event.dedupeKey,
          });
        } catch (error) {
          if (!isDuplicateKey(error)) {
            logger.error({ event: 'NOTIFICATION_WRITE_FAILED', userId, channel: target.channel });
          }
        }
      }
      publishRealtime({ type: 'notification.created', participantIds: [userId] });
    }
  }

  private async sendExternal(
    channel: NotificationChannelName,
    input: { userId: string; title: string; body: string; destination?: string },
  ): Promise<'SENT' | 'SKIPPED' | 'FAILED'> {
    const provider = notificationChannels.find((item) => item.channel === channel);
    if (!provider) {
      return 'SKIPPED';
    }
    try {
      return await provider.send(input);
    } catch {
      logger.error({ event: 'NOTIFICATION_CHANNEL_FAILED', channel, userId: input.userId });
      return 'FAILED';
    }
  }

  async list(
    userId: string,
    query: { page?: number; limit?: number; channel?: NotificationChannelName; isRead?: boolean },
  ) {
    const page = toPageQuery(query);
    const filter: Record<string, unknown> = { userId, channel: query.channel ?? 'IN_APP' };
    if (query.isRead !== undefined) {
      filter.isRead = query.isRead;
    }
    const result = await this.notifications.list(filter, page.skip, page.limit);
    return {
      items: result.items.map((item) => presentNotification(item)),
      meta: buildMeta(page.page, page.limit, result.total),
    };
  }

  async markRead(userId: string, id: string) {
    const updated = await this.notifications.markRead(id, userId);
    if (!updated) {
      throw new NotFoundError('Notification not found');
    }
    return presentNotification(updated);
  }

  async markAllRead(userId: string) {
    const result = await this.notifications.markAllRead(userId);
    return { updated: result.modifiedCount };
  }
}
