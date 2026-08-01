import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type { PaginatedResponse, MasterDataRecord } from '../types';

export function listResource(resource: string, params?: Record<string, string | number | undefined>) {
  return apiGet<PaginatedResponse<MasterDataRecord>>(`/master/${resource}`, params);
}

export function getResource(resource: string, id: string) {
  return apiGet<{ success: boolean; data: MasterDataRecord }>(`/master/${resource}/${id}`);
}

export function createResource(resource: string, data: Record<string, unknown>) {
  return apiPost<{ success: boolean; data: MasterDataRecord }>(`/master/${resource}`, data);
}

export function updateResource(resource: string, id: string, data: Record<string, unknown>) {
  return apiPatch<{ success: boolean; data: MasterDataRecord }>(`/master/${resource}/${id}`, data);
}

export function deactivateResource(resource: string, id: string) {
  return apiDelete<{ success: boolean; data: MasterDataRecord }>(`/master/${resource}/${id}`);
}
