export type HealthCategory = 'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Critical';
export type Recommendation = 'Keep' | 'Monitor' | 'Repair' | 'Replace Soon' | 'Replace Immediately';
export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface AssetHealth {
  id: string;
  assetCode: string;
  assetName: string;
  condition: string;
  ageYears: number;
  healthScore: number;
  category: HealthCategory;
  repeatedFailure: boolean;
  failures: number;
  downtimeDays: number;
}

export interface AssetReplacement {
  id: string;
  assetCode: string;
  assetName: string;
  condition: string;
  healthScore: number;
  category: HealthCategory;
  ageYears: number;
  totalMaintenanceCost: number;
  failures: number;
  downtimeDays: number;
  recommendation: Recommendation;
  reason: string;
  risk: RiskLevel;
}

export interface AnalyticsEvent {
  id: string;
  assetId: string | null;
  assetCode: string | null;
  assetName: string | null;
  eventType: string;
  severity: string;
  title: string;
  message: string | null;
  createdAt: string;
}

export interface MonthlyTrendPoint {
  month: string;
  label: string;
  value: number;
}

export interface AnalyticsDashboard {
  summary: {
    totalAssets: number;
    averageHealthScore: number;
    excellent: number;
    good: number;
    fair: number;
    poor: number;
    critical: number;
    repeatedFailure: number;
    replaceImmediately: number;
    replaceSoon: number;
    mtbfDays: number;
    mttrMinutes: number;
    totalMaintenanceCost: number;
  };
  healthDistribution: { category: HealthCategory; value: number }[];
  ageDistribution: { bucket: string; value: number }[];
  conditionDistribution: { condition: string; value: number }[];
  topCritical: AssetHealth[];
  replacementCandidates: AssetReplacement[];
  mostExpensive: { id: string; assetCode: string; assetName: string; condition: string; totalMaintenanceCost: number }[];
  mostProblematic: { id: string; assetCode: string; assetName: string; condition: string; failures: number; tickets: number; downtimeDays: number }[];
  maintenanceTrend: MonthlyTrendPoint[];
  ticketTrend: MonthlyTrendPoint[];
  recentEvents: AnalyticsEvent[];
}

export interface HealthAnalytics {
  assets: AssetHealth[];
  distribution: { category: HealthCategory; value: number }[];
}

export interface FailureAnalytics {
  assets: AssetHealth[];
  events: AnalyticsEvent[];
}
