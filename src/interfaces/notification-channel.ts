import type { NotificationChannelName } from '../constants/enums';

export interface OutboundNotification {
  userId: string;
  title: string;
  body: string;
  destination?: string;
}

export interface NotificationChannel {
  readonly channel: NotificationChannelName;
  send(input: OutboundNotification): Promise<'SENT' | 'SKIPPED'>;
}
