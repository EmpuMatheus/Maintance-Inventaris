import { analyticsConfig } from '@/config/env';
import * as repo from './analytics.repository';
import type {
  AnalyticsDashboard,
  AssetAnalyticsRow,
  AssetHealth,
  AssetReplacement,
  HealthCategory,
  Recommendation,
  RiskLevel,
} from './analytics.types';

const CONDITION_SCORES: Record<string, number> = {
  GOOD: 100,
  FAIR: 80,
  NEED_ATTENTION: 55,
  BROKEN: 25,
  CRITICAL: 5,
  RETIRED: 0,
};

const DAYS_PER_YEAR = 365.25;
const HOURS_PER_DAY = 24;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Maps a 0-100 health score to a health category. */
export function healthCategory(score: number): HealthCategory {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

export interface HealthFactorScores {
  age: number;
  maintenance: number;
  failureRatio: number;
  condition: number;
  downtime: number;
  tickets: number;
  criticalEvents: number;
}

/**
 * Computes the per-factor scores for an asset. Deterministic: the same asset
 * facts always produce the same scores.
 */
export function computeHealthFactors(row: AssetAnalyticsRow): HealthFactorScores {
  const lifespanYears = analyticsConfig.expectedLifespanYears;
  const ageYears = row.ageDays / DAYS_PER_YEAR;

  const age = clamp(100 - (ageYears / lifespanYears) * 100, 0, 100);

  const expectedMaintenance = Math.round(ageYears * 2);
  const maintenance = clamp(100 - Math.max(0, row.completedMaintenance - expectedMaintenance) * 8, 0, 100);

  const failureRatio = row.completedMaintenance > 0 ? row.correctiveMaintenance / row.completedMaintenance : 0;
  const failureRatioScore = 100 - failureRatio * 100;

  const condition = CONDITION_SCORES[row.condition] ?? 50;

  const downtimeHours = row.totalDowntimeMinutes / 60;
  const downtime = clamp(100 - downtimeHours * 1.5, 0, 100);

  const tickets = clamp(100 - row.ticketCount * 6, 0, 100);

  const criticalEvents = clamp(100 - row.criticalEvents * 12, 0, 100);

  return { age, maintenance, failureRatio: failureRatioScore, condition, downtime, tickets, criticalEvents };
}

/**
 * Combines factor scores using the configured weights and returns the final
 * 0-100 health score (rounded).
 */
export function computeHealthScore(row: AssetAnalyticsRow): number {
  const factors = computeHealthFactors(row);
  const w = analyticsConfig.weights;
  const totalWeight = w.age + w.maintenance + w.failureRatio + w.condition + w.downtime + w.tickets + w.criticalEvents;
  const weighted =
    factors.age * w.age +
    factors.maintenance * w.maintenance +
    factors.failureRatio * w.failureRatio +
    factors.condition * w.condition +
    factors.downtime * w.downtime +
    factors.tickets * w.tickets +
    factors.criticalEvents * w.criticalEvents;
  return clamp(Math.round(weighted / Math.max(totalWeight, 1)), 0, 100);
}

export interface FailureDetectionResult {
  isRepeated: boolean;
  reasons: string[];
}

/**
 * Detects repeated failures: too many corrective repairs, too many tickets, or
 * an abnormally high maintenance frequency within the configured window.
 */
export function detectRepeatedFailure(row: AssetAnalyticsRow): FailureDetectionResult {
  const reasons: string[] = [];
  if (row.correctiveMaintenance >= analyticsConfig.failureThreshold) {
    reasons.push(`${row.correctiveMaintenance} corrective repairs`);
  }
  if (row.ticketCount >= analyticsConfig.ticketThreshold) {
    reasons.push(`${row.ticketCount} tickets`);
  }
  const ageYears = row.ageDays / DAYS_PER_YEAR;
  const maintenancePerYear = ageYears > 0 ? row.completedMaintenance / ageYears : row.completedMaintenance;
  if (maintenancePerYear >= 6) {
    reasons.push(`abnormal maintenance frequency (${maintenancePerYear.toFixed(1)}/year)`);
  }
  return { isRepeated: reasons.length > 0, reasons };
}

export interface ReplacementResult {
  recommendation: Recommendation;
  reason: string;
  risk: RiskLevel;
}

/**
 * Replacement recommendation engine. Considers health score, age, maintenance
 * cost relative to purchase price, failure count, downtime and current
 * condition criticality.
 */
export function computeReplacement(row: AssetAnalyticsRow, healthScore: number): ReplacementResult {
  const cfg = analyticsConfig;
  const ageYears = row.ageDays / DAYS_PER_YEAR;
  const costRatio = row.purchasePrice > 0 ? row.totalMaintenanceCost / row.purchasePrice : row.totalMaintenanceCost;
  const downtimeDays = row.totalDowntimeMinutes / 60 / HOURS_PER_DAY;
  const criticality = row.condition === 'CRITICAL' || row.condition === 'BROKEN';

  const reasons: string[] = [];
  let recommendation: Recommendation = 'Keep';
  let risk: RiskLevel = 'Low';

  if (healthScore < cfg.replaceImmediateHealth || criticality) {
    recommendation = 'Replace Immediately';
    risk = criticality ? 'Critical' : 'High';
    reasons.push(`health score ${healthScore}/100 is critical`);
    if (criticality) reasons.push(`asset condition is ${row.condition}`);
  } else if (
    healthScore < cfg.replaceSoonHealth ||
    ageYears >= cfg.expectedLifespanYears * 0.85 ||
    (row.purchasePrice > 0 && costRatio >= cfg.replaceCostRatio) ||
    row.correctiveMaintenance >= cfg.failureThreshold + 2
  ) {
    recommendation = 'Replace Soon';
    risk = 'High';
    if (healthScore < cfg.replaceSoonHealth) reasons.push(`health score ${healthScore}/100 is poor`);
    if (ageYears >= cfg.expectedLifespanYears * 0.85) reasons.push(`asset is ${ageYears.toFixed(1)} years old`);
    if (row.purchasePrice > 0 && costRatio >= cfg.replaceCostRatio) reasons.push(`maintenance cost is ${(costRatio * 100).toFixed(0)}% of purchase price`);
    if (row.correctiveMaintenance >= cfg.failureThreshold + 2) reasons.push(`${row.correctiveMaintenance} corrective repairs`);
  } else if (healthScore < cfg.repairHealth || row.correctiveMaintenance >= cfg.failureThreshold || downtimeDays >= 1) {
    recommendation = 'Repair';
    risk = 'Medium';
    if (healthScore < cfg.repairHealth) reasons.push(`health score ${healthScore}/100 needs attention`);
    if (row.correctiveMaintenance >= cfg.failureThreshold) reasons.push(`${row.correctiveMaintenance} corrective repairs`);
    if (downtimeDays >= 1) reasons.push(`${downtimeDays.toFixed(1)} days downtime`);
  } else if (healthScore < 80 || ageYears >= cfg.expectedLifespanYears * 0.6) {
    recommendation = 'Monitor';
    risk = 'Low';
    if (ageYears >= cfg.expectedLifespanYears * 0.6) reasons.push(`asset is ${ageYears.toFixed(1)} years old`);
    if (healthScore < 80) reasons.push(`health score ${healthScore}/100`);
  } else {
    recommendation = 'Keep';
    risk = 'Low';
    reasons.push('asset is in good condition');
  }

  return { recommendation, reason: reasons.join('; '), risk };
}

function toHealthView(row: AssetAnalyticsRow): AssetHealth {
  const healthScore = computeHealthScore(row);
  return {
    id: row.id,
    assetCode: row.assetCode,
    assetName: row.assetName,
    condition: row.condition,
    ageYears: Number((row.ageDays / DAYS_PER_YEAR).toFixed(1)),
    healthScore,
    category: healthCategory(healthScore),
    repeatedFailure: detectRepeatedFailure(row).isRepeated,
    failures: row.correctiveMaintenance,
    downtimeDays: Number((row.totalDowntimeMinutes / 60 / HOURS_PER_DAY).toFixed(1)),
  };
}

function toReplacementView(row: AssetAnalyticsRow): AssetReplacement {
  const healthScore = computeHealthScore(row);
  const result = computeReplacement(row, healthScore);
  return {
    id: row.id,
    assetCode: row.assetCode,
    assetName: row.assetName,
    condition: row.condition,
    healthScore,
    category: healthCategory(healthScore),
    ageYears: Number((row.ageDays / DAYS_PER_YEAR).toFixed(1)),
    totalMaintenanceCost: row.totalMaintenanceCost,
    failures: row.correctiveMaintenance,
    downtimeDays: Number((row.totalDowntimeMinutes / 60 / HOURS_PER_DAY).toFixed(1)),
    recommendation: result.recommendation,
    reason: result.reason,
    risk: result.risk,
  };
}

export async function getHealthAnalytics(): Promise<{ assets: AssetHealth[]; distribution: { category: HealthCategory; value: number }[] }> {
  const rows = await repo.getAssetAnalyticsRows();
  const assets = rows.map(toHealthView);
  const categories: HealthCategory[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];
  const distribution = categories.map((category) => ({
    category,
    value: assets.filter((a) => a.category === category).length,
  }));
  return { assets, distribution };
}

export async function getReplacementAnalytics(): Promise<AssetReplacement[]> {
  const rows = await repo.getAssetAnalyticsRows();
  return rows.map(toReplacementView).sort((a, b) => rank(b.recommendation) - rank(a.recommendation));
}

function rank(r: Recommendation): number {
  return ['Keep', 'Monitor', 'Repair', 'Replace Soon', 'Replace Immediately'].indexOf(r);
}

export async function getFailureAnalytics(): Promise<{ assets: AssetHealth[]; events: Awaited<ReturnType<typeof repo.getRecentEvents>> }> {
  const rows = await repo.getAssetAnalyticsRows();
  const flagged = rows
    .map(toHealthView)
    .filter((a) => a.repeatedFailure)
    .sort((a, b) => b.failures - a.failures);
  const events = await repo.getRecentEvents(20);
  return { assets: flagged, events };
}

export async function getTrends() {
  const [maintenanceTrend, ticketTrend] = await Promise.all([
    repo.getMaintenanceMonthlyTrend(12),
    repo.getTicketMonthlyTrend(12),
  ]);
  return { maintenanceTrend, ticketTrend };
}

export async function getDashboard(): Promise<AnalyticsDashboard> {
  const rows = await repo.getAssetAnalyticsRows();
  const health = rows.map(toHealthView);
  const replacements = rows.map(toReplacementView);
  const categories: HealthCategory[] = ['Excellent', 'Good', 'Fair', 'Poor', 'Critical'];
  const healthDistribution = categories.map((category) => ({ category, value: health.filter((a) => a.category === category).length }));

  const ageBuckets = [
    { bucket: '< 1 yr', min: 0, max: 1 },
    { bucket: '1-3 yrs', min: 1, max: 3 },
    { bucket: '3-5 yrs', min: 3, max: 5 },
    { bucket: '5-7 yrs', min: 5, max: 7 },
    { bucket: '> 7 yrs', min: 7, max: Infinity },
  ];
  const ageDistribution = ageBuckets.map((b) => ({
    bucket: b.bucket,
    value: rows.filter((r) => r.ageDays / DAYS_PER_YEAR >= b.min && r.ageDays / DAYS_PER_YEAR < b.max).length,
  }));

  const conditions = ['GOOD', 'FAIR', 'NEED_ATTENTION', 'BROKEN', 'CRITICAL'];
  const conditionDistribution = conditions.map((condition) => ({
    condition,
    value: rows.filter((r) => r.condition === condition).length,
  }));

  const totalFailures = rows.reduce((sum, r) => sum + r.correctiveMaintenance, 0);
  const totalAgeDays = rows.reduce((sum, r) => sum + r.ageDays, 0);
  const mtbfDays = totalFailures > 0 ? totalAgeDays / totalFailures : 0;
  const mttrValues = rows.flatMap((r) => (r.mttrMinutes == null ? [] : [r.mttrMinutes]));
  const mttrMinutes = mttrValues.length > 0 ? mttrValues.reduce((a, b) => a + b, 0) / mttrValues.length : 0;
  const totalMaintenanceCost = rows.reduce((sum, r) => sum + r.totalMaintenanceCost, 0);
  const averageHealthScore = rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + computeHealthScore(r), 0) / rows.length) : 0;

  const topCritical = [...health].sort((a, b) => a.healthScore - b.healthScore).slice(0, 10);
  const replacementCandidates = replacements
    .filter((r) => r.recommendation === 'Replace Immediately' || r.recommendation === 'Replace Soon')
    .slice(0, 10);
  const mostExpensive = rows
    .map((r) => ({ id: r.id, assetCode: r.assetCode, assetName: r.assetName, condition: r.condition, totalMaintenanceCost: r.totalMaintenanceCost }))
    .sort((a, b) => b.totalMaintenanceCost - a.totalMaintenanceCost)
    .slice(0, 10);
  const mostProblematic = rows
    .map((r) => ({
      id: r.id,
      assetCode: r.assetCode,
      assetName: r.assetName,
      condition: r.condition,
      failures: r.correctiveMaintenance,
      tickets: r.ticketCount,
      downtimeDays: Number((r.totalDowntimeMinutes / 60 / HOURS_PER_DAY).toFixed(1)),
    }))
    .sort((a, b) => b.failures + b.tickets - (a.failures + a.tickets))
    .slice(0, 10);

  const [maintenanceTrend, ticketTrend, recentEvents] = await Promise.all([
    repo.getMaintenanceMonthlyTrend(12),
    repo.getTicketMonthlyTrend(12),
    repo.getRecentEvents(10),
  ]);

  return {
    summary: {
      totalAssets: rows.length,
      averageHealthScore,
      excellent: healthDistribution[0].value,
      good: healthDistribution[1].value,
      fair: healthDistribution[2].value,
      poor: healthDistribution[3].value,
      critical: healthDistribution[4].value,
      repeatedFailure: health.filter((a) => a.repeatedFailure).length,
      replaceImmediately: replacements.filter((r) => r.recommendation === 'Replace Immediately').length,
      replaceSoon: replacements.filter((r) => r.recommendation === 'Replace Soon').length,
      mtbfDays: Number(mtbfDays.toFixed(1)),
      mttrMinutes: Number(mttrMinutes.toFixed(1)),
      totalMaintenanceCost,
    },
    healthDistribution,
    ageDistribution,
    conditionDistribution,
    topCritical,
    replacementCandidates,
    mostExpensive,
    mostProblematic,
    maintenanceTrend,
    ticketTrend,
    recentEvents,
  };
}

/**
 * Recalculates and persists the health score and repeated-failure flag for every
 * asset. Timeline events are recorded only when state changes (newly flagged
 * repeated failures) or when a replacement recommendation crosses a threshold,
 * deduplicated within the failure window to avoid spam.
 */
export async function recalculateAll(now = new Date()): Promise<{ updated: number; events: number }> {
  const rows = await repo.getAssetAnalyticsRows();
  let updated = 0;
  let events = 0;
  for (const row of rows) {
    const score = computeHealthScore(row);
    const failure = detectRepeatedFailure(row);
    const replacement = computeReplacement(row, score);

    await repo.persistAssetAnalytics(row.id, score, failure.isRepeated);
    updated += 1;

    if (failure.isRepeated && !row.storedRepeatedFailure && !(await repo.hasRecentEvent(row.id, 'REPEATED_FAILURE', analyticsConfig.failureWindowDays))) {
      await repo.insertAnalyticsEvent({
        assetId: row.id,
        eventType: 'REPEATED_FAILURE',
        severity: 'WARNING',
        title: 'Repeated failure detected',
        message: `${row.assetName}: ${failure.reasons.join(', ')}.`,
        meta: { score, reasons: failure.reasons, at: now.toISOString() },
      });
      events += 1;
    }

    if (replacement.recommendation === 'Replace Immediately' || replacement.recommendation === 'Replace Soon') {
      const crossedThreshold =
        row.storedHealthScore == null ||
        (replacement.recommendation === 'Replace Immediately'
          ? row.storedHealthScore >= analyticsConfig.replaceImmediateHealth
          : row.storedHealthScore >= analyticsConfig.replaceSoonHealth);
      if (crossedThreshold && !(await repo.hasRecentEvent(row.id, 'REPLACEMENT_RECOMMENDED', analyticsConfig.failureWindowDays))) {
        await repo.insertAnalyticsEvent({
          assetId: row.id,
          eventType: 'REPLACEMENT_RECOMMENDED',
          severity: replacement.recommendation === 'Replace Immediately' ? 'CRITICAL' : 'WARNING',
          title: `${replacement.recommendation}: ${row.assetName}`,
          message: replacement.reason,
          meta: { score, recommendation: replacement.recommendation, risk: replacement.risk, at: now.toISOString() },
        });
        events += 1;
      }
    }
  }
  return { updated, events };
}
