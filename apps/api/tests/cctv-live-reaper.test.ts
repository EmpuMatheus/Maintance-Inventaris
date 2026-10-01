import { describe, it, expect, afterEach } from 'vitest';
import {
  setLiveSessionReapRunner,
  resetLiveSessionReaper,
  runReapCycleOnce,
  isReapRunning,
} from '@/lib/streaming/reaper';

describe('cctv live session reaper', () => {
  afterEach(() => {
    resetLiveSessionReaper();
  });

  it('runs the injected reap runner and reports success', async () => {
    let called = 0;
    setLiveSessionReapRunner(async () => {
      called += 1;
      return 0;
    });
    const ran = await runReapCycleOnce();
    expect(ran).toBe(true);
    expect(called).toBe(1);
  });

  it('skips overlapping cycles while one is in flight', async () => {
    let started = 0;
    let release: (() => void) | null = null;
    setLiveSessionReapRunner(
      () =>
        new Promise<number>((resolve) => {
          started += 1;
          release = () => resolve(0);
        }),
    );

    const first = runReapCycleOnce();
    const second = await runReapCycleOnce(); // overlap: skipped
    expect(second).toBe(false);
    expect(isReapRunning()).toBe(true);

    release?.();
    await first;
    expect(started).toBe(1);
    expect(isReapRunning()).toBe(false);
  });

  it('survives a failing reap runner without throwing', async () => {
    setLiveSessionReapRunner(async () => {
      throw new Error('db down');
    });
    await expect(runReapCycleOnce()).resolves.toBe(false);
  });
});
