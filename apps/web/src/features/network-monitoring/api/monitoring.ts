import { apiGet } from '@/lib/api-client';

export interface NetworkDeviceStatus {
  id: string;
  name: string;
  deviceType: string;
  ipAddress: string;
  roomId: string;
  roomName: string | null;
  roomCode: string | null;
  location: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  consecutiveFailures: number;
  lastPingAt: string | null;
  lastSuccessAt: string | null;
  lastStatusChangeAt: string | null;
  offlineStartedAt: string | null;
  isActive: boolean;
}

export interface NetworkMonitoringSummary {
  total: number;
  online: number;
  offline: number;
  unknown: number;
  active: number;
}

export interface NetworkEventFilters {
  page?: number;
  limit?: number;
  deviceId?: string;
  roomId?: string;
  deviceType?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
}

/** One incident row (an OFFLINE period). A resolved row yields two timeline states. */
export interface NetworkMonitoringEvent {
  id: string;
  networkDeviceId: string;
  eventType: 'CONNECTION_LOST';
  startedAt: string;
  resolvedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  roomId: string;
  roomName: string | null;
  roomCode: string | null;
  location: string | null;
  currentStatus: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Recovery endpoint. Called on initial load and after every Socket.IO
 * (re)connect so the frontend rebuilds state from the backend source of truth
 * without relying on any client-side clock.
 */
export function getNetworkMonitoringStatus() {
  return apiGet<{ success: boolean; data: { devices: NetworkDeviceStatus[] } }>('/network-monitoring/status');
}

export function getNetworkMonitoringSummary() {
  return apiGet<{ success: boolean; data: NetworkMonitoringSummary }>('/network-monitoring/summary');
}

/**
 * Connection history / timeline. History always comes from the API; realtime
 * events only append new states on top of it.
 */
export function getNetworkMonitoringEvents(filters?: NetworkEventFilters) {
  return apiGet<{ success: boolean; data: NetworkMonitoringEvent[]; meta: PaginationMeta }>(
    '/network-monitoring/events',
    filters as Record<string, string | number | undefined>,
  );
}

/** Incidents currently unresolved (`resolved_at IS NULL`). */
export function getActiveNetworkIncidents() {
  return apiGet<{ success: boolean; data: NetworkMonitoringEvent[] }>('/network-monitoring/events/active');
}

export const networkMonitoringKeys = {
  all: ['network-monitoring'] as const,
  status: ['network-monitoring', 'status'] as const,
  summary: ['network-monitoring', 'summary'] as const,
  events: (filters: NetworkEventFilters) => ['network-monitoring', 'events', filters] as const,
  active: ['network-monitoring', 'active'] as const,
};