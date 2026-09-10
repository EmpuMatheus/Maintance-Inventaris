import type { NotificationType } from '@/modules/notifications/notification.types';

/**
 * Lightweight in-process event bus. Domain modules publish domain events
 * without knowing about notifications; consumers (notification bell, realtime
 * socket bridge) subscribe and translate events for their own transport.
 *
 * The bus carries two families of events:
 *  - {@link NotificationEvent}  - feeds the in-app notification bell.
 *  - {@link NetworkMonitoringEvent} - feeds the Network Monitoring realtime
 *    socket channel. Network alerts deliberately do NOT enter the notification
 *    bell; a dedicated consumer handles them.
 */
export interface NotificationEvent {
  type: NotificationType;
  action: string;
  targetUserId: string | null;
  entityType?: string;
  entityId?: string | null;
  data: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Network Monitoring realtime events
// ---------------------------------------------------------------------------

export const NETWORK_MONITORING_EVENT_TYPES = [
  'NETWORK_DEVICE_OFFLINE',
  'NETWORK_DEVICE_RESTORED',
] as const;

export type NetworkMonitoringEventType = (typeof NETWORK_MONITORING_EVENT_TYPES)[number];

export interface NetworkDeviceOfflineEvent {
  type: 'NETWORK_DEVICE_OFFLINE';
  deviceId: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  roomId: string;
  status: 'OFFLINE';
  eventType: 'CONNECTION_LOST';
  /** ISO 8601 UTC. */
  timestamp: string;
  /** ISO 8601 UTC - when the device became OFFLINE. */
  startedAt: string;
}

export interface NetworkDeviceRestoredEvent {
  type: 'NETWORK_DEVICE_RESTORED';
  deviceId: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  roomId: string;
  status: 'ONLINE';
  eventType: 'RESTORED';
  /** ISO 8601 UTC - recovery time. */
  timestamp: string;
  /** ISO 8601 UTC - when the device went OFFLINE. */
  startedAt: string;
  /** ISO 8601 UTC - recovery time. */
  resolvedAt: string;
  durationSeconds: number;
}

export type NetworkMonitoringEvent = NetworkDeviceOfflineEvent | NetworkDeviceRestoredEvent;

export type BusEvent = NotificationEvent | NetworkMonitoringEvent;

/** Type guard: true when the event is a network monitoring realtime event. */
export function isNetworkMonitoringEvent(event: BusEvent): event is NetworkMonitoringEvent {
  return (NETWORK_MONITORING_EVENT_TYPES as readonly string[]).includes(event.type);
}

/** Type guard: true when the event is a notification-bell event. */
export function isNotificationEvent(event: BusEvent): event is NotificationEvent {
  return !isNetworkMonitoringEvent(event);
}

type Listener = (event: BusEvent) => void;

const listeners = new Set<Listener>();

export const eventBus = {
  publish(event: BusEvent): void {
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