import type { DeviceMonitorSnapshot, MonitorAction, MonitoringResult } from './monitoring.types';

/** Number of consecutive failures that flips a device from ONLINE to OFFLINE. */
export const OFFLINE_FAILURE_THRESHOLD = 2;

/**
 * Pure state machine for a single monitoring result.
 *
 * | status  | probe   | effect                                                   |
 * |---------|---------|----------------------------------------------------------|
 * | UNKNOWN | SUCCESS | -> ONLINE                                                 |
 * | UNKNOWN | FAIL    | stays UNKNOWN                                             |
 * | ONLINE  | SUCCESS | stays ONLINE                                              |
 * | ONLINE  | FAIL    | increment failure; when >= 2 -> OFFLINE                   |
 * | OFFLINE | FAIL    | stays OFFLINE (no new incident, no started_at change)     |
 * | OFFLINE | SUCCESS | -> ONLINE and resolve the active incident                 |
 *
 * The function has no side effects: it only classifies the transition. The
 * service applies the returned action to the database inside a transaction.
 */
export function evaluateTransition(
  snapshot: DeviceMonitorSnapshot,
  result: MonitoringResult,
): MonitorAction {
  const { status, consecutiveFailures } = snapshot;
  const { success, checkedAt } = result;

  if (status === 'OFFLINE') {
    if (success) {
      const startedAt = snapshot.offlineStartedAt ?? checkedAt;
      const durationSeconds = Math.max(0, Math.floor((checkedAt.getTime() - startedAt.getTime()) / 1000));
      return { type: 'RECOVER', resolvedAt: checkedAt, startedAt, durationSeconds };
    }
    // OFFLINE + FAIL: never create another incident or move started_at.
    return { type: 'CONTINUE' };
  }

  if (success) {
    return status === 'UNKNOWN' ? { type: 'SET_ONLINE' } : { type: 'STAY_ONLINE' };
  }

  // Failure while ONLINE: only this path can cross the threshold to OFFLINE.
  if (status === 'ONLINE') {
    const nextFailures = consecutiveFailures + 1;
    return nextFailures >= OFFLINE_FAILURE_THRESHOLD
      ? { type: 'GO_OFFLINE', offlineStartedAt: checkedAt, consecutiveFailures: nextFailures }
      : { type: 'INCREMENT_FAILURE', consecutiveFailures: nextFailures };
  }

  // UNKNOWN + FAIL stays UNKNOWN (monitoring state not established yet). The
  // failure counter is still tracked, but never crosses OFFLINE from UNKNOWN.
  return { type: 'INCREMENT_FAILURE', consecutiveFailures: consecutiveFailures + 1 };
}