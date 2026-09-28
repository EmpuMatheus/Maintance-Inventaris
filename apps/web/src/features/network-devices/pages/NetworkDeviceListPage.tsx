import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, Power, PowerOff, Server } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import ReportTable, { type ReportColumn } from '@/features/reports/components/ReportTable';
import DeviceTypeBadge from '@/features/network-monitoring/components/DeviceTypeBadge';
import NetworkStatusBadge from '@/features/network-monitoring/components/NetworkStatusBadge';
import { networkMonitoringKeys } from '@/features/network-monitoring/api/monitoring';
import { formatEventDateTime } from '@/features/network-monitoring/utils/format';
import { listMaster } from '@/features/inventory/api/inventory';
import { listNetworkDevices, setNetworkDeviceStatus, networkDeviceKeys } from '../api/network-devices';
import NetworkDeviceFilters from '../components/NetworkDeviceFilters';
import ActiveStatusBadge from '../components/ActiveStatusBadge';
import DeactivateDialog from '../components/DeactivateDialog';
import { canManageNetworkDevices } from '../utils/permissions';
import type { NetworkDevice, NetworkDeviceFilters as Filters } from '../types';

const INITIAL: Filters = { page: 1, limit: 25 };

export default function NetworkDeviceListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [deactivating, setDeactivating] = useState<NetworkDevice | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: networkDeviceKeys.list(filters),
    queryFn: () => listNetworkDevices(filters),
  });

  // Device Type options are the network-device subcategory names, since a
  // device's type is derived from its Asset's subcategory.
  const { data: subcategoriesData } = useQuery({
    queryKey: ['master', 'subcategories'],
    queryFn: () => listMaster('subcategories'),
  });
  const deviceTypes = Array.from(
    new Set(
      ((subcategoriesData?.data ?? []) as { name?: string; isNetworkDevice?: boolean }[])
        .filter((s) => s.isNetworkDevice && s.name)
        .map((s) => s.name as string),
    ),
  ).sort();

  const toggleStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setNetworkDeviceStatus(id, isActive),
    onSuccess: (_res, variables) => {
      toast.success(variables.isActive ? 'Network device activated.' : 'Network device deactivated.');
      qc.invalidateQueries({ queryKey: networkDeviceKeys.all });
      qc.invalidateQueries({ queryKey: networkMonitoringKeys.status });
      qc.invalidateQueries({ queryKey: networkMonitoringKeys.summary });
      setDeactivating(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onChange = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const onPageChange = (page: number) => setFilters((f) => ({ ...f, page }));

  const hasFilters = Boolean(
    filters.search || filters.deviceType || filters.status || filters.roomId || filters.isActive !== undefined,
  );
  const devices = data?.data ?? [];
  const showEmptyState = !isLoading && !isError && devices.length === 0 && !hasFilters;
  const canManage = canManageNetworkDevices(can);

  const columns: ReportColumn<NetworkDevice>[] = [
    {
      key: 'name',
      label: 'Device Name',
      render: (d) => (
        <span>
          <span className="block font-medium text-slate-900">{d.name}</span>
          {d.hostname && <span className="block text-xs text-slate-400">{d.hostname}</span>}
        </span>
      ),
    },
    { key: 'deviceType', label: 'Device Type', render: (d) => <DeviceTypeBadge deviceType={d.deviceType} /> },
    {
      key: 'ipAddress',
      label: 'IP Address',
      render: (d) => <span className="font-mono text-xs text-slate-600">{d.ipAddress}</span>,
    },
    {
      key: 'room',
      label: 'Room',
      render: (d) => <span className="text-xs text-slate-600">{d.room?.name || d.room?.location || '-'}</span>,
    },
    { key: 'status', label: 'Status', render: (d) => <NetworkStatusBadge status={d.status} /> },
    { key: 'isActive', label: 'Active', render: (d) => <ActiveStatusBadge isActive={d.isActive} /> },
    {
      key: 'lastPingAt',
      label: 'Last Ping',
      render: (d) => (
        <span className="text-xs text-slate-400">{d.lastPingAt ? formatEventDateTime(d.lastPingAt) : '-'}</span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (d) => (
        <span className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {canManage && (
            <>
              <button
                onClick={() => navigate(`/network-devices/${d.id}/edit`)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit
              </button>
              {d.isActive ? (
                <button
                  onClick={() => setDeactivating(d)}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-200 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50"
                >
                  <PowerOff className="h-3.5 w-3.5" /> Nonaktifkan
                </button>
              ) : (
                <button
                  onClick={() => toggleStatus.mutate({ id: d.id, isActive: true })}
                  disabled={toggleStatus.isPending}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <Power className="h-3.5 w-3.5" /> Aktifkan
                </button>
              )}
            </>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Network Devices</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage monitored computers and switches. Status is determined by the monitoring runner.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => navigate('/network-devices/new')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Tambah Network Device
          </button>
        )}
      </div>

      <NetworkDeviceFilters
        value={filters}
        deviceTypes={deviceTypes}
        onChange={onChange}
        onReset={() => setFilters(INITIAL)}
      />

      {showEmptyState ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Server className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-600">Belum ada Network Device</p>
          {canManage && (
            <button
              onClick={() => navigate('/network-devices/new')}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Tambah Network Device
            </button>
          )}
        </div>
      ) : (
        <ReportTable
          columns={columns}
          items={devices}
          rowKey={(d) => d.id}
          isLoading={isLoading}
          isError={isError}
          errorMessage={(error as Error)?.message}
          onRetry={() => refetch()}
          page={filters.page ?? 1}
          meta={data?.meta}
          onPageChange={onPageChange}
          onRowClick={(d) => navigate(`/network-devices/${d.id}`)}
          emptyMessage="Tidak ada Network Device yang cocok dengan filter."
        />
      )}

      <DeactivateDialog
        open={!!deactivating}
        deviceName={deactivating?.name ?? ''}
        isSubmitting={toggleStatus.isPending}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && toggleStatus.mutate({ id: deactivating.id, isActive: false })}
      />
    </div>
  );
}
