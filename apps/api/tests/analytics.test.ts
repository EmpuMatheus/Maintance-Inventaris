import { describe, it, expect } from 'vitest';
import {
  computeHealthScore,
  healthCategory,
  computeReplacement,
  detectRepeatedFailure,
  computeHealthFactors,
} from '@/modules/analytics/analytics.service';
import type { AssetAnalyticsRow } from '@/modules/analytics/analytics.types';

function row(overrides: Partial<AssetAnalyticsRow>): AssetAnalyticsRow {
  return {
    id: 'a',
    assetCode: 'AST-1',
    assetName: 'Test Asset',
    condition: 'GOOD',
    status: 'AVAILABLE',
    categoryId: null,
    subcategoryId: null,
    purchaseDate: null,
    purchasePrice: 0,
    ageDays: 0,
    completedMaintenance: 0,
    correctiveMaintenance: 0,
    preventiveMaintenance: 0,
    totalMaintenanceCost: 0,
    totalDowntimeMinutes: 0,
    mttrMinutes: null,
    ticketCount: 0,
    criticalEvents: 0,
    lastConditionChangeAt: null,
    storedHealthScore: null,
    storedRepeatedFailure: false,
    ...overrides,
  };
}

describe('health score', () => {
  it('scores a new, healthy asset as Excellent', () => {
    const score = computeHealthScore(row({}));
    expect(score).toBeGreaterThanOrEqual(85);
    expect(healthCategory(score)).toBe('Excellent');
  });

  it('scores a broken, expensive asset as Critical', () => {
    const score = computeHealthScore(
      row({
        condition: 'CRITICAL',
        ageDays: 8 * 365,
        completedMaintenance: 20,
        correctiveMaintenance: 15,
        totalDowntimeMinutes: 10 * 24 * 60,
        ticketCount: 12,
        criticalEvents: 6,
      }),
    );
    expect(score).toBeLessThan(40);
    expect(healthCategory(score)).toBe('Critical');
  });

  it('is deterministic for identical inputs', () => {
    const a = row({ condition: 'FAIR', ageDays: 1000, correctiveMaintenance: 2, ticketCount: 1 });
    expect(computeHealthScore(a)).toBe(computeHealthScore({ ...a }));
  });

  it('respects the 0-100 bounds', () => {
    const best = computeHealthFactors(row({}));
    const worst = computeHealthFactors(
      row({ condition: 'CRITICAL', ageDays: 30 * 365, completedMaintenance: 100, correctiveMaintenance: 100, totalDowntimeMinutes: 50000, ticketCount: 100, criticalEvents: 100 }),
    );
    for (const key of Object.keys(best) as (keyof typeof best)[]) {
      expect(best[key]).toBeGreaterThanOrEqual(0);
      expect(best[key]).toBeLessThanOrEqual(100);
      expect(worst[key]).toBeGreaterThanOrEqual(0);
      expect(worst[key]).toBeLessThanOrEqual(100);
    }
  });

  it('maps scores to categories', () => {
    expect(healthCategory(90)).toBe('Excellent');
    expect(healthCategory(75)).toBe('Good');
    expect(healthCategory(60)).toBe('Fair');
    expect(healthCategory(45)).toBe('Poor');
    expect(healthCategory(20)).toBe('Critical');
  });
});

describe('repeated failure detection', () => {
  it('flags assets with enough corrective repairs', () => {
    const result = detectRepeatedFailure(row({ correctiveMaintenance: 4 }));
    expect(result.isRepeated).toBe(true);
    expect(result.reasons.some((r) => r.includes('4 corrective repairs'))).toBe(true);
  });

  it('flags assets with enough tickets', () => {
    const result = detectRepeatedFailure(row({ ticketCount: 5 }));
    expect(result.isRepeated).toBe(true);
  });

  it('does not flag healthy assets', () => {
    const result = detectRepeatedFailure(row({ correctiveMaintenance: 1, ticketCount: 1, completedMaintenance: 2 }));
    expect(result.isRepeated).toBe(false);
  });
});

describe('replacement recommendation', () => {
  it('recommends Replace Immediately for critical assets', () => {
    const result = computeReplacement(row({ condition: 'BROKEN', ageDays: 6 * 365, correctiveMaintenance: 5 }), 25);
    expect(result.recommendation).toBe('Replace Immediately');
    expect(result.risk).toBe('Critical');
    expect(result.reason.length).toBeGreaterThan(0);
  });

  it('recommends Replace Soon for poor health', () => {
    const result = computeReplacement(row({ ageDays: 4 * 365 }), 42);
    expect(result.recommendation).toBe('Replace Soon');
    expect(result.risk).toBe('High');
  });

  it('recommends Replace Soon when maintenance cost exceeds purchase price ratio', () => {
    const result = computeReplacement(row({ purchasePrice: 1000, totalMaintenanceCost: 700, ageDays: 2 * 365, correctiveMaintenance: 2 }), 75);
    expect(result.recommendation).toBe('Replace Soon');
    expect(result.reason).toContain('maintenance cost');
  });

  it('recommends Keep for healthy assets', () => {
    const result = computeReplacement(row({}), 95);
    expect(result.recommendation).toBe('Keep');
    expect(result.risk).toBe('Low');
  });
});
