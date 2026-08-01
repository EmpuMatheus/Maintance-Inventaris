import { apiGet } from '@/lib/api-client';
import { config } from '@/app/config';
import { getStoredToken } from '@/services/auth';
import type {
  AgingFilters,
  AgingItem,
  AgingSummary,
  AssetConditionAnalytics,
  AssetConditionFilters,
  AssetConditionItem,
  AssetConditionSummary,
  BrokenAssetFilters,
  BrokenAssetItem,
  BrokenAssetSummary,
  InventoryReportFilters,
  InventoryReportItem,
  InventoryReportSummary,
  MaintenanceCostAnalytics,
  MaintenanceCostFilters,
  MaintenanceCostItem,
  MaintenanceCostSummary,
  MaintenanceReportFilters,
  MaintenanceReportItem,
  MaintenanceReportSummary,
  MovementFilters,
  MovementItem,
  MovementSummary,
  PaginationMeta,
  VendorWarranty,
  WarrantyFilters,
  WarrantyItem,
  WarrantySummary,
} from '../types';

export interface InventoryReportResponse {
  success: boolean;
  items: InventoryReportItem[];
  summary: InventoryReportSummary;
  meta: PaginationMeta;
}

export interface MaintenanceReportResponse {
  success: boolean;
  items: MaintenanceReportItem[];
  summary: MaintenanceReportSummary;
  meta: PaginationMeta;
}

export interface MaintenanceCostReportResponse {
  success: boolean;
  items: MaintenanceCostItem[];
  summary: MaintenanceCostSummary;
  analytics: MaintenanceCostAnalytics;
  meta: PaginationMeta;
}

export interface AssetConditionReportResponse {
  success: boolean;
  items: AssetConditionItem[];
  summary: AssetConditionSummary;
  analytics: AssetConditionAnalytics;
  meta: PaginationMeta;
}

export function getInventoryReport(filters?: InventoryReportFilters) {
  return apiGet<InventoryReportResponse>(
    '/reports/inventory',
    filters as Record<string, string | number | undefined>,
  );
}

export function getMaintenanceReport(filters?: MaintenanceReportFilters) {
  return apiGet<MaintenanceReportResponse>(
    '/reports/maintenance',
    filters as Record<string, string | number | undefined>,
  );
}

export function getMaintenanceCostReport(filters?: MaintenanceCostFilters) {
  return apiGet<MaintenanceCostReportResponse>(
    '/reports/maintenance-cost',
    filters as Record<string, string | number | undefined>,
  );
}

export function getAssetConditionReport(filters?: AssetConditionFilters) {
  return apiGet<AssetConditionReportResponse>(
    '/reports/asset-condition',
    filters as Record<string, string | number | undefined>,
  );
}

export interface BrokenAssetReportResponse {
  success: boolean;
  items: BrokenAssetItem[];
  summary: BrokenAssetSummary;
  analytics: { byCategory: { name: string; value: number }[] };
  meta: PaginationMeta;
}

export function getBrokenAssetReport(filters?: BrokenAssetFilters) {
  return apiGet<BrokenAssetReportResponse>(
    '/reports/broken-asset',
    filters as Record<string, string | number | undefined>,
  );
}

export interface MovementReportResponse {
  success: boolean;
  items: MovementItem[];
  summary: MovementSummary;
  analytics: { byType: { name: string; value: number }[] };
  meta: PaginationMeta;
}

export function getMovementReport(filters?: MovementFilters) {
  return apiGet<MovementReportResponse>(
    '/reports/movement',
    filters as Record<string, string | number | undefined>,
  );
}

export interface WarrantyReportResponse {
  success: boolean;
  items: WarrantyItem[];
  summary: WarrantySummary;
  analytics: { byVendor: VendorWarranty[] };
  meta: PaginationMeta;
}

export function getWarrantyReport(filters?: WarrantyFilters) {
  return apiGet<WarrantyReportResponse>(
    '/reports/warranty',
    filters as Record<string, string | number | undefined>,
  );
}

export interface AssetAgingReportResponse {
  success: boolean;
  items: AgingItem[];
  summary: AgingSummary;
  analytics: { byAge: { name: string; value: number }[]; byCategory: { name: string; count: number; avgAgeYears: number }[] };
  meta: PaginationMeta;
}

export function getAssetAgingReport(filters?: AgingFilters) {
  return apiGet<AssetAgingReportResponse>(
    '/reports/asset-aging',
    filters as Record<string, string | number | undefined>,
  );
}

/** Downloads an XLSX export for a report using the current auth token. */
export async function downloadReport(report: string, filters?: Record<string, unknown>): Promise<void> {
  const sp = new URLSearchParams();
  if (filters) {
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== '') sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  const res = await fetch(`${config.apiUrl}/reports/${report}/export${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${getStoredToken() ?? ''}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: { message?: string } }).error?.message || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${report}-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const reportKeys = {
  all: ['reports'] as const,
  inventory: (filters: InventoryReportFilters) => ['reports', 'inventory', filters] as const,
  maintenance: (filters: MaintenanceReportFilters) => ['reports', 'maintenance', filters] as const,
  maintenanceCost: (filters: MaintenanceCostFilters) => ['reports', 'maintenance-cost', filters] as const,
  assetCondition: (filters: AssetConditionFilters) => ['reports', 'asset-condition', filters] as const,
  brokenAsset: (filters: BrokenAssetFilters) => ['reports', 'broken-asset', filters] as const,
  movement: (filters: MovementFilters) => ['reports', 'movement', filters] as const,
  warranty: (filters: WarrantyFilters) => ['reports', 'warranty', filters] as const,
  assetAging: (filters: AgingFilters) => ['reports', 'asset-aging', filters] as const,
};
