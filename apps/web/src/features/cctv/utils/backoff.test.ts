import { describe, it, expect } from 'vitest';
import { nextBackoffDelay, BACKOFF_BASE_MS, BACKOFF_MAX_MS } from './backoff';

describe('nextBackoffDelay', () => {
  it('grows exponentially from the base delay', () => {
    expect(nextBackoffDelay(0)).toBe(BACKOFF_BASE_MS);
    expect(nextBackoffDelay(1)).toBe(2000);
    expect(nextBackoffDelay(2)).toBe(4000);
    expect(nextBackoffDelay(3)).toBe(8000);
  });

  it('caps at the maximum interval', () => {
    expect(nextBackoffDelay(10)).toBe(BACKOFF_MAX_MS);
    expect(nextBackoffDelay(99)).toBe(BACKOFF_MAX_MS);
  });

  it('honours custom base/max/factor', () => {
    expect(nextBackoffDelay(0, { baseMs: 500, maxMs: 5000, factor: 3 })).toBe(500);
    expect(nextBackoffDelay(1, { baseMs: 500, maxMs: 5000, factor: 3 })).toBe(1500);
    expect(nextBackoffDelay(5, { baseMs: 500, maxMs: 5000, factor: 3 })).toBe(5000);
  });

  it('treats invalid input defensively', () => {
    expect(nextBackoffDelay(-1)).toBe(BACKOFF_BASE_MS);
    expect(nextBackoffDelay(Number.NaN)).toBe(BACKOFF_BASE_MS);
    expect(nextBackoffDelay(0, { baseMs: 0, maxMs: 0, factor: 1 })).toBe(BACKOFF_BASE_MS);
  });
});
