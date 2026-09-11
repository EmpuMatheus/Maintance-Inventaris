import { apiGet, apiPost, apiPut, apiPatch } from '@/lib/api-client';
import type {
  NetworkDevice,
  NetworkDeviceFilters,
  NetworkDeviceInput,
  PaginationMeta,
} from '../types';

export function listNetworkDevices(filters?: NetworkDeviceFilters) {
  return apiGet<{ success: boolean; data: NetworkDevice[]; meta: PaginationMeta }>(
    '/network-devices',
    filters as Record<string, string | number | undefined>,
  );
}

export function getNetworkDevice(id: string) {
  return apiGet<{ success: boolean; data: NetworkDevice }>(`/network-devices/${id}`);
}

export function createNetworkDevice(data: NetworkDeviceInput) {
  return apiPost<{ success: boolean; data: NetworkDevice }>('/network-devices', data);
}

export function updateNetworkDevice(id: string, data: Partial<NetworkDeviceInput>) {
  return apiPut<{ success: boolean; data: NetworkDevice }>(`/network-devices/${id}`, data);
}

export function setNetworkDeviceStatus(id: string, isActive: boolean) {
  return apiPatch<{ success: boolean; data: NetworkDevice }>(`/network-devices/${id}/status`, { isActive });
}

export const networkDeviceKeys = {
  all: ['network-devices'] as const,
  list: (filters: NetworkDeviceFilters) => ['network-devices', 'list', filters] as const,
  detail: (id: string) => ['network-devices', 'detail', id] as const,
};
