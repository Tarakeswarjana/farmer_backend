import { notificationService } from '../container';
import { domainBus, markListenersReady, listenersReady } from './bus';
import { logger } from '../utils/logger';

export function registerDomainListeners(): void {
  if (listenersReady()) {
    return;
  }
  domainBus.subscribe(async (event) => {
    try {
      await notificationService.dispatch(event);
    } catch {
      logger.error({ event: 'NOTIFICATION_DISPATCH_FAILED', name: event.event });
    }
  });
  markListenersReady();
}
