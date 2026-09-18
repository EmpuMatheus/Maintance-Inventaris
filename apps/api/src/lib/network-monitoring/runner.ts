import { env } from '@/config/env';
import { logger } from '@/lib/logger';
import * as monitoringService from '@/modules/network-monitoring/monitoring.service';

/** Executes one full cycle over active devices and returns the outcomes. */
export type MonitorCycleRunner = () => Promise<unknown[]>;

let timer: NodeJS.Timeout | null = null;
let running = false;
let shuttingDown = false;

/** Default cycle implementation. Overridable so tests can inject a fake. */
let cycleRunner: MonitorCycleRunner = () => monitoringService.runMonitoringCycle();

/** Replaces the cycle implementation. Intended for dependency injection/tests. */
export function setMonitorCycleRunner(runner: MonitorCycleRunner): void {
  cycleRunner = runner;
}

/** Restores the default cycle implementation. */
export function resetMonitorCycleRunner(): void {
  cycleRunner = () => monitoringService.runMonitoringCycle();
}

/**
 * Fully resets runner state (timer, overlap flag, shutdown flag and injected
 * cycle). Intended for tests so one test cannot leak state into the next.
 */
export function resetNetworkMonitoringRunner(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
  shuttingDown = false;
  resetMonitorCycleRunner();
}

export function isCycleRunning(): boolean {
  return running;
}

export function isRunnerActive(): boolean {
  return timer !== null;
}

/**
 * Executes a single monitoring cycle.
 *
 * Anti-overlap: if a previous cycle is still in flight, this invocation is
 * skipped entirely. The in-memory flag is set synchronously before the first
 * `await`, so two concurrent ticks can never handshake past it. A single
 * device error is isolated inside the cycle and never aborts it. If the whole
 * cycle itself throws, the error is logged and the runner resumes on the next
 * tick — devices are never mass-marked OFFLINE.
 *
 * @returns `true` when the cycle ran, `false` when it was skipped.
 */
export async function runMonitoringCycleOnce(): Promise<boolean> {
  if (running) {
    logger.warn('Skipping network monitoring cycle: previous cycle still running');
    return false;
  }
  if (shuttingDown) {
    logger.warn('Skipping network monitoring cycle: shutdown in progress');
    return false;
  }

  running = true;
  try {
    const outcomes = await cycleRunner();
    if (outcomes.length > 0) {
      logger.info({ processed: outcomes.length }, 'Network monitoring cycle completed');
    }
    return true;
  } catch (error) {
    // A service failure must never mark all devices OFFLINE; the DB is only
    // written per-device inside the cycle (which already isolates).
    logger.error({ error }, 'Network monitoring cycle failed');
    return false;
  } finally {
    running = false;
  }
}

/**
 * Starts the 2-minute network monitoring runner. Independent of the existing
 * maintenance scheduler: it has its own interval and its own timer, so enabling
 * it never affects `SCHEDULE_PROCESS_INTERVAL_MINUTES`.
 *
 * The interval is configured via `NETWORK_MONITORING_INTERVAL_MINUTES`
 * (default 2). Calling start twice is safe: the previous timer is stopped
 * before a new one is scheduled, so hot-reloading the server cannot stack
 * multiple intervals.
 */
export function startNetworkMonitoringRunner(): void {
  stopNetworkMonitoringRunner();
  shuttingDown = false;

  const intervalMinutes = Math.max(1, env.NETWORK_MONITORING_INTERVAL_MINUTES);
  const intervalMs = intervalMinutes * 60 * 1000;

  // Run immediately on startup, then on the configured cadence.
  void runMonitoringCycleOnce();
  timer = setInterval(() => void runMonitoringCycleOnce(), intervalMs);
  timer.unref();
  logger.info({ intervalMinutes }, 'Network monitoring runner started');
}

/**
 * Stops the runner and signals any in-flight cycle to bail at its next
 * opportunity. Used on shutdown so no interval is left running after exit.
 */
export function stopNetworkMonitoringRunner(): void {
  shuttingDown = true;
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('Network monitoring runner stopped');
  }
}