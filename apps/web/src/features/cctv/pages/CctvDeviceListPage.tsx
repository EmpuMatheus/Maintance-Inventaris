import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Pencil, Plus, Power, PowerOff, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import ReportTable, { type ReportColumn } from '@/features/reports/components/ReportTable';
import CctvStatusBadge from '../components/CctvStatusBadge';
import CctvDeviceTypeBadge from '../components/CctvDeviceTypeBadge';
import CctvProtocolBadge from '../components/CctvProtocolBadge';
import ActiveStatusBadge from '../components/ActiveStatusBadge';
import DeactivateDeviceDialog from '../components/DeactivateDeviceDialog';
import { listCctvDevices, setCctvDeviceStatus, cctvDeviceKeys } from '../api/cctv';
import CctvDeviceFilters from '../components/CctvDeviceFilters';
import { canManageCctvDevices } from '../utils/permissions';
import { formatDateTime } from '../utils/format';
import type { CctvDevice, CctvDeviceFilters as Filters } from '../types';

const INITIAL: Filters = { page: 1, limit: 25 };

export default function CctvDeviceListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(INITIAL);
  const [deactivating, setDeactivating] = useState<CctvDevice | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: cctvDeviceKeys.list(filters),
    queryFn: () => listCctvDevices(filters),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setCctvDeviceStatus(id, isActive),
    onSuccess: (_res, variables) => {
      toast.success(variables.isActive ? 'CCTV device activated.' : 'CCTV device deactivated.');
      qc.invalidateQueries({ queryKey: cctvDeviceKeys.all });
      setDeactivating(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onChange = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const onPageChange = (page: number) => setFilters((f) => ({ ...f, page }));

  const hasFilters = Boolean(filters.search || filters.deviceType || filters.status || filters.isActive !== undefined);
  const devices = data?.data ?? [];
  const showEmptyState = !isLoading && !isError && devices.length === 0 && !hasFilters;
  const canManage = canManageCctvDevices(can);

  const columns: ReportColumn<CctvDevice>[] = [
    {
      key: 'name',
      label: 'Device Name',
      render: (d) => (
        <span>
          <span className="block font-medium text-slate-900">{d.name}</span>
          {d.location && <span className="block text-xs text-slate-400">{d.location}</span>}
        </span>
      ),
    },
    { key: 'deviceType', label: 'Type', render: (d) => <CctvDeviceTypeBadge deviceType={d.deviceType} /> },
    {
      key: 'endpoint',
      label: 'Address',
      render: (d) => (
        <span className="font-mono text-xs text-slate-600">
          {d.ipAddress}:{d.port}
        </span>
      ),
    },
    {
      key: 'brandModel',
      label: 'Vendor / Model',
      render: (d) => (
        <span className="text-xs text-slate-600">{[d.brand, d.model].filter(Boolean).join(' / ') || '-'}</span>
      ),
    },
    {
      key: 'protocol',
      label: 'Protocol',
      render: (d) => <CctvProtocolBadge protocol={d.integrationProtocol} />,
    },
    { key: 'status', label: 'Status', render: (d) => <CctvStatusBadge status={d.status} /> },
    { key: 'isActive', label: 'Active', render: (d) => <ActiveStatusBadge isActive={d.isActive} /> },
    {
      key: 'lastSyncedAt',
      label: 'Last Sync',
      render: (d) => (
        <span className="text-xs text-slate-400">{d.lastSyncedAt ? formatDateTime(d.lastSyncedAt) : '-'}</span>
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
                onClick={() => navigate(`/cctv/devices/${d.id}/edit`)}
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
          <h1 className="text-2xl font-bold text-slate-900">CCTV Devices</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola DVR/NVR/Recorder melalui ONVIF. Uji koneksi dan sinkronkan channel.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => navigate('/cctv/devices/new')}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Tambah Device
          </button>
        )}
      </div>

      <CctvDeviceFilters value={filters} onChange={onChange} onReset={() => setFilters(INITIAL)} />

      {showEmptyState ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Video className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-600">Belum ada CCTV Device</p>
          {canManage && (
            <button
              onClick={() => navigate('/cctv/devices/new')}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" /> Tambah Device
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
          onRowClick={(d) => navigate(`/cctv/devices/${d.id}`)}
          emptyMessage="Tidak ada CCTV Device yang cocok dengan filter."
        />
      )}

      <DeactivateDeviceDialog
        open={!!deactivating}
        deviceName={deactivating?.name ?? ''}
        isSubmitting={toggleStatus.isPending}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && toggleStatus.mutate({ id: deactivating.id, isActive: false })}
      />
    </div>
  );
}
