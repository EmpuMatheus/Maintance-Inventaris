/**
 * Pure control logic for the live-session lifecycle.
 *
 * Kept framework-free so the "never autoplay unless the parent says so" rule
 * and the Play All / Stop All transitions can be unit-tested without React.
 */

/** Explicit lifecycle phases for a live player. */
export type PlayerPhase =
  | 'idle'
  | 'waiting'
  | 'starting'
  | 'playing'
  | 'error'
  | 'stopping';

/** The action a parent-controlled player should take when its props change. */
export type AutoStartAction = 'play' | 'stop' | 'none';

/**
 * Decides what a parent-controlled player should do.
 *
 * - `autoStart === true` (e.g. Monitor "Play All"): start once (no-op when a
 *   session is already running/starting/waiting).
 * - `autoStart === false` (default, and always in Live View): stop a running
 *   session, never start one. This is what guarantees Live View NEVER
 *   autoplays; query params only select the target.
 */
export function resolveAutoStartAction(input: {
  autoStart: boolean;
  hasTarget: boolean;
  running: boolean;
}): AutoStartAction {
  const { autoStart, hasTarget, running } = input;
  if (!hasTarget) return 'none';
  if (autoStart) return running ? 'none' : 'play';
  return running ? 'stop' : 'none';
}

/**
 * Maps the media player's own status onto the lifecycle phase. A late media
 * `playing`/`error` event must never resurrect a phase the user has already
 * left (stopping/idle), so terminal user-driven phases win.
 */
export function phaseFromPlayerStatus(
  status: 'connecting' | 'playing' | 'error',
  current: PlayerPhase,
): PlayerPhase {
  if (current === 'stopping' || current === 'idle') return current;
  if (status === 'playing') return 'playing';
  if (status === 'error') return 'error';
  return current;
}

/** True while a start/stop transition is in flight (buttons show a spinner). */
export function isBusyPhase(phase: PlayerPhase): boolean {
  return phase === 'starting' || phase === 'stopping';
}
