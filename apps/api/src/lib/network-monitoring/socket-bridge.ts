import { eventBus, isNetworkMonitoringEvent, type NetworkMonitoringEvent } from '@/lib/event-bus';
import { getIo, NETWORK_MONITORING_ROOM } from '@/lib/socket';
import { logger } from '@/lib/logger';

export const SOCKET_EVENT_OFFLINE = 'network:device-offline';
export const SOCKET_EVENT_RESTORED = 'network:device-restored';

function socketEventName(event: NetworkMonitoringEvent): string {
  return event.type === 'NETWORK_DEVICE_OFFLINE' ? SOCKET_EVENT_OFFLINE : SOCKET_EVENT_RESTORED;
}

/**
 * Bridges Network Monitoring domain events from the in-process Event Bus to
 * Socket.IO clients. It is a passive consumer: publishing happens only after
 * the database transaction has committed, and any transport failure is caught
 * and logged so it can never roll back or corrupt monitoring state.
 */
let subscribed = false;

export function setupNetworkMonitoringSocketBridge(): void {
  if (subscribed) return;
  subscribed = true;
  eventBus.subscribe((event) => {
    if (!isNetworkMonitoringEvent(event)) return;

    try {
      const io = getIo();
      if (!io) return;
      io.to(NETWORK_MONITORING_ROOM).emit(socketEventName(event), event);
    } catch (error) {
      // Socket.IO failure must not affect committed database state.
      logger.error({ error, eventType: event.type, deviceId: event.deviceId }, 'Failed to emit network monitoring socket event');
    }
  });
}