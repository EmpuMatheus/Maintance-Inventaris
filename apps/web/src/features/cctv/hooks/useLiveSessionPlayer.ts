import { useCallback, useEffect, useRef, useState } from 'react';
import { createCctvLiveSession, stopCctvLiveSession } from '../api/cctv';
import {
  releaseSessionSlot,
  subscribeSessionSlot,
  tryAcquireSessionSlot,
} from '../utils/session-limiter';
import { nextBackoffDelay } from '../utils/backoff';
import { GenerationGuard } from '../utils/generation';
import {
  phaseFromPlayerStatus,
  resolveAutoStartAction,
  type PlayerPhase,
} from '../utils/player-control';
import { isAbortError } from '@/lib/api-client';
import type { CctvLiveSession, CctvLiveStreamKind } from '../types';

export type { PlayerPhase } from '../utils/player-control';

export interface UseLiveSessionPlayerOptions {
  deviceId?: string;
  channelId?: string;
  streamKind: CctvLiveStreamKind;
  /** Gate session creation with the shared concurrency limiter (Monitor). */
  gated?: boolean;
  /**
   * Parent-controlled running flag. `true` starts a session, `false` stops it.
   * Defaults to `false`, so a player NEVER starts on its own. Live View always
   * leaves this false and only starts on an explicit user Play.
   */
  autoStart?: boolean;
  /**
   * Delay the very first negotiation by this many ms (staggered wall startup).
   * Cancelled when the target changes, the player stops, or it unmounts.
   */
  startDelayMs?: number;
  /** Fallback retry delay for a gated "waiting" tile (slot release is instant). */
  waitRetryMs?: number;
}

export interface LiveSessionPlayer {
  phase: PlayerPhase;
  session: CctvLiveSession | null;
  error: string | null;
  /** True while an automatic reconnect is scheduled/in progress. */
  reconnecting: boolean;
  /** Number of consecutive failed attempts (reset on success). */
  retryAttempt: number;
  play: () => void;
  stop: () => void;
  /** Alias for `play`, kept for callers that expose a Retry action. */
  retry: () => void;
  /** Feed the media player status back into the lifecycle. */
  notifyPlayerStatus: (status: 'connecting' | 'playing' | 'error') => void;
}

/**
 * Owns ONE live-session lifecycle: create -> connect -> stop.
 *
 * Guarantees:
 *  - NEVER autoplays on its own. A session is created only by an explicit
 *    `play()` call or a parent-set `autoStart === true`.
 *  - A monotonic generation guard means a stale create/stop response can never
 *    overwrite newer state (e.g. Stop pressed while Play is in flight).
 *  - An AbortController cancels the in-flight create on Stop/unmount.
 *  - The previous session is stopped BEFORE a new one is created, so the
 *    backend never reuses a session that is about to be torn down.
 *  - When `gated`, a shared session limiter caps how many tiles negotiate at
 *    once; over-limit tiles show "waiting" and start as soon as a slot frees.
 *  - A failed stream is retried with exponential backoff (capped), and the
 *    retry state is exposed so the tile can show it.
 */
export function useLiveSessionPlayer(options: UseLiveSessionPlayerOptions): LiveSessionPlayer {
  const {
    deviceId,
    channelId,
    streamKind,
    gated = false,
    autoStart = false,
    startDelayMs = 0,
    waitRetryMs = 5000,
  } = options;

  const [phase, setPhase] = useState<PlayerPhase>('idle');
  const [session, setSession] = useState<CctvLiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);

  const genRef = useRef(new GenerationGuard());
  const abortRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const heldSlotRef = useRef(false);
  const waitTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const mountedRef = useRef(true);
  const runningRef = useRef(false);
  const phaseRef = useRef<PlayerPhase>('idle');
  const autoStartRef = useRef(false);
  const keyRef = useRef(`${deviceId ?? ''}|${channelId ?? ''}|${streamKind}`);
  const playRef = useRef<() => void>(() => {});
  const stopRef = useRef<() => void>(() => {});

  const transition = useCallback((next: PlayerPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const releaseSlot = useCallback(() => {
    if (heldSlotRef.current) {
      heldSlotRef.current = false;
      releaseSessionSlot();
    }
  }, []);

  const clearWait = useCallback(() => {
    if (waitTimerRef.current !== null) {
      window.clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
  }, []);

  const clearRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  const scheduleWaitRetry = useCallback(
    (gen: number) => {
      transition('waiting');
      clearWait();
      waitTimerRef.current = window.setTimeout(() => {
        if (genRef.current.isCurrent(gen) && mountedRef.current) playRef.current();
      }, waitRetryMs);
    },
    [transition, clearWait, waitRetryMs],
  );

  /**
   * Schedules a reconnect with exponential backoff. Only runs while the tile
   * is still meant to be playing (`running`), so a stopped/unmounted tile never
   * keeps hammering the server.
   */
  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current || !runningRef.current) return;
    // Negotiation is over (it failed); free the gate for other tiles.
    releaseSlot();
    clearRetry();
    const delay = nextBackoffDelay(attemptRef.current);
    attemptRef.current += 1;
    setRetryAttempt(attemptRef.current);
    setReconnecting(true);
    retryTimerRef.current = window.setTimeout(() => {
      if (mountedRef.current && runningRef.current) playRef.current();
    }, delay);
  }, [releaseSlot, clearRetry]);

  const play = useCallback(() => {
    if (!deviceId || !channelId) return;
    const gen = genRef.current.bump();
    clearWait();
    clearRetry();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    runningRef.current = true;

    // Discard the session this hook currently owns before opening a new one.
    const prevId = sessionIdRef.current;
    sessionIdRef.current = null;
    setSession(null);
    setError(null);
    transition('starting');

    const begin = async () => {
      // Stagger: spread a wall's first negotiations instead of a thundering
      // herd. The timer is intentionally not cleared on re-play; the generation
      // check below bails out if the target changed while waiting.
      if (startDelayMs > 0 && genRef.current.isCurrent(gen)) {
        await new Promise<void>((resolve) => window.setTimeout(resolve, startDelayMs));
        if (!genRef.current.isCurrent(gen) || !mountedRef.current) return;
      }

      if (prevId) {
        // Await teardown so the backend does not reuse the old (about-to-die)
        // session for the new request.
        await stopCctvLiveSession(prevId).catch(() => {});
        if (!genRef.current.isCurrent(gen)) return;
      }

      if (gated && !heldSlotRef.current) {
        if (!tryAcquireSessionSlot()) {
          if (!genRef.current.isCurrent(gen)) return;
          scheduleWaitRetry(gen);
          return;
        }
        heldSlotRef.current = true;
      }

      try {
        const res = await createCctvLiveSession(
          { deviceId, channelId, streamKind },
          controller.signal,
        );
        if (!genRef.current.isCurrent(gen)) {
          void stopCctvLiveSession(res.data.id).catch(() => {});
          releaseSlot();
          return;
        }
        sessionIdRef.current = res.data.id;
        setSession(res.data);
        transition('starting');
      } catch (e) {
        if (!genRef.current.isCurrent(gen) || isAbortError(e)) {
          releaseSlot();
          return;
        }
        const code = (e as { code?: string })?.code;
        const status = (e as { status?: number })?.status;
        // Over the backend cap: release our slot, wait and retry rather than
        // surfacing a hard error (other sessions will free up).
        if (code === 'TOO_MANY_SESSIONS' || status === 429) {
          releaseSlot();
          scheduleWaitRetry(gen);
          return;
        }
        setError((e as Error)?.message ?? 'Unable to open stream.');
        transition('error');
        scheduleReconnect();
      }
    };

    void begin();
  }, [
    deviceId,
    channelId,
    streamKind,
    gated,
    startDelayMs,
    clearWait,
    clearRetry,
    releaseSlot,
    scheduleWaitRetry,
    scheduleReconnect,
    transition,
  ]);

  playRef.current = play;

  const stop = useCallback(() => {
    genRef.current.bump();
    clearWait();
    clearRetry();
    abortRef.current?.abort();
    abortRef.current = null;
    runningRef.current = false;
    attemptRef.current = 0;
    setReconnecting(false);
    setRetryAttempt(0);
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    setSession(null);
    setError(null);
    releaseSlot();
    if (id) {
      transition('stopping');
      void stopCctvLiveSession(id)
        .catch(() => {})
        .finally(() => {
          if (mountedRef.current) transition('idle');
        });
    } else {
      transition('idle');
    }
  }, [clearWait, clearRetry, releaseSlot, transition]);

  stopRef.current = stop;

  const notifyPlayerStatus = useCallback(
    (status: 'connecting' | 'playing' | 'error') => {
      const next = phaseFromPlayerStatus(status, phaseRef.current);
      transition(next);
      // Only reconnect while the tile is still meant to play.
      if (status === 'error' && next === 'error') scheduleReconnect();
    },
    [transition, scheduleReconnect],
  );

  const retry = useCallback(() => playRef.current(), []);

  // A live stream frees its start slot and clears the reconnect state.
  useEffect(() => {
    if (phase === 'playing') {
      attemptRef.current = 0;
      clearRetry();
      setRetryAttempt(0);
      setReconnecting(false);
      releaseSlot();
    }
  }, [phase, clearRetry, releaseSlot]);

  // Target change: stop what we own and go idle. Declared BEFORE the
  // auto-start effect so its teardown runs first on a target switch.
  useEffect(() => {
    const key = `${deviceId ?? ''}|${channelId ?? ''}|${streamKind}`;
    if (keyRef.current === key) return;
    keyRef.current = key;
    genRef.current.bump();
    clearWait();
    clearRetry();
    abortRef.current?.abort();
    abortRef.current = null;
    runningRef.current = false;
    attemptRef.current = 0;
    setReconnecting(false);
    setRetryAttempt(0);
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    setSession(null);
    releaseSlot();
    if (id) void stopCctvLiveSession(id).catch(() => {});
    transition('idle');
  }, [deviceId, channelId, streamKind, clearWait, clearRetry, releaseSlot, transition]);

  // Parent-controlled start/stop. `autoStart` defaults to false, so nothing
  // starts on mount — Live View stays idle until the user presses Play.
  useEffect(() => {
    autoStartRef.current = autoStart;
    if (!deviceId || !channelId) return;
    const action = resolveAutoStartAction({
      autoStart,
      hasTarget: true,
      running: runningRef.current,
    });
    if (action === 'play') playRef.current();
    else if (action === 'stop') stopRef.current();
  }, [autoStart, deviceId, channelId]);

  // Gated tiles: when a start slot is released, retry a blocked start
  // immediately instead of waiting for the fallback timer.
  useEffect(() => {
    if (!gated) return;
    const unsubscribe = subscribeSessionSlot(() => {
      if (!mountedRef.current) return;
      if (!autoStartRef.current) return;
      if (phaseRef.current !== 'waiting') return;
      playRef.current();
    });
    return unsubscribe;
  }, [gated]);

  // Unmount cleanup: always stop the session this hook owns (no handoff is
  // needed now that Live View never autoplays).
  useEffect(() => {
    const guard = genRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      guard.bump();
      clearWait();
      clearRetry();
      abortRef.current?.abort();
      abortRef.current = null;
      const id = sessionIdRef.current;
      sessionIdRef.current = null;
      if (id) void stopCctvLiveSession(id).catch(() => {});
      releaseSlot();
    };
  }, [clearWait, clearRetry, releaseSlot]);

  return { phase, session, error, reconnecting, retryAttempt, play, stop, retry, notifyPlayerStatus };
}
