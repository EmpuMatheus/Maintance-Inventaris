import type { NetworkDeviceStatus } from '@/database/schema';

/** Result of a single monitoring probe for a device. */
export interface MonitoringResult {
  deviceId: string;
  /**
   * True when the device responded to the probe. Timestamps always originate
   * from the backend/server - never from a browser.
   */
  success: boolean;
  checkedAt: Date;
}

/** Snapshot of the device monitoring state used by the pure state machine. */
export interface DeviceMonitorSnapshot {
  id: string;
  status: NetworkDeviceStatus;
  consecutiveFailures: number;
  offlineStartedAt: Date | null;
  lastPingAt: Date | null;
  lastSuccessAt: Date | null;
  lastStatusChangeAt: Date | null;
  /** Device metadata used to build realtime event payloads (optional in tests). */
  name?: string;
  deviceType?: string;
  ipAddress?: string;
  roomId?: string;
}

/**
 * The raw effects a transition produces. The service is responsible for
 * applying them to the database inside a single transaction.
 */
export type MonitorAction =
  | { type: 'CONTINUE' }
  | { type: 'SET_ONLINE' }
  | { type: 'STAY_ONLINE' }
  | { type: 'INCREMENT_FAILURE'; consecutiveFailures: number }
  | { type: 'GO_OFFLINE'; offlineStartedAt: Date; consecutiveFailures: number }
  | { type: 'RECOVER'; resolvedAt: Date; startedAt: Date; durationSeconds: number };

/** Human/consumer-friendly summary of what happened for a given probe. */
export interface MonitorOutcome {
  deviceId: string;
  success: boolean;
  checkedAt: Date;
  transition:
    | 'UNKNOWN_ONLINE'
    | 'STAY_ONLINE'
    | 'INCREMENT_FAILURE'
    | 'GO_OFFLINE'
    | 'STAY_OFFLINE'
    | 'RECOVERED';
  createdIncidentId?: string;
  resolvedIncidentId?: string;
  durationSeconds?: number;
}