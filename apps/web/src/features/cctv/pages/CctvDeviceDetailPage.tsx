import { useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Pencil, Plug, Power, PowerOff, RefreshCw, ExternalLink, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import CctvStatusBadge from '../components/CctvStatusBadge';
import CctvDeviceTypeBadge from '../components/CctvDeviceTypeBadge';
import CctvProtocolBadge from '../components/CctvProtocolBadge';
import ActiveStatusBadge from '../components/ActiveStatusBadge';
import DeactivateDeviceDialog from '../components/DeactivateDeviceDialog';
import TestConnectionPanel from '../components/TestConnectionPanel';
import TestRtspPanel from '../components/TestRtspPanel';
import {
  getCctvDevice,
  setCctvDeviceStatus,
  syncCctvChannels,
  testCctvConnection,
  testCctvRtsp,
  cctvDeviceKeys,
  cctvChannelKeys,
} from '../api/cctv';
import { canManageCctvDevices, canReadCctvStreams } from '../utils/permissions';
import { formatDateTime } from '../utils/format';
import type { TestConnectionResult, TestRtspResult, SyncResult } from '../types';

function InfoRow({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-900">{value ?? '-'}</span>
    </div>
  );
}

export default function CctvDeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const qc = useQueryClient();
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [testRtspResult, setTestRtspResult] = useState<TestRtspResult | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: cctvDeviceKeys.detail(id ?? ''),
    queryFn: () => getCctvDevice(id!),
    enabled: !!id,
  });

  const toggleStatus = useMutation({
    mutationFn: (isActive: boolean) => setCctvDeviceStatus(id!, isActive),
    onSuccess: (_res, isActive) => {
      toast.success(isActive ? 'CCTV device activated.' : 'CCTV device deactivated.');
      qc.invalidateQueries({ queryKey: cctvDeviceKeys.all });
      setShowDeactivate(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testConnection = useMutation({
    mutationFn: () => testCctvConnection(id!),
    onSuccess: (res) => {
      setTestResult(res.data);
      if (res.data.success) toast.success('Connection successful.');
      else toast.error(res.data.errorMessage || 'Connection failed.');
      qc.invalidateQueries({ queryKey: cctvDeviceKeys.all });
      qc.invalidateQueries({ queryKey: cctvDeviceKeys.detail(id!) });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testRtsp = useMutation({
    mutationFn: () => testCctvRtsp(id!),
    onSuccess: (res) => {
      setTestRtspResult(res.data);
      if (res.data.success) toast.success(res.data.message);
      else toast.error(res.data.errorMessage || 'RTSP connection failed.');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sync = useMutation({
    mutationFn: () => syncCctvChannels(id!),
    onSuccess: (res) => {
      setSyncResult(res.data);
      toast.success(
        `Sync selesai: ${res.data.channels.total} channel (${res.data.channels.created} baru, ${res.data.channels.updated} diperbarui).`,
      );
      qc.invalidateQueries({ queryKey: cctvDeviceKeys.all });
      qc.invalidateQueries({ queryKey: cctvDeviceKeys.detail(id!) });
      qc.invalidateQueries({ queryKey: cctvChannelKeys.all });
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
        <p className="mb-2 text-sm text-red-500">{(error as Error)?.message || 'Unable to load CCTV device.'}</p>
        <button
          onClick={() => refetch()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Try Again
        </button>
      </div>
    );
  }
  if (!data?.data) return <div className="p-6 text-center text-slate-400">CCTV device not found.</div>;

  const d = data.data;
  const canManage = canManageCctvDevices(can);
  const canViewStreams = canReadCctvStreams(can);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <button
        onClick={() => navigate('/cctv/devices')}
        className="mb-4 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> CCTV Devices
      </button>

      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{d.name}</h1>
            <p className="mt-1 font-mono text-sm text-slate-400">
              {d.ipAddress}:{d.port}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CctvDeviceTypeBadge deviceType={d.deviceType} />
              <CctvProtocolBadge protocol={d.integrationProtocol} />
              <CctvStatusBadge status={d.status} />
              <ActiveStatusBadge isActive={d.isActive} />
            </div>
          </div>
          {canManage && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setTestResult(null);
                  testConnection.mutate();
                }}
                disabled={testConnection.isPending || !d.isActive}
                className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
              >
                {testConnection.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4" />
                )}
                Test Connection
              </button>
              <button
                onClick={() => {
                  setTestRtspResult(null);
                  testRtsp.mutate();
                }}
                disabled={testRtsp.isPending || !d.isActive}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-200 px-3 py-2 text-sm text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
              >
                {testRtsp.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Video className="h-4 w-4" />
                )}
                Test RTSP Connection
              </button>
              <button
                onClick={() => {
                  setSyncResult(null);
                  sync.mutate();
                }}
                disabled={sync.isPending || !d.isActive}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {sync.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync Channel
              </button>
              <button
                onClick={() => navigate(`/cctv/devices/${d.id}/edit`)}
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

      {testResult && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Test Connection</h2>
          <TestConnectionPanel result={testResult} />
        </div>
      )}

      {testRtspResult && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Test RTSP Connection</h2>
          <TestRtspPanel result={testRtspResult} />
        </div>
      )}

      {syncResult && (
        <div className="mb-6 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Sync Result</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Channels" value={syncResult.channels.total} />
            <Stat label="Created" value={syncResult.channels.created} />
            <Stat label="Updated" value={syncResult.channels.updated} />
            <Stat label="Missing" value={syncResult.channels.missing} />
          </div>
          <p className="mt-3 text-xs text-slate-400">
            {syncResult.profiles} media profile tersinkron · {formatDateTime(syncResult.syncedAt)}
          </p>
          {canViewStreams && (
            <button
              onClick={() => navigate(`/cctv/streams?deviceId=${d.id}`)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Lihat Channel / Stream
            </button>
          )}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Device</h2>
          <InfoRow label="Name" value={d.name} />
          <InfoRow label="Vendor" value={d.brand} />
          <InfoRow label="Type" value={<CctvDeviceTypeBadge deviceType={d.deviceType} />} />
          <InfoRow
            label="Integration Protocol"
            value={<CctvProtocolBadge protocol={d.integrationProtocol} />}
          />
          <InfoRow label="Brand" value={d.brand} />
          <InfoRow label="Model" value={d.model} />
          <InfoRow label="Location" value={d.location} />
          <InfoRow label="Username" value={d.username} />
          <InfoRow label="Password" value="Tersimpan terenkripsi" />
          {d.description && <InfoRow label="Description" value={d.description} />}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">Connection</h2>
          <InfoRow
            label="Address"
            value={
              <span className="font-mono text-xs">
                {d.ipAddress}:{d.port}
              </span>
            }
          />
          <InfoRow
            label="RTSP Address"
            value={
              <span className="font-mono text-xs">
                {d.ipAddress}:{d.rtspPort}
              </span>
            }
          />
          <InfoRow label="Status" value={<CctvStatusBadge status={d.status} />} />
          <InfoRow label="Active / Inactive" value={<ActiveStatusBadge isActive={d.isActive} />} />
          <InfoRow label="Last Checked" value={d.lastCheckedAt ? formatDateTime(d.lastCheckedAt) : null} />
          <InfoRow label="Last Success" value={d.lastSuccessAt ? formatDateTime(d.lastSuccessAt) : null} />
          <InfoRow label="Last Sync" value={d.lastSyncedAt ? formatDateTime(d.lastSyncedAt) : null} />
          {d.lastError && <InfoRow label="Last Error" value={<span className="text-red-600">{d.lastError}</span>} />}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            Device Information{' '}
            <span className="font-normal normal-case text-slate-400">
              ({d.integrationProtocol})
            </span>
          </h2>
          <div className="grid gap-x-8 md:grid-cols-2">
            <div>
              <InfoRow label="Manufacturer" value={d.manufacturer} />
              <InfoRow label="Model" value={d.model} />
              <InfoRow label="Firmware Version" value={d.firmwareVersion} />
            </div>
            <div>
              <InfoRow label="Serial Number" value={d.serialNumber} />
              <InfoRow label="Hardware ID" value={d.hardwareId} />
              {d.integrationProtocol === 'ONVIF' && (
                <InfoRow
                  label="ONVIF Services"
                  value={d.onvifServices ? `${d.onvifServices.length} service(s)` : null}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <DeactivateDeviceDialog
        open={showDeactivate}
        deviceName={d.name}
        isSubmitting={toggleStatus.isPending}
        onClose={() => setShowDeactivate(false)}
        onConfirm={() => toggleStatus.mutate(false)}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
      <p className="text-lg font-semibold text-slate-800">{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
