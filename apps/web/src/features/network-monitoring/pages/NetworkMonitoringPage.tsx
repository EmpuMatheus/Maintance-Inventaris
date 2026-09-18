import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Monitor, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { listMaster } from '@/features/inventory/api/inventory';
import {
  getNetworkMonitoringSummary,
  networkMonitoringKeys,
} from '../api/monitoring';
import {
  type NetworkDeviceOfflinePayload,
  type NetworkDeviceRestoredPayload,
} from '@/lib/socket';
import {
  useNetworkMonitoring,
  useNetworkMonitoringStatus,
  useNetworkMonitoringTimeline,
} from '../hooks/useNetworkMonitoring';
import NetworkSummaryCards from '../components/NetworkSummaryCards';
import NetworkFilters, { type RoomOption } from '../components/NetworkFilters';
import NetworkDeviceTable from '../components/NetworkDeviceTable';
import NetworkTimeline from '../components/NetworkTimeline';
import type { NetworkMonitoringFilters } from '../types';

const INITIAL_FILTERS: NetworkMonitoringFilters = {
  search: '',
  status: '',
  deviceType: '',
  roomId: '',
  from: '',
  to: '',
};

export default function NetworkMonitoringPage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<NetworkMonitoringFilters>(INITIAL_FILTERS);
  const [panel, setPanel] = useState<'timeline' | 'devices'>('timeline');

  // Realtime updates for the timeline. `onReconnect` re-pulls all state from the
  // API so a dropped connection never leaves the UI stale or duplicated.
  const timeline = useNetworkMonitoringTimeline(filters);
  const statusQuery = useNetworkMonitoringStatus();

  const { data: summary } = useQuery({
    queryKey: networkMonitoringKeys.summary,
    queryFn: async () => (await getNetworkMonitoringSummary()).data,
  });

  const { data: roomsData } = useQuery({
    queryKey: ['master', 'rooms'],
    queryFn: () => listMaster('rooms'),
  });

  const rooms: RoomOption[] = useMemo(
    () => (roomsData?.data ?? []).map((r: { id: string; name?: string; code?: string }) => ({
      id: r.id,
      name: r.name || r.code || r.id,
    })),
    [roomsData],
  );

  // Keep the latest socket push handlers in refs so the effect does not resubscribe.
  const pushOfflineRef = useRef(timeline.pushOffline);
  const pushRestoredRef = useRef(timeline.pushRestored);
  pushOfflineRef.current = timeline.pushOffline;
  pushRestoredRef.current = timeline.pushRestored;

  const recoverFromApi = useCallback(() => {
    timeline.refetch();
    statusQuery.refetch();
  }, [timeline, statusQuery]);

  const { connected } = useNetworkMonitoring({
    enabled: can('network_device.read') || can('network_device.manage'),
    onOffline: (payload: NetworkDeviceOfflinePayload) => pushOfflineRef.current(payload),
    onRestored: (payload: NetworkDeviceRestoredPayload) => pushRestoredRef.current(payload),
    onReconnect: recoverFromApi,
  });

  const onChange = (patch: Partial<NetworkMonitoringFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const onReset = () => setFilters(INITIAL_FILTERS);

  const devices = useMemo(() => statusQuery.data ?? [], [statusQuery.data]);

  // The current-status endpoint is unfiltered; apply the same filters client-side
  // so the device panel stays consistent with the timeline.
  const filteredDevices = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return devices.filter((d) => {
      if (search && !`${d.name} ${d.ipAddress}`.toLowerCase().includes(search)) return false;
      if (filters.status && d.status !== filters.status) return false;
      if (filters.deviceType && d.deviceType !== filters.deviceType) return false;
      if (filters.roomId && d.roomId !== filters.roomId) return false;
      return true;
    });
  }, [devices, filters]);

  const offlineCount = useMemo(() => devices.filter((d) => d.status === 'OFFLINE').length, [devices]);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Network Monitoring</h1>
          <p className="mt-1 text-sm text-slate-500">
            Realtime connectivity timeline for monitored computers and switches.
          </p>
        </div>
        {offlineCount > 0 && (
          <div className="inline-flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-600/20">
            <AlertTriangle className="h-4 w-4" />
            {offlineCount} device{offlineCount === 1 ? '' : 's'} offline
          </div>
        )}
      </div>

      <div className="mb-4">
        <NetworkSummaryCards summary={summary} />
      </div>

      <div className="mb-4">
        <NetworkFilters value={filters} rooms={rooms} onChange={onChange} onReset={onReset} />
      </div>

      <div className="mb-3 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
        <button
          onClick={() => setPanel('timeline')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
            panel === 'timeline' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sun className="h-4 w-4" /> Timeline
        </button>
        <button
          onClick={() => setPanel('devices')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
            panel === 'devices' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Monitor className="h-4 w-4" /> Current Status
        </button>
      </div>

      {panel === 'timeline' ? (
        <NetworkTimeline
          entries={timeline.entries}
          isLoading={timeline.isLoading}
          isError={timeline.isError}
          errorMessage={timeline.error?.message}
          onRetry={() => timeline.refetch()}
          connected={connected}
          onRefresh={recoverFromApi}
        />
      ) : (
        <NetworkDeviceTable devices={filteredDevices} isLoading={statusQuery.isLoading} />
      )}

      {!connected && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-600">
          <Moon className="h-3.5 w-3.5" /> Realtime connection unavailable - showing API state. Reconnecting...
        </p>
      )}
    </div>
  );
}
