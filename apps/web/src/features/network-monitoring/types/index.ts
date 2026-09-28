import type { NetworkMonitoringEvent } from '../api/monitoring';

export type {
  NetworkDeviceStatus,
  NetworkMonitoringSummary,
  NetworkMonitoringEvent,
  NetworkEventFilters,
  PaginationMeta,
} from '../api/monitoring';

export type NetworkDeviceType = string;
export type NetworkStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

/**
 * A single rendered timeline state.
 *
 * One database incident (`CONNECTION_LOST` with an optional `resolved_at`)
 * renders as up to two states: an OFFLINE state at `startedAt` and, once
 * resolved, a RESTORED state at `resolvedAt`. No second database incident is
 * created for recovery; `id` is the dedupe key that keeps the two projections
 * of the same incident from repeating.
 */
export interface TimelineEntry {
  /** Stable dedupe key: `${deviceId}:${startedAt}:${state}`. */
  id: string;
  deviceId: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  roomId: string;
  roomName: string | null;
  roomCode: string | null;
  location: string | null;
  state: 'CONNECTION_LOST' | 'RESTORED';
  /** Canonical UTC timestamp for this state (startedAt or resolvedAt). */
  timestamp: string;
  startedAt: string;
  resolvedAt: string | null;
  durationSeconds: number | null;
  /** True when the entry arrived through Socket.IO rather than the history API. */
  live: boolean;
}

export interface NetworkMonitoringFilters {
  search: string;
  status: string;
  deviceType: string;
  roomId: string;
  from: string;
  to: string;
}

/** Projects one API incident row into its loss/restored timeline state(s). */
export function incidentToTimelineEntries(event: NetworkMonitoringEvent): TimelineEntry[] {
  const base = {
    deviceId: event.networkDeviceId,
    deviceName: event.deviceName,
    deviceType: event.deviceType,
    ipAddress: event.ipAddress,
    roomId: event.roomId,
    roomName: event.roomName,
    roomCode: event.roomCode,
    location: event.location,
    startedAt: event.startedAt,
    resolvedAt: event.resolvedAt,
    durationSeconds: event.durationSeconds,
    live: false,
  };

  const entries: TimelineEntry[] = [
    {
      ...base,
      id: `${event.networkDeviceId}:${event.startedAt}:CONNECTION_LOST`,
      state: 'CONNECTION_LOST',
      timestamp: event.startedAt,
    },
  ];

  if (event.resolvedAt) {
    entries.push({
      ...base,
      id: `${event.networkDeviceId}:${event.startedAt}:RESTORED`,
      state: 'RESTORED',
      timestamp: event.resolvedAt,
    });
  }

  return entries;
}
