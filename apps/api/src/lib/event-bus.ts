import type { NotificationType } from '@/modules/notifications/notification.types';

/**
 * Lightweight in-process event bus. Domain modules publish domain events
 * without knowing about notifications; the notification consumer subscribes
 * and translates events into in-app notifications.
 */
export interface NotificationEvent {
  type: NotificationType;
  action: string;
  targetUserId: string | null;
  entityType?: string;
  entityId?: string | null;
  data: Record<string, unknown>;
}

type Listener = (event: NotificationEvent) => void;

const listeners = new Set<Listener>();

export const eventBus = {
  publish(event: NotificationEvent): void {
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // A failing consumer must never break the domain operation.
      }
    }
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
