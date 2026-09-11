import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  connectSocket,
  NETWORK_SOCKET_EVENTS,
  type NetworkDeviceOfflinePayload,
  type NetworkDeviceRestoredPayload,
} from '@/lib/socket';
import {
  getNetworkMonitoringEvents,
  getNetworkMonitoringStatus,
  networkMonitoringKeys,
  type NetworkEventFilters,
} from '../api/monitoring';
import {
  incidentToTimelineEntries,
  type NetworkMonitoringFilters,
  type TimelineEntry,
} from '../types';
import { appendTimelineEntries, mergeTimelineEntries, pruneLiveEntries } from '../utils/timeline';

function filtersToApi(filters: NetworkMonitoringFilters): NetworkEventFilters | undefined {
  const api: NetworkEventFilters = {};
  if (filters.search) api.search = filters.search;
  if (filters.status) api.status = filters.status;
  if (filters.deviceType) api.deviceType = filters.deviceType;
  if (filters.roomId) api.roomId = filters.roomId;
  if (filters.from) api.from = filters.from;
  if (filters.to) api.to = filters.to;
  return Object.keys(api).length > 0 ? api : undefined;
}

export interface UseNetworkMonitoringOptions {
  onOffline?: (payload: NetworkDeviceOfflinePayload) => void;
  onRestored?: (payload: NetworkDeviceRestoredPayload) => void;
  /** Called after every successful (re)connect so callers can recover via API. */
  onReconnect?: () => void;
  enabled?: boolean;
}

/**
 * React integration for the Network Monitoring realtime channel.
 *
 * Connects the shared Socket.IO transport and subscribes to the offline and
 * restored events. On every (re)connect it fires `onReconnect`, which the
 * timeline uses to re-pull current state from the API - the backend is the
 * monitoring source of truth, so missed events are never relied upon.
 */
export function useNetworkMonitoring({
  onOffline,
  onRestored,
  onReconnect,
  enabled = true,
}: UseNetworkMonitoringOptions = {}) {
  const [connected, setConnected] = useState(false);

  const offlineRef = useRef(onOffline);
  const restoredRef = useRef(onRestored);
  const reconnectRef = useRef(onReconnect);
  offlineRef.current = onOffline;
  restoredRef.current = onRestored;
  reconnectRef.current = onReconnect;

  useEffect(() => {
    if (!enabled) return;
    const socket = connectSocket();

    const handleConnect = () => {
      setConnected(true);
      // Fires on the initial connection and on every reconnection, so state is
      // always re-synchronised from the API after a dropped connection.
      reconnectRef.current?.();
    };
    const handleDisconnect = () => setConnected(false);
    const handleOffline = (payload: NetworkDeviceOfflinePayload) => offlineRef.current?.(payload);
    const handleRestored = (payload: NetworkDeviceRestoredPayload) => restoredRef.current?.(payload);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on(NETWORK_SOCKET_EVENTS.offline, handleOffline);
    socket.on(NETWORK_SOCKET_EVENTS.restored, handleRestored);

    if (socket.connected) {
      setConnected(true);
      reconnectRef.current?.();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off(NETWORK_SOCKET_EVENTS.offline, handleOffline);
      socket.off(NETWORK_SOCKET_EVENTS.restored, handleRestored);
      // NOTE: the shared socket singleton is intentionally NOT disconnected here.
      // React StrictMode mounts effects twice in development (mount -> cleanup ->
      // mount); disconnecting a still-connecting socket tears down a valid
      // handshake and produces "WebSocket is closed before the connection is
      // established". Leaving the singleton connected keeps reconnects stable;
      // logout calls disconnectSocket() explicitly when teardown is required.
    };
  }, [enabled]);

  return { connected };
}

export function useNetworkMonitoringStatus() {
  return useQuery({
    queryKey: networkMonitoringKeys.status,
    queryFn: async () => (await getNetworkMonitoringStatus()).data.devices,
  });
}

/**
 * Network Monitoring timeline.
 *
 * History comes from the API; realtime events append new states on top. Entries
 * are keyed by `${deviceId}:${startedAt}:${state}` so a reconnect-triggered
 * refetch can never duplicate a timeline event. Timestamps stay canonical UTC
 * from the API/socket and are only formatted at render time.
 */
export function useNetworkMonitoringTimeline(filters: NetworkMonitoringFilters) {
  const apiFilters = useMemo(() => filtersToApi(filters), [filters]);
  const [live, setLive] = useState<TimelineEntry[]>([]);

  const eventsQuery = useQuery({
    queryKey: networkMonitoringKeys.events(apiFilters ?? {}),
    queryFn: async () => (await getNetworkMonitoringEvents(apiFilters)).data,
  });

  const historyEntries = useMemo(
    () => (eventsQuery.data ?? []).flatMap(incidentToTimelineEntries),
    [eventsQuery.data],
  );

  // Drop live entries that a fresh API response already contains, so the set
  // does not grow unbounded across reconnects while never losing dedupe.
  useEffect(() => {
    if (!eventsQuery.data) return;
    const apiEntries = eventsQuery.data.flatMap(incidentToTimelineEntries);
    setLive((prev) => pruneLiveEntries(prev, apiEntries));
  }, [eventsQuery.data]);

  const addEntries = useCallback((entries: TimelineEntry[]) => {
    setLive((prev) => appendTimelineEntries(prev, entries));
  }, []);

  const pushOffline = useCallback(
    (payload: NetworkDeviceOfflinePayload) => {
      addEntries([
        {
          id: `${payload.deviceId}:${payload.startedAt}:CONNECTION_LOST`,
          deviceId: payload.deviceId,
          deviceName: payload.deviceName,
          deviceType: payload.deviceType,
          ipAddress: payload.ipAddress,
          roomId: payload.roomId,
          roomName: null,
          roomCode: null,
          location: null,
          state: 'CONNECTION_LOST',
          timestamp: payload.startedAt,
          startedAt: payload.startedAt,
          resolvedAt: null,
          durationSeconds: null,
          live: true,
        },
      ]);
    },
    [addEntries],
  );

  const pushRestored = useCallback(
    (payload: NetworkDeviceRestoredPayload) => {
      addEntries([
        {
          id: `${payload.deviceId}:${payload.startedAt}:RESTORED`,
          deviceId: payload.deviceId,
          deviceName: payload.deviceName,
          deviceType: payload.deviceType,
          ipAddress: payload.ipAddress,
          roomId: payload.roomId,
          roomName: null,
          roomCode: null,
          location: null,
          state: 'RESTORED',
          timestamp: payload.resolvedAt,
          startedAt: payload.startedAt,
          resolvedAt: payload.resolvedAt,
          durationSeconds: payload.durationSeconds,
          live: true,
        },
      ]);
    },
    [addEntries],
  );

  const entries = useMemo(
    () => mergeTimelineEntries(historyEntries, live),
    [historyEntries, live],
  );

  return {
    entries,
    isLoading: eventsQuery.isLoading,
    isError: eventsQuery.isError,
    error: eventsQuery.error as Error | null,
    refetch: eventsQuery.refetch,
    pushOffline,
    pushRestored,
  };
}

export type { NetworkDeviceStatus } from '../api/monitoring';
