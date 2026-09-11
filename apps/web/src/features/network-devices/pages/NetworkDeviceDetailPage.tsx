import { useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Pencil, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import DeviceTypeBadge from '@/features/network-monitoring/components/DeviceTypeBadge';
import NetworkStatusBadge from '@/features/network-monitoring/components/NetworkStatusBadge';
import { networkMonitoringKeys } from '@/features/network-monitoring/api/monitoring';
import { formatEventDateTime } from '@/features/network-monitoring/utils/format';
import { getNetworkDevice, setNetworkDeviceStatus, networkDeviceKeys } from '../api/network-devices';
import ActiveStatusBadge from '../components/ActiveStatusBadge';
import DeactivateDialog from '../components/DeactivateDialog';
import { canManageNetworkDevices } from '../utils/permissions';

function InfoRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value ?? '-'}</span>
    </div>
  );
}

export default function NetworkDeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [showDeactivate, setShowDeactivate] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: networkDeviceKeys.detail(id ?? ''),
    queryFn: () => getNetworkDevice(id!),
    enabled: !!id,
  });

  const toggleStatus = useMutation({
    mutationFn: (isActive: boolean) => setNetworkDeviceStatus(id!, isActive),
    onSuccess: (_res, isActive) => {
      toast.success(isActive ? 'Network device activated.' : 'Network device deactivated.');
      qc.invalidateQueries({ queryKey: networkDeviceKeys.all });
      qc.invalidateQueries({ queryKey: networkMonitoringKeys.status });
      qc.invalidateQueries({ queryKey: networkMonitoringKeys.summary });
      setShowDeactivate(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="p-6 text-center">
        <p className="mb-2 text-sm text-red-500">{(error as Error)?.message || 'Unable to load network device.'}</p>
        <button
          onClick={() => refetch()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Try Again
        </button>
      </div>
    );
  }
  if (!data?.data) return <div className="p-6 text-center text-slate-400">Network device not found.</div>;

  const d = data.data;
  const canManage = canManageNetworkDevices(can);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <button
        onClick={() => navigate('/network-devices')}
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Network Devices
      </button>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{d.name}</h1>
            <p className="mt-1 font-mono text-sm text-slate-400">{d.ipAddress}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DeviceTypeBadge deviceType={d.deviceType} />
              <NetworkStatusBadge status={d.status} />
              <ActiveStatusBadge isActive={d.isActive} />
            </div>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => navigate(`/network-devices/${d.id}/edit`)}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <Pencil className="h-4 w-4" /> Edit
              </button>
              {d.isActive ? (
                <button
                  onClick={() => setShowDeactivate(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-200 px-3 py-2 text-sm text-amber-700 hover:bg-amber-50"
                >
                  <PowerOff className="h-4 w-4" /> Nonaktifkan
                </button>
              ) : (
                <button
                  onClick={() => toggleStatus.mutate(true)}
                  disabled={toggleStatus.isPending}
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <Power className="h-4 w-4" /> Aktifkan
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Device</h2>
          <InfoRow label="Name" value={d.name} />
          <InfoRow label="Type" value={<DeviceTypeBadge deviceType={d.deviceType} />} />
          <InfoRow label="IP Address" value={<span className="font-mono text-xs">{d.ipAddress}</span>} />
          <InfoRow label="Hostname" value={d.hostname} />
          <InfoRow label="MAC Address" value={<span className="font-mono text-xs">{d.macAddress}</span>} />
          <InfoRow
            label="Asset"
            value={d.asset ? `${d.asset.assetCode} - ${d.asset.assetName}` : null}
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Location</h2>
          <InfoRow label="Room" value={d.room?.name} />
          <InfoRow label="Floor" value={d.room?.floorName} />
          <InfoRow label="Building" value={d.room?.buildingName} />
          <InfoRow label="Site" value={d.room?.siteName} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Monitoring <span className="font-normal normal-case text-slate-400">(read-only)</span>
          </h2>
          <div className="grid gap-x-8 md:grid-cols-2">
            <div>
              <InfoRow label="Status" value={<NetworkStatusBadge status={d.status} />} />
              <InfoRow label="Active / Inactive" value={<ActiveStatusBadge isActive={d.isActive} />} />
              <InfoRow label="Consecutive Failures" value={d.consecutiveFailures} />
              <InfoRow label="Last Ping" value={d.lastPingAt ? formatEventDateTime(d.lastPingAt) : null} />
            </div>
            <div>
              <InfoRow label="Last Success" value={d.lastSuccessAt ? formatEventDateTime(d.lastSuccessAt) : null} />
              <InfoRow
                label="Last Status Change"
                value={d.lastStatusChangeAt ? formatEventDateTime(d.lastStatusChangeAt) : null}
              />
              <InfoRow
                label="Offline Started"
                value={d.offlineStartedAt ? formatEventDateTime(d.offlineStartedAt) : null}
              />
            </div>
          </div>
        </div>
      </div>

      <DeactivateDialog
        open={showDeactivate}
        deviceName={d.name}
        isSubmitting={toggleStatus.isPending}
        onClose={() => setShowDeactivate(false)}
        onConfirm={() => toggleStatus.mutate(false)}
      />
    </div>
  );
}
