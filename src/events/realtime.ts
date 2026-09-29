import { EventEmitter } from 'events';

export interface RealtimeEvent {
  type: 'message.created' | 'message.read' | 'notification.created';
  participantIds: string[];
  conversationId?: string;
  messageId?: string;
}

export const realtimeBus = new EventEmitter();

export function publishRealtime(event: RealtimeEvent): void {
  realtimeBus.emit('realtime', event);
}
