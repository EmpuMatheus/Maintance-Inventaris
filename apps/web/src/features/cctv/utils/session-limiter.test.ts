import { describe, it, expect, beforeEach } from 'vitest';
import {
  acquireSessionSlot,
  tryAcquireSessionSlot,
  releaseSessionSlot,
  configureSessionLimiter,
  resetSessionLimiter,
  subscribeSessionSlot,
  sessionLimiterState,
} from './session-limiter';

describe('session limiter', () => {
  beforeEach(() => resetSessionLimiter());

  it('grants slots up to the configured maximum without blocking', async () => {
    configureSessionLimiter(2);
    await acquireSessionSlot();
    await acquireSessionSlot();
    releaseSessionSlot();
    releaseSessionSlot();
    expect(true).toBe(true);
  });

  it('queues further acquisitions until a slot is released', async () => {
    configureSessionLimiter(1);
    await acquireSessionSlot();

    let secondAcquired = false;
    const pending = acquireSessionSlot().then(() => {
      secondAcquired = true;
    });

    await Promise.resolve();
    expect(secondAcquired).toBe(false);

    releaseSessionSlot();
    await pending;
    expect(secondAcquired).toBe(true);

    releaseSessionSlot();
  });

  it('never drops below zero on extra releases', () => {
    configureSessionLimiter(1);
    releaseSessionSlot();
    releaseSessionSlot();
    expect(true).toBe(true);
  });

  it('clamps a non-positive configured maximum to 1', async () => {
    configureSessionLimiter(0);
    await acquireSessionSlot();
    let second = false;
    void acquireSessionSlot().then(() => {
      second = true;
    });
    await Promise.resolve();
    expect(second).toBe(false);
    releaseSessionSlot();
  });

  it('tryAcquireSessionSlot grants up to the max then returns false (Waiting)', () => {
    configureSessionLimiter(2);
    expect(tryAcquireSessionSlot()).toBe(true);
    expect(tryAcquireSessionSlot()).toBe(true);
    // Over the cap: the Monitor shows Waiting instead of erroring.
    expect(tryAcquireSessionSlot()).toBe(false);
    // A released slot frees a new acquisition.
    releaseSessionSlot();
    expect(tryAcquireSessionSlot()).toBe(true);
  });

  it('resets tryAcquire slot accounting', () => {
    configureSessionLimiter(1);
    expect(tryAcquireSessionSlot()).toBe(true);
    expect(tryAcquireSessionSlot()).toBe(false);
    resetSessionLimiter();
    expect(tryAcquireSessionSlot()).toBe(true);
  });

  it('notifies subscribers when a slot is released (Monitor waiting tiles)', () => {
    configureSessionLimiter(1);
    expect(tryAcquireSessionSlot()).toBe(true);
    // Over the cap: a Monitor tile would show "Waiting".
    expect(tryAcquireSessionSlot()).toBe(false);

    let notified = 0;
    const unsubscribe = subscribeSessionSlot(() => {
      notified += 1;
    });

    releaseSessionSlot();
    expect(notified).toBe(1);
    // The freed slot can now be acquired without waiting for a poll.
    expect(tryAcquireSessionSlot()).toBe(true);

    // After unsubscribing, no further notifications.
    unsubscribe();
    releaseSessionSlot();
    expect(notified).toBe(1);
  });

  it('exposes a diagnostic state snapshot', () => {
    configureSessionLimiter(2);
    expect(sessionLimiterState()).toEqual({ max: 2, active: 0, waiting: 0 });
    void acquireSessionSlot();
    expect(sessionLimiterState().active).toBe(1);
    releaseSessionSlot();
  });
});
