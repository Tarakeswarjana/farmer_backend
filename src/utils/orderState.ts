import type { OrderStatus } from '../constants/enums';
import { ConflictError } from './errors';

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED', 'DISPUTED'],
  CONFIRMED: ['READY_FOR_PICKUP', 'CANCELLED', 'DISPUTED'],
  READY_FOR_PICKUP: ['PICKED_UP', 'CANCELLED', 'DISPUTED'],
  PICKED_UP: ['IN_TRANSIT', 'DISPUTED'],
  IN_TRANSIT: ['DELIVERED', 'DISPUTED'],
  DELIVERED: ['COMPLETED', 'DISPUTED'],
  COMPLETED: [],
  CANCELLED: [],
  DISPUTED: ['CONFIRMED', 'CANCELLED', 'COMPLETED'],
};

export const CANCELLABLE_ORDER_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'READY_FOR_PICKUP',
];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) {
    return true;
  }
  return TRANSITIONS[from].includes(to);
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictError(`Cannot change order from ${from} to ${to}`);
  }
}

export function releasesInventory(from: OrderStatus): boolean {
  return CANCELLABLE_ORDER_STATUSES.includes(from);
}
