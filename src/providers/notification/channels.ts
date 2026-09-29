import type { NotificationChannel, OutboundNotification } from '../../interfaces/notification-channel';
import type { NotificationChannelName } from '../../constants/enums';
import { smtpConfigured, env } from '../../config/env';
import { logger } from '../../utils/logger';

class SkippingChannel implements NotificationChannel {
  constructor(readonly channel: NotificationChannelName) {}

  async send(input: OutboundNotification): Promise<'SENT' | 'SKIPPED'> {
    logger.info({ event: 'NOTIFICATION_CHANNEL_SKIPPED', channel: this.channel, userId: input.userId });
    return 'SKIPPED';
  }
}

export class EmailChannel implements NotificationChannel {
  readonly channel = 'EMAIL' as const;

  async send(input: OutboundNotification): Promise<'SENT' | 'SKIPPED'> {
    if (!smtpConfigured || !input.destination) {
      logger.info({ event: 'EMAIL_SKIPPED', userId: input.userId });
      return 'SKIPPED';
    }
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: { user: env.smtp.user, pass: env.smtp.password },
    });
    await transport.sendMail({
      from: env.smtp.user,
      to: input.destination,
      subject: input.title,
      text: input.body,
    });
    logger.info({ event: 'EMAIL_SENT', userId: input.userId });
    return 'SENT';
  }
}

export const notificationChannels: NotificationChannel[] = [
  new SkippingChannel('SMS'),
  new EmailChannel(),
  new SkippingChannel('WHATSAPP'),
  new SkippingChannel('PUSH'),
];
