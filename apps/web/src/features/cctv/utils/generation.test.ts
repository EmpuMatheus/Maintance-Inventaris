import { describe, it, expect } from 'vitest';
import { GenerationGuard } from './generation';

/**
 * The generation guard is the core protection against stale async lifecycles:
 * a Play request captured at generation N must not apply its result after a
 * Stop (or newer Play) has bumped the generation.
 */
describe('GenerationGuard (stale Play response protection)', () => {
  it('starts at generation 0', () => {
    const guard = new GenerationGuard();
    expect(guard.current).toBe(0);
  });

  it('only the latest generation is current', () => {
    const guard = new GenerationGuard();
    const firstPlay = guard.bump();
    expect(guard.isCurrent(firstPlay)).toBe(true);

    // User presses Stop (or a new Play): the old generation is invalidated.
    const stop = guard.bump();
    expect(guard.isCurrent(firstPlay)).toBe(false);
    expect(guard.isCurrent(stop)).toBe(true);
  });

  it('invalidates an in-flight Play when Stop is pressed', () => {
    const guard = new GenerationGuard();
    const playGen = guard.bump();
    // ...async create resolves later; a Stop in between bumps again...
    guard.bump();
    // The stale response must be rejected.
    expect(guard.isCurrent(playGen)).toBe(false);
  });

  it('a newer Play supersedes an older Play', () => {
    const guard = new GenerationGuard();
    const play1 = guard.bump();
    const play2 = guard.bump();
    expect(guard.isCurrent(play1)).toBe(false);
    expect(guard.isCurrent(play2)).toBe(true);
  });
});
