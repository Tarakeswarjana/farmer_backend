import type { NotificationEventName } from '../constants/enums';

export interface DomainEvent {
  event: NotificationEventName;
  userIds: string[];
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  dedupeKey: string;
}

type Handler = (event: DomainEvent) => Promise<void>;

const handlers: Handler[] = [];
const observers: Array<(event: DomainEvent) => void> = [];
let listening = false;

export const domainBus = {
  subscribe(handler: Handler): void {
    handlers.push(handler);
  },
  observe(observer: (event: DomainEvent) => void): void {
    observers.push(observer);
  },
  async publish(event: DomainEvent): Promise<void> {
    for (const observer of observers) {
      observer(event);
    }
    await Promise.all(handlers.map((handler) => handler(event)));
  },
};

export function markListenersReady(): void {
  listening = true;
}

export function listenersReady(): boolean {
  return listening;
}
