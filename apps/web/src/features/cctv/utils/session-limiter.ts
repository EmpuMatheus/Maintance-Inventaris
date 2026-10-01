/**
 * Small async semaphore that limits how many Live View sessions a Monitor grid
 * starts at the same time.
 *
 * The backend enforces a hard cap on concurrent sessions (`CCTV_LIVE_SESSION_MAX`);
 * this limiter only smooths the burst when many tiles mount together, so the
 * DVR and the server are not hit with N simultaneous RTSP pulls/FFmpeg starts.
 */

const DEFAULT_MAX = 4;
let max = DEFAULT_MAX;
let active = 0;
const waiters: Array<() => void> = [];
/** Listeners notified whenever a slot is released (Monitor waiting tiles). */
const listeners = new Set<() => void>();

/** Sets the maximum number of concurrent session starts (clamped to >= 1). */
export function configureSessionLimiter(next: number): void {
  if (!Number.isFinite(next)) return;
  max = Math.max(1, Math.floor(next));
}

/** Resolves when a slot is free, then marks it as taken. */
export function acquireSessionSlot(): Promise<void> {
  if (active < max) {
    active += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    waiters.push(() => {
      active += 1;
      resolve();
    });
  });
}

/**
 * Non-blocking acquisition: takes a slot immediately and returns true, or
 * returns false when the limit is reached. Used by Monitor tiles so a channel
 * beyond the concurrency cap can show "Waiting" instead of erroring.
 */
export function tryAcquireSessionSlot(): boolean {
  if (active < max) {
    active += 1;
    return true;
  }
  return false;
}

/** Releases a slot and hands it to the next waiter, if any. */
export function releaseSessionSlot(): void {
  active = Math.max(0, active - 1);
  const next = waiters.shift();
  if (next) next();
  // Wake gated Monitor tiles that were showing "Waiting" so an over-limit
  // channel starts as soon as capacity frees, without a fixed polling delay.
  for (const listener of Array.from(listeners)) {
    try {
      listener();
    } catch {
      // A listener must never break the release path.
    }
  }
}

/**
 * Subscribes to slot-release notifications. Returns an unsubscribe function.
 * Used by gated Monitor tiles to retry a blocked start immediately.
 */
export function subscribeSessionSlot(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot of the limiter, for diagnostics/tests. */
export function sessionLimiterState(): { max: number; active: number; waiting: number } {
  return { max, active, waiting: waiters.length };
}

/** Test-only: resets the limiter state. */
export function resetSessionLimiter(): void {
  max = DEFAULT_MAX;
  active = 0;
  waiters.length = 0;
  listeners.clear();
}
