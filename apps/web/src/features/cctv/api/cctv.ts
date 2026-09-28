import { apiGet, apiPost, apiPut, apiPatch } from '@/lib/api-client';
import type {
  CctvChannel,
  CctvChannelFilters,
  CctvChannelInput,
  CctvDevice,
  CctvDeviceFilters,
  CctvDeviceInput,
  PaginationMeta,
  SyncResult,
  TestConnectionResult,
  TestRtspResult,
} from '../types';

/* ------------------------------- Devices ------------------------------- */

export function listCctvDevices(filters?: CctvDeviceFilters) {
  return apiGet<{ success: boolean; data: CctvDevice[]; meta: PaginationMeta }>(
    '/cctv/devices',
    filters as Record<string, string | number | undefined>,
  );
}

export function getCctvDevice(id: string) {
  return apiGet<{ success: boolean; data: CctvDevice }>(`/cctv/devices/${id}`);
}

export function createCctvDevice(data: CctvDeviceInput) {
  return apiPost<{ success: boolean; data: CctvDevice }>('/cctv/devices', data);
}

export function updateCctvDevice(id: string, data: Partial<CctvDeviceInput>) {
  return apiPut<{ success: boolean; data: CctvDevice }>(`/cctv/devices/${id}`, data);
}

export function setCctvDeviceStatus(id: string, isActive: boolean) {
  return apiPatch<{ success: boolean; data: CctvDevice }>(`/cctv/devices/${id}/status`, { isActive });
}

export function testCctvConnection(id: string) {
  return apiPost<{ success: boolean; data: TestConnectionResult }>(`/cctv/devices/${id}/test-connection`);
}

export function testCctvRtsp(
  id: string,
  body?: { channel?: number; includeMain?: boolean },
) {
  return apiPost<{ success: boolean; data: TestRtspResult }>(`/cctv/devices/${id}/test-rtsp`, body ?? {});
}

export function syncCctvChannels(id: string) {
  return apiPost<{ success: boolean; data: SyncResult }>(`/cctv/devices/${id}/sync`);
}

/* ------------------------------- Channels ------------------------------ */

export function listCctvChannels(filters?: CctvChannelFilters) {
  return apiGet<{ success: boolean; data: CctvChannel[]; meta: PaginationMeta }>(
    '/cctv/channels',
    filters as Record<string, string | number | undefined>,
  );
}

export function getCctvChannel(id: string) {
  return apiGet<{ success: boolean; data: CctvChannel }>(`/cctv/channels/${id}`);
}

export function updateCctvChannel(id: string, data: CctvChannelInput) {
  return apiPatch<{ success: boolean; data: CctvChannel }>(`/cctv/channels/${id}`, data);
}

export const cctvDeviceKeys = {
  all: ['cctv-devices'] as const,
  list: (filters: CctvDeviceFilters) => ['cctv-devices', 'list', filters] as const,
  detail: (id: string) => ['cctv-devices', 'detail', id] as const,
};

export const cctvChannelKeys = {
  all: ['cctv-channels'] as const,
  list: (filters: CctvChannelFilters) => ['cctv-channels', 'list', filters] as const,
  detail: (id: string) => ['cctv-channels', 'detail', id] as const,
};
