import { apiGet, apiPost, apiDelete, apiUpload } from '@/lib/api-client';
import type {
  DetailResponse,
  MaintenanceDetail,
  MaintenanceDocument,
  MaintenanceListItem,
  MaintenancePart,
  PaginatedResponse,
} from '../types';

export interface MaintenanceFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  typeId?: string;
  technicianId?: string;
}

export function listMaintenance(params?: MaintenanceFilters) {
  return apiGet<PaginatedResponse<MaintenanceListItem>>(
    '/maintenance',
    params as Record<string, string | number | undefined>,
  );
}

export function getMaintenance(id: string) {
  return apiGet<DetailResponse<MaintenanceDetail>>(`/maintenance/${id}`);
}

export function createMaintenance(data: Record<string, unknown>) {
  return apiPost<DetailResponse<MaintenanceDetail>>('/maintenance', data);
}

export function assignMaintenance(id: string, data: Record<string, unknown>) {
  return apiPost<DetailResponse<unknown>>(`/maintenance/${id}/assign`, data);
}

export function startMaintenance(id: string) {
  return apiPost<DetailResponse<unknown>>(`/maintenance/${id}/start`);
}

export function waitingPartMaintenance(id: string, data: Record<string, unknown>) {
  return apiPost<DetailResponse<unknown>>(`/maintenance/${id}/waiting-part`, data);
}

export function testingMaintenance(id: string) {
  return apiPost<DetailResponse<unknown>>(`/maintenance/${id}/testing`);
}

export function completeMaintenance(id: string, data: Record<string, unknown>) {
  return apiPost<DetailResponse<unknown>>(`/maintenance/${id}/complete`, data);
}

export function cancelMaintenance(id: string, data: Record<string, unknown>) {
  return apiPost<DetailResponse<unknown>>(`/maintenance/${id}/cancel`, data);
}

export function listMaintenanceParts(id: string) {
  return apiGet<DetailResponse<MaintenancePart[]>>(`/maintenance/${id}/parts`);
}

export function addMaintenancePart(id: string, data: Record<string, unknown>) {
  return apiPost<DetailResponse<MaintenancePart>>(`/maintenance/${id}/parts`, data);
}

export function deleteMaintenancePart(id: string, partId: string) {
  return apiDelete<{ success: boolean; data: null }>(`/maintenance/${id}/parts/${partId}`);
}

export function listMaintenanceDocuments(id: string) {
  return apiGet<DetailResponse<MaintenanceDocument[]>>(`/maintenance/${id}/documents`);
}

export function uploadMaintenanceDocument(id: string, file: File, documentType: string) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('documentType', documentType);
  return apiUpload<DetailResponse<unknown>>(`/maintenance/${id}/documents`, 'POST', fd);
}

export const maintenanceKeys = {
  all: ['maintenance'] as const,
  list: (filters: MaintenanceFilters) => ['maintenance', 'list', filters] as const,
  detail: (id: string) => ['maintenance', 'detail', id] as const,
  parts: (id: string) => ['maintenance', 'parts', id] as const,
  documents: (id: string) => ['maintenance', 'documents', id] as const,
};
