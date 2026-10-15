/**
 * Concurrency + staggering policy for the CCTV Monitor wall.
 *
 * The backend enforces a hard cap on concurrent live sessions
 * (`CCTV_LIVE_SESSION_MAX`) and each session also starts an FFmpeg ingest on the
 * server. Opening a 16-tile wall all at once hammers the DVR with 16 RTSP
 * handshakes/DESCRIBEs and 16 FFmpeg spawns simultaneously, which is what caused
 * the stutter. These helpers bound how many streams negotiate at once and
 * spread the rest out over time.
 *
 * They are pure so the policy is unit-tested without a browser.
 */

/** How many sessions may negotiate at the same time by default. */
export const GRID_STREAM_CONCURRENCY = 4;

/** Spacing between successive stream starts (ms). */
export const STREAM_START_STAGGER_MS = 250;

/** Upper bound on the stagger delay so a big wall still starts promptly. */
export const STREAM_START_STAGGER_MAX_MS = 4000;

/**
 * Concurrency for the grid/wall: at most `desired` streams negotiate at once,
 * never more than the backend session cap. Always >= 1.
 */
export function gridConcurrency(
  maxSessions: number | undefined,
  desired: number = GRID_STREAM_CONCURRENCY,
): number {
  const want = Number.isFinite(desired) && desired > 0 ? Math.floor(desired) : GRID_STREAM_CONCURRENCY;
  const cap = Number.isFinite(maxSessions) && (maxSessions as number) > 0 ? Math.floor(maxSessions as number) : want;
  return Math.max(1, Math.min(want, cap));
}

/**
 * Stagger delay for the tile at `index` in the start queue. Tile 0 starts
 * immediately; each subsequent tile waits a little longer, capped so the last
 * tile of a large wall still starts quickly.
 */
export function staggerDelayMs(
  index: number,
  staggerMs: number = STREAM_START_STAGGER_MS,
  maxMs: number = STREAM_START_STAGGER_MAX_MS,
): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  const step = Number.isFinite(staggerMs) && staggerMs > 0 ? Math.floor(staggerMs) : 0;
  return Math.min(maxMs, Math.floor(index) * step);
}
