import { apiGet } from '@/lib/api-client';
import type { AnalyticsDashboard, AssetReplacement, FailureAnalytics, HealthAnalytics, MonthlyTrendPoint } from '../types';

interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export const analyticsKeys = {
  all: ['analytics'] as const,
  dashboard: () => [...analyticsKeys.all, 'dashboard'] as const,
  health: () => [...analyticsKeys.all, 'health'] as const,
  replacement: () => [...analyticsKeys.all, 'replacement'] as const,
  failures: () => [...analyticsKeys.all, 'failures'] as const,
  trends: () => [...analyticsKeys.all, 'trends'] as const,
};

export function getAnalyticsDashboard(): Promise<AnalyticsDashboard> {
  return apiGet<ApiResponse<AnalyticsDashboard>>('/analytics/dashboard').then((r) => r.data);
}

export function getAnalyticsHealth(): Promise<HealthAnalytics> {
  return apiGet<ApiResponse<HealthAnalytics>>('/analytics/health').then((r) => r.data);
}

export function getAnalyticsReplacement(): Promise<AssetReplacement[]> {
  return apiGet<ApiResponse<AssetReplacement[]>>('/analytics/replacement').then((r) => r.data);
}

export function getAnalyticsFailures(): Promise<FailureAnalytics> {
  return apiGet<ApiResponse<FailureAnalytics>>('/analytics/failures').then((r) => r.data);
}

export function getAnalyticsTrends(): Promise<{ maintenanceTrend: MonthlyTrendPoint[]; ticketTrend: MonthlyTrendPoint[] }> {
  return apiGet<ApiResponse<{ maintenanceTrend: MonthlyTrendPoint[]; ticketTrend: MonthlyTrendPoint[] }>>('/analytics/trends').then((r) => r.data);
}
