import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  runMonitoringCycleOnce,
  startNetworkMonitoringRunner,
  stopNetworkMonitoringRunner,
  setMonitorCycleRunner,
  resetNetworkMonitoringRunner,
  isCycleRunning,
  isRunnerActive,
} from '@/lib/network-monitoring/runner';

afterEach(() => {
  resetNetworkMonitoringRunner();
  vi.useRealTimers();
});

describe('Network monitoring runner', () => {
  it('runs a cycle and returns true', async () => {
    let calls = 0;
    setMonitorCycleRunner(async () => {
      calls += 1;
      return [];
    });
    const ran = await runMonitoringCycleOnce();
    expect(ran).toBe(true);
    expect(calls).toBe(1);
  });

  it('skips a cycle when the previous one is still running (anti-overlap)', async () => {
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    setMonitorCycleRunner(async () => {
      calls += 1;
      await gate;
      return [];
    });

    const first = runMonitoringCycleOnce();
    // Second invocation while the first is in-flight must be skipped.
    const second = await runMonitoringCycleOnce();
    expect(second).toBe(false);
    expect(calls).toBe(1);
    expect(isCycleRunning()).toBe(true);

    release();
    expect(await first).toBe(true);
    expect(isCycleRunning()).toBe(false);
  });

  it('does not mark devices offline / does not throw when the whole cycle fails', async () => {
    setMonitorCycleRunner(async () => {
      throw new Error('monitoring service exploded');
    });
    const ran = await runMonitoringCycleOnce();
    expect(ran).toBe(false);
    // The runner survives and can run again on the next tick.
    expect(isCycleRunning()).toBe(false);
  });

  it('starts an interval that ticks repeatedly', async () => {
    vi.useFakeTimers();
    let calls = 0;
    setMonitorCycleRunner(async () => {
      calls += 1;
      return [];
    });

    startNetworkMonitoringRunner();
    expect(isRunnerActive()).toBe(true);

    // Immediate startup run.
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);

    // Default interval is 2 minutes.
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(calls).toBe(2);
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    expect(calls).toBe(3);
  });

  it('starting twice does not create duplicate intervals', async () => {
    vi.useFakeTimers();
    let calls = 0;
    setMonitorCycleRunner(async () => {
      calls += 1;
      return [];
    });

    startNetworkMonitoringRunner();
    await vi.advanceTimersByTimeAsync(0);
    startNetworkMonitoringRunner();
    await vi.advanceTimersByTimeAsync(0);

    // The first cycle of each start ran (2 total), but only one timer exists.
    await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
    const callsAfterOneTick = calls;
    // Exactly one additional tick from a single interval (not two).
    expect(callsAfterOneTick).toBe(3);
    expect(isRunnerActive()).toBe(true);
  });

  it('stops the interval on shutdown and suppresses further runs', async () => {
    vi.useFakeTimers();
    let calls = 0;
    setMonitorCycleRunner(async () => {
      calls += 1;
      return [];
    });

    startNetworkMonitoringRunner();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toBe(1);

    stopNetworkMonitoringRunner();
    expect(isRunnerActive()).toBe(false);

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
    expect(calls).toBe(1);
  });
});