import type { NetworkDeviceOfflineEvent, NetworkDeviceRestoredEvent } from '@/lib/event-bus';
import type { DeviceMonitorSnapshot } from './monitoring.types';

/** Converts a Date to an ISO 8601 UTC string (canonical API/socket format). */
export function toUtcIso(date: Date): string {
  return date.toISOString();
}

interface DeviceIdentity {
  id: string;
  name?: string;
  deviceType?: string;
  ipAddress?: string;
  roomId?: string;
}

/**
 * Offline payload broadcast when a device actually transitions ONLINE -> OFFLINE.
 * `timestamp` and `startedAt` are the same instant: the moment the device was
 * officially marked OFFLINE (second consecutive failure).
 */
export function buildOfflineEvent(device: DeviceIdentity, startedAt: Date): NetworkDeviceOfflineEvent {
  const iso = toUtcIso(startedAt);
  return {
    type: 'NETWORK_DEVICE_OFFLINE',
    deviceId: device.id,
    deviceName: device.name ?? '',
    deviceType: device.deviceType ?? '',
    ipAddress: device.ipAddress ?? '',
    roomId: device.roomId ?? '',
    status: 'OFFLINE',
    eventType: 'CONNECTION_LOST',
    timestamp: iso,
    startedAt: iso,
  };
}

/**
 * Restored payload broadcast when a device actually transitions OFFLINE -> ONLINE.
 * `startedAt` is the original offline instant; `resolvedAt`/`timestamp` are the
 * recovery instant derived from the backend clock.
 */
export function buildRestoredEvent(
  device: DeviceIdentity,
  startedAt: Date,
  resolvedAt: Date,
  durationSeconds: number,
): NetworkDeviceRestoredEvent {
  const resolvedIso = toUtcIso(resolvedAt);
  return {
    type: 'NETWORK_DEVICE_RESTORED',
    deviceId: device.id,
    deviceName: device.name ?? '',
    deviceType: device.deviceType ?? '',
    ipAddress: device.ipAddress ?? '',
    roomId: device.roomId ?? '',
    status: 'ONLINE',
    eventType: 'RESTORED',
    timestamp: resolvedIso,
    startedAt: toUtcIso(startedAt),
    resolvedAt: resolvedIso,
    durationSeconds,
  };
}

/** Convenience overload for the snapshot-based engine. */
export function deviceIdentityOf(snapshot: DeviceMonitorSnapshot): DeviceIdentity {
  return {
    id: snapshot.id,
    name: snapshot.name,
    deviceType: snapshot.deviceType,
    ipAddress: snapshot.ipAddress,
    roomId: snapshot.roomId,
  };
}
