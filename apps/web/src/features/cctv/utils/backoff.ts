/**
 * Exponential backoff for stream reconnection.
 *
 * A stalled or dropped stream must be retried, but retrying every few hundred
 * milliseconds (or in a tight loop) makes a struggling server worse. This grows
 * the delay exponentially and caps it, so a permanently broken camera settles
 * into a slow retry instead of a reconnect storm.
 */

export interface BackoffOptions {
  /** Delay after the first failure, in ms. */
  baseMs?: number;
  /** Maximum delay between retries, in ms. */
  maxMs?: number;
  /** Growth factor per attempt. */
  factor?: number;
}

export const BACKOFF_BASE_MS = 1000;
export const BACKOFF_MAX_MS = 30_000;

/**
 * Delay before retry number `attempt` (0-based). `attempt = 0` yields `baseMs`.
 * The result never exceeds `maxMs` and is always a positive integer.
 */
export function nextBackoffDelay(attempt: number, options: BackoffOptions = {}): number {
  const { baseMs = BACKOFF_BASE_MS, maxMs = BACKOFF_MAX_MS, factor = 2 } = options;
  const base = Number.isFinite(baseMs) && baseMs > 0 ? baseMs : BACKOFF_BASE_MS;
  const max = Number.isFinite(maxMs) && maxMs > 0 ? maxMs : BACKOFF_MAX_MS;
  const growth = Number.isFinite(factor) && factor > 1 ? factor : 2;
  const n = Number.isFinite(attempt) && attempt > 0 ? Math.floor(attempt) : 0;
  return Math.min(max, Math.round(base * Math.pow(growth, n)));
}
