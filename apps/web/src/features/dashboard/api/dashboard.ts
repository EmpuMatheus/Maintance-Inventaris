import { apiGet } from '@/lib/api-client';
import type { MaintenanceSchedule } from '@/features/maintenance-schedules/types';

export interface DashboardSummary {
  assets: {
    total: number;
    good: number;
    fair: number;
    needAttention: number;
    broken: number;
    critical: number;
    inMaintenance: number;
  };
  maintenance: {
    dueToday: number;
    upcoming: number;
    overdue: number;
    completedThisMonth: number;
  };
  tickets: {
    open: number;
    critical: number;
    resolvedToday: number;
    avgResolutionHours: number;
  };
  notifications: {
    unread: number;
  };
}

export interface DashboardMaintenanceStats {
  byStatus: { status: string; value: number }[];
  byType: { type: string | null; value: number }[];
  monthlyTrend: { month: string; label: string; value: number }[];
}

export interface CriticalAsset {
  id: string;
  assetCode: string;
  assetName: string;
  condition: string;
  status: string;
}

export interface DashboardAssetStats {
  byStatus: { status: string; value: number }[];
  byCategory: { category: string; value: number }[];
}

export interface DashboardConditionAnalytics {
  byCondition: { condition: string; value: number }[];
}

export interface DashboardAssetAge {
  byAge: { bucket: string; value: number }[];
}

export interface DashboardDepartmentAnalytics {
  byDepartment: { department: string; value: number }[];
}

export interface DashboardVendorAnalytics {
  byVendor: { vendor: string; value: number }[];
}

export interface RecentActivityItem {
  type: string;
  title: string;
  description: string;
  reference: string | null;
  createdAt: string;
}

export function getDashboardSummary() {
  return apiGet<{ success: boolean; data: DashboardSummary }>('/dashboard/summary');
}

export function getDashboardMaintenanceStats() {
  return apiGet<{ success: boolean; data: DashboardMaintenanceStats }>('/dashboard/maintenance');
}

export function getDashboardUpcomingSchedules(params?: { days?: number; limit?: number }) {
  return apiGet<{ success: boolean; data: MaintenanceSchedule[]; meta: { total: number } }>(
    '/dashboard/upcoming-schedules',
    params as Record<string, string | number | undefined>,
  );
}

export function getDashboardCriticalAssets() {
  return apiGet<{ success: boolean; data: CriticalAsset[] }>('/dashboard/critical-assets');
}

export function getDashboardAssetStats() {
  return apiGet<{ success: boolean; data: DashboardAssetStats }>('/dashboard/asset-stats');
}

export function getDashboardConditionAnalytics() {
  return apiGet<{ success: boolean; data: DashboardConditionAnalytics }>('/dashboard/condition-analytics');
}

export function getDashboardAssetAge() {
  return apiGet<{ success: boolean; data: DashboardAssetAge }>('/dashboard/asset-age');
}

export function getDashboardDepartmentAnalytics() {
  return apiGet<{ success: boolean; data: DashboardDepartmentAnalytics }>('/dashboard/department-analytics');
}

export function getDashboardVendorAnalytics() {
  return apiGet<{ success: boolean; data: DashboardVendorAnalytics }>('/dashboard/vendor-analytics');
}

export function getDashboardRecentActivity(params?: { limit?: number }) {
  return apiGet<{ success: boolean; data: RecentActivityItem[] }>(
    '/dashboard/recent-activity',
    params as Record<string, string | number | undefined>,
  );
}

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: ['dashboard', 'summary'] as const,
  maintenance: ['dashboard', 'maintenance'] as const,
  upcoming: ['dashboard', 'upcoming-schedules'] as const,
  critical: ['dashboard', 'critical-assets'] as const,
  assetStats: ['dashboard', 'asset-stats'] as const,
  condition: ['dashboard', 'condition-analytics'] as const,
  age: ['dashboard', 'asset-age'] as const,
  department: ['dashboard', 'department-analytics'] as const,
  vendor: ['dashboard', 'vendor-analytics'] as const,
  activity: ['dashboard', 'recent-activity'] as const,
};
