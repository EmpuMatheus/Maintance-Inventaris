import { describe, it, expect } from 'vitest';
import {
  gridConcurrency,
  staggerDelayMs,
  GRID_STREAM_CONCURRENCY,
  STREAM_START_STAGGER_MS,
  STREAM_START_STAGGER_MAX_MS,
} from './stream-startup';

describe('gridConcurrency', () => {
  it('uses the desired default when the backend cap is missing/invalid', () => {
    expect(gridConcurrency(undefined)).toBe(GRID_STREAM_CONCURRENCY);
    expect(gridConcurrency(0)).toBe(GRID_STREAM_CONCURRENCY);
    expect(gridConcurrency(Number.NaN)).toBe(GRID_STREAM_CONCURRENCY);
  });

  it('never exceeds the backend session cap', () => {
    expect(gridConcurrency(16)).toBe(GRID_STREAM_CONCURRENCY);
    expect(gridConcurrency(2)).toBe(2);
    expect(gridConcurrency(1)).toBe(1);
  });

  it('honours a custom desired concurrency (still capped)', () => {
    expect(gridConcurrency(16, 8)).toBe(8);
    expect(gridConcurrency(3, 8)).toBe(3);
  });

  it('is always at least 1', () => {
    expect(gridConcurrency(1, 0)).toBeGreaterThanOrEqual(1);
  });
});

describe('staggerDelayMs', () => {
  it('starts the first tile immediately and spaces the rest', () => {
    expect(staggerDelayMs(0)).toBe(0);
    expect(staggerDelayMs(1)).toBe(STREAM_START_STAGGER_MS);
    expect(staggerDelayMs(2)).toBe(STREAM_START_STAGGER_MS * 2);
  });

  it('caps the delay so a large wall still starts promptly', () => {
    expect(staggerDelayMs(1000)).toBe(STREAM_START_STAGGER_MAX_MS);
  });

  it('handles invalid input defensively', () => {
    expect(staggerDelayMs(-3)).toBe(0);
    expect(staggerDelayMs(Number.NaN)).toBe(0);
    expect(staggerDelayMs(2, 0)).toBe(0);
  });
});
