import { describe, it, expect } from 'vitest';
import {
  resolveAutoStartAction,
  phaseFromPlayerStatus,
  isBusyPhase,
  type PlayerPhase,
} from './player-control';

/**
 * These rules are what guarantee:
 *  - Live View NEVER autoplays (autoStart is always false there);
 *  - Monitor starts/stops only on the parent "Play All"/"Stop All" switch;
 *  - a stale media event cannot resurrect a stopped player.
 */
describe('resolveAutoStartAction (no autoplay unless the parent says so)', () => {
  it('does nothing when there is no target', () => {
    expect(resolveAutoStartAction({ autoStart: true, hasTarget: false, running: false })).toBe('none');
    expect(resolveAutoStartAction({ autoStart: false, hasTarget: false, running: true })).toBe('none');
  });

  it('Live View default (autoStart=false) never starts a session', () => {
    expect(resolveAutoStartAction({ autoStart: false, hasTarget: true, running: false })).toBe('none');
  });

  it('Play All (autoStart=true) starts once, then does not restart a running tile', () => {
    expect(resolveAutoStartAction({ autoStart: true, hasTarget: true, running: false })).toBe('play');
    expect(resolveAutoStartAction({ autoStart: true, hasTarget: true, running: true })).toBe('none');
  });

  it('Stop All (autoStart=false) stops a running tile, no-op when idle', () => {
    expect(resolveAutoStartAction({ autoStart: false, hasTarget: true, running: true })).toBe('stop');
    expect(resolveAutoStartAction({ autoStart: false, hasTarget: true, running: false })).toBe('none');
  });
});

describe('phaseFromPlayerStatus (stale media events cannot resurrect a stop)', () => {
  const phases: PlayerPhase[] = ['idle', 'waiting', 'starting', 'playing', 'error', 'stopping'];

  it('maps playing/error normally', () => {
    expect(phaseFromPlayerStatus('playing', 'starting')).toBe('playing');
    expect(phaseFromPlayerStatus('error', 'starting')).toBe('error');
    expect(phaseFromPlayerStatus('connecting', 'starting')).toBe('starting');
  });

  it('never overrides stopping or idle', () => {
    for (const p of ['stopping', 'idle'] as PlayerPhase[]) {
      expect(phaseFromPlayerStatus('playing', p)).toBe(p);
      expect(phaseFromPlayerStatus('error', p)).toBe(p);
      expect(phaseFromPlayerStatus('connecting', p)).toBe(p);
    }
    // Sanity: all phases are covered by the type.
    expect(phases).toHaveLength(6);
  });
});

describe('isBusyPhase', () => {
  it('is true only for starting/stopping', () => {
    expect(isBusyPhase('starting')).toBe(true);
    expect(isBusyPhase('stopping')).toBe(true);
    expect(isBusyPhase('idle')).toBe(false);
    expect(isBusyPhase('playing')).toBe(false);
    expect(isBusyPhase('error')).toBe(false);
    expect(isBusyPhase('waiting')).toBe(false);
  });
});
