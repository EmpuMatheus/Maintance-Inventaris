import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from '@/lib/api-client';
import { config } from '@/app/config';
import type {
  CctvChannel,
  CctvChannelFilters,
  CctvChannelInput,
  CctvDevice,
  CctvDeviceFilters,
  CctvDeviceInput,
  CctvLiveLimits,
  CctvLiveSession,
  CctvMonitorChannel,
  CreateCctvLiveSessionInput,
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

/** Every active channel across all devices, for the Monitor grid. */
export function listMonitorChannels() {
  return apiGet<{ success: boolean; data: CctvMonitorChannel[] }>('/cctv/channels/monitor');
}

export function getCctvChannel(id: string) {
  return apiGet<{ success: boolean; data: CctvChannel }>(`/cctv/channels/${id}`);
}

export function updateCctvChannel(id: string, data: CctvChannelInput) {
  return apiPatch<{ success: boolean; data: CctvChannel }>(`/cctv/channels/${id}`, data);
}

/* ----------------------------- Live sessions ---------------------------- */

export function createCctvLiveSession(data: CreateCctvLiveSessionInput, signal?: AbortSignal) {
  return apiPost<{ success: boolean; data: CctvLiveSession }>('/cctv/live-sessions', data, false, signal);
}

export function getCctvLiveSession(id: string) {
  return apiGet<{ success: boolean; data: CctvLiveSession }>(`/cctv/live-sessions/${id}`);
}

export function stopCctvLiveSession(id: string, signal?: AbortSignal) {
  return apiDelete<{ success: boolean; data: { stopped: boolean } }>(`/cctv/live-sessions/${id}`, undefined, signal);
}

/**
 * Viewer heartbeat: renews the live-session TTL so an active stream is not
 * reaped after the base TTL. Cheap and safe to call on an interval.
 */
export function heartbeatCctvLiveSession(id: string) {
  return apiPost<{ success: boolean; data: { id: string; expiresAt: string } }>(
    `/cctv/live-sessions/${id}/heartbeat`,
  );
}

export function getCctvLiveLimits() {
  return apiGet<{ success: boolean; data: CctvLiveLimits }>('/cctv/live-sessions/limits');
}

/** Absolute, same-origin URL for a live-session sub-resource (WHEP/HLS). */
export function cctvLiveSessionUrl(relative: string): string {
  return `${config.apiUrl}${relative}`;
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

export const cctvLiveSessionKeys = {
  all: ['cctv-live-sessions'] as const,
  detail: (id: string) => ['cctv-live-sessions', 'detail', id] as const,
};
