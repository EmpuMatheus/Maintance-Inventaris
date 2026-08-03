import { describe, it, expect } from 'vitest';
import { buildRuntimeMetrics } from '@/modules/health/metrics';

describe('runtime metrics', () => {
  it('returns the expected monitoring fields', () => {
    const metrics = buildRuntimeMetrics();
    expect(metrics.status).toBe('ok');
    expect(metrics.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(metrics.memory.rss).toBeGreaterThan(0);
    expect(metrics.memory.heapUsed).toBeGreaterThan(0);
    expect(metrics.cpu).toBeDefined();
    expect(typeof metrics.cpu.user).toBe('number');
    expect(metrics.version).toBeTruthy();
    expect(metrics.environment).toBeTruthy();
    expect(metrics.nodeVersion).toMatch(/^v\d+/);
    expect(metrics.pid).toBeGreaterThan(0);
    expect(metrics.timestamp).toBeTruthy();
  });
});
