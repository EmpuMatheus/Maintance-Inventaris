import { streamingGatewayConfig } from '@/config/env';
import { logger } from '@/lib/logger';
import { reapExpiredLiveSessions } from '@/modules/cctv/cctv.live.service';

/**
 * Periodic reaper for CCTV Live View sessions.
 *
 * The gateway pulls an RTSP source per session; if a viewer disappears without
 * calling DELETE (closed tab, network drop), the session row and its gateway
 * path would linger. This reaper closes any session whose TTL has elapsed,
 * which also closes the on-demand gateway path and releases the pull.
 *
 * It shares the interface of the other background runners (start/stop + a
 * cycle override for tests) so it can be exercised without a real timer.
 */

export type LiveSessionReapRunner = () => Promise<number>;

let timer: NodeJS.Timeout | null = null;
let running = false;
let shuttingDown = false;
let reapRunner: LiveSessionReapRunner = () => reapExpiredLiveSessions();

/** Replaces the reap implementation. Intended for dependency injection/tests. */
export function setLiveSessionReapRunner(runner: LiveSessionReapRunner): void {
  reapRunner = runner;
}

/** Restores the default reap implementation and clears runner state. */
export function resetLiveSessionReaper(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
  shuttingDown = false;
  reapRunner = () => reapExpiredLiveSessions();
}

export function isReapRunning(): boolean {
  return running;
}

/** Runs a single reap cycle, guarding against overlap. */
export async function runReapCycleOnce(): Promise<boolean> {
  if (running || shuttingDown) return false;
  running = true;
  try {
    await reapRunner();
    return true;
  } catch (error) {
    logger.warn({ error }, 'Live session reap cycle failed');
    return false;
  } finally {
    running = false;
  }
}

/**
 * Starts the reaper. The interval is a quarter of the session TTL (bounded
 * between 5s and 60s) so expired sessions are closed promptly without churn.
 */
export function startLiveSessionReaper(): void {
  stopLiveSessionReaper();
  shuttingDown = false;

  const ttlMs = streamingGatewayConfig.sessionTtlSeconds * 1000;
  const intervalMs = Math.min(60_000, Math.max(5_000, Math.round(ttlMs / 4)));
  timer = setInterval(() => void runReapCycleOnce(), intervalMs);
  timer.unref();
  logger.info({ intervalMs }, 'CCTV live session reaper started');
}

/** Stops the reaper and signals any in-flight cycle to stop on its next tick. */
export function stopLiveSessionReaper(): void {
  shuttingDown = true;
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('CCTV live session reaper stopped');
  }
}
