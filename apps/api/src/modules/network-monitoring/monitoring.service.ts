import { logger } from '@/lib/logger';
import { eventBus } from '@/lib/event-bus';
import { evaluateTransition } from './monitoring.state-machine';
import type { ICMPProvider } from './icmp/ping-provider';
import { BinaryPingProvider } from './icmp/binary-ping-provider';
import * as repo from './monitoring.repository';
import { buildOfflineEvent, buildRestoredEvent, deviceIdentityOf } from './monitoring.events';
import type { DeviceMonitorSnapshot, MonitorOutcome, MonitoringResult } from './monitoring.types';

/** Default provider instance (system ping binary). Overridable for tests. */
let provider: ICMPProvider = new BinaryPingProvider();

/** Replaces the active ICMP provider. Intended for dependency injection/tests. */
export function setIcmpProvider(next: ICMPProvider): void {
  provider = next;
}

export function getIcmpProvider(): ICMPProvider {
  return provider;
}

/**
 * Monitors a single device given its snapshot and IP, running the state machine
 * and persisting the resulting transition.
 *
 * Ordering contract (design §9):
 *   Monitoring Result -> State Machine -> Database Commit -> Event Bus -> Socket.IO
 * The event is published ONLY after the database write has completed, and only
 * on an actual state transition. Socket.IO delivery is a passive subscriber of
 * the event bus and can never roll back the committed database state.
 *
 * - Probe timestamps originate from the backend (never the browser).
 */
export async function monitorDeviceWithIp(
  snapshot: DeviceMonitorSnapshot,
  ipAddress: string,
  ping: ICMPProvider = provider,
): Promise<MonitorOutcome> {
  let result;
  try {
    result = await ping.ping(ipAddress);
  } catch (error) {
    // A broken probe (malformed IP, missing binary, provider error) must not
    // change the device state and must not stop the rest of the cycle.
    logger.warn({ error, deviceId: snapshot.id, ipAddress }, 'ICMP probe failed; device state left untouched');
    throw error;
  }

  const checkedAt = result.checkedAt;
  const monitoringResult: MonitoringResult = {
    deviceId: snapshot.id,
    success: result.success,
    checkedAt,
  };
  const action = evaluateTransition(snapshot, monitoringResult);

  switch (action.type) {
    case 'SET_ONLINE':
      await repo.applySuccess(snapshot.id, checkedAt, true);
      return { deviceId: snapshot.id, success: true, checkedAt, transition: 'UNKNOWN_ONLINE' };
    case 'STAY_ONLINE':
      await repo.applySuccess(snapshot.id, checkedAt, false);
      return { deviceId: snapshot.id, success: true, checkedAt, transition: 'STAY_ONLINE' };
    case 'INCREMENT_FAILURE':
      await repo.applyFailure(snapshot.id, action.consecutiveFailures, checkedAt);
      return { deviceId: snapshot.id, success: false, checkedAt, transition: 'INCREMENT_FAILURE' };
    case 'GO_OFFLINE': {
      const incidentId = await repo.applyOfflineWithIncident(
        snapshot.id,
        action.offlineStartedAt,
        action.consecutiveFailures,
      );
      // DB committed - now publish the transition event.
      publishOffline(snapshot, action.offlineStartedAt);
      return {
        deviceId: snapshot.id,
        success: false,
        checkedAt,
        transition: 'GO_OFFLINE',
        createdIncidentId: incidentId,
      };
    }
    case 'RECOVER': {
      const resolved = await repo.applyRecoveryWithResolve(snapshot.id, action.resolvedAt);
      // DB committed - now publish the transition event (only if an active
      // incident was actually resolved; without one there is nothing to restore).
      if (resolved) {
        publishRestored(snapshot, resolved.startedAt, action.resolvedAt, resolved.durationSeconds);
      }
      return {
        deviceId: snapshot.id,
        success: true,
        checkedAt,
        transition: 'RECOVERED',
        resolvedIncidentId: resolved?.incidentId,
        durationSeconds: resolved?.durationSeconds,
      };
    }
    case 'CONTINUE':
    default:
      // OFFLINE + FAIL: only last_ping_at advances; no new incident, no event.
      await repo.applyOfflineFailure(snapshot.id, checkedAt);
      return { deviceId: snapshot.id, success: false, checkedAt, transition: 'STAY_OFFLINE' };
  }
}

/** Publishes NETWORK_DEVICE_OFFLINE after commit. Socket failures cannot affect DB. */
function publishOffline(snapshot: DeviceMonitorSnapshot, startedAt: Date): void {
  try {
    eventBus.publish(buildOfflineEvent(deviceIdentityOf(snapshot), startedAt));
  } catch (error) {
    logger.error({ error, deviceId: snapshot.id }, 'Failed to publish network offline event');
  }
}

/** Publishes NETWORK_DEVICE_RESTORED after commit. */
function publishRestored(
  snapshot: DeviceMonitorSnapshot,
  startedAt: Date,
  resolvedAt: Date,
  durationSeconds: number,
): void {
  try {
    eventBus.publish(buildRestoredEvent(deviceIdentityOf(snapshot), startedAt, resolvedAt, durationSeconds));
  } catch (error) {
    logger.error({ error, deviceId: snapshot.id }, 'Failed to publish network restored event');
  }
}

/**
 * Monitors a single device by id. Uses the injected provider or the default.
 */
export async function monitorDeviceById(
  id: string,
  ping: ICMPProvider = provider,
): Promise<MonitorOutcome | null> {
  const row = await repo.findById(id);
  if (!row) return null;
  const snapshot: DeviceMonitorSnapshot = {
    id: row.id as string,
    status: row.status as DeviceMonitorSnapshot['status'],
    consecutiveFailures: row.consecutiveFailures as number,
    offlineStartedAt: (row.offlineStartedAt as Date | null) ?? null,
    lastPingAt: (row.lastPingAt as Date | null) ?? null,
    lastSuccessAt: (row.lastSuccessAt as Date | null) ?? null,
    lastStatusChangeAt: (row.lastStatusChangeAt as Date | null) ?? null,
    name: row.name as string,
    deviceType: row.deviceType as string,
    ipAddress: row.ipAddress as string,
    roomId: row.roomId as string,
  };
  return monitorDeviceWithIp(snapshot, row.ipAddress as string, ping);
}

/**
 * Runs one monitoring cycle over all active devices.
 *
 * Per-device errors are isolated: one failing probe never stops the cycle and
 * never marks other devices OFFLINE. Returns the outcomes of the devices that
 * were processed successfully.
 */
export async function runMonitoringCycle(ping: ICMPProvider = provider): Promise<MonitorOutcome[]> {
  const devices = await repo.findActiveDevices();
  const outcomes: MonitorOutcome[] = [];

  for (const device of devices) {
    try {
      const outcome = await monitorDeviceWithIp(device, device.ipAddress as string, ping);
      outcomes.push(outcome);
    } catch (error) {
      // Continue with the next device. The failed device keeps its previous
      // state; only a successful probe may transition it.
      logger.warn({ error, deviceId: device.id }, 'Monitoring failed for device; continuing cycle');
    }
  }

  return outcomes;
}

/**
 * Current monitoring state for all devices (recovery endpoint). All timestamps
 * are serialized as ISO 8601 UTC so the frontend can rebuild its view after a
 * Socket.IO reconnect without relying on any client clock.
 */
export async function getStatus() {
  const rows = await repo.findStatus();
  return rows.map((row) => ({
    ...row,
    lastPingAt: row.lastPingAt ? row.lastPingAt.toISOString() : null,
    lastSuccessAt: row.lastSuccessAt ? row.lastSuccessAt.toISOString() : null,
    lastStatusChangeAt: row.lastStatusChangeAt ? row.lastStatusChangeAt.toISOString() : null,
    offlineStartedAt: row.offlineStartedAt ? row.offlineStartedAt.toISOString() : null,
  }));
}

export async function getSummary() {
  return repo.findSummary();
}

function serializeEvent(row: repo.NetworkEventRow) {
  return {
    ...row,
    startedAt: row.startedAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Connection history (one incident per OFFLINE period). Timestamps leave the
 * API as ISO 8601 UTC; the frontend converts them for display only.
 * A resolved incident represents both the CONNECTION_LOST and RESTORED
 * timeline states - no second database row is created for recovery.
 */
export async function getEvents(filters: repo.EventFilters) {
  const result = await repo.findEvents(filters);
  return {
    data: result.data.map(serializeEvent),
    meta: result.meta,
  };
}

/** Incidents still in progress (`resolved_at IS NULL`). */
export async function getActiveIncidents() {
  const rows = await repo.findActiveIncidents();
  return rows.map(serializeEvent);
}