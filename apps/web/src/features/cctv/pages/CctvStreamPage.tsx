import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RotateCcw, Search, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { listCctvChannels, updateCctvChannel, cctvChannelKeys } from '../api/cctv';
import { listCctvDevices } from '../api/cctv';
import { canManageCctvStreams } from '../utils/permissions';
import ChannelCard from '../components/ChannelCard';
import ChannelEditDialog from '../components/ChannelEditDialog';
import type { CctvChannel, CctvChannelFilters, CctvChannelInput } from '../types';

const STATUS_OPTIONS = ['ONLINE', 'OFFLINE', 'UNKNOWN', 'MISSING'];

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

export default function CctvStreamPage() {
  const { can } = useAuth();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<CctvChannel | null>(null);

  const deviceId = searchParams.get('deviceId') ?? undefined;
  const [status, setStatus] = useState<string>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filters: CctvChannelFilters = { page, limit: 60, deviceId, status: status || undefined, search: search || undefined };

  const { data: devicesData } = useQuery({
    queryKey: ['cctv-devices', 'list', { page: 1, limit: 100 }],
    queryFn: () => listCctvDevices({ page: 1, limit: 100 }),
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: cctvChannelKeys.list(filters),
    queryFn: () => listCctvChannels(filters),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CctvChannelInput }) => updateCctvChannel(id, payload),
    onSuccess: () => {
      toast.success('Channel updated.');
      qc.invalidateQueries({ queryKey: cctvChannelKeys.all });
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const channels = data?.data;
  const meta = data?.meta;
  const canManage = canManageCctvStreams(can);
  const devices = devicesData?.data ?? [];

  // Group channels by device for the sectioned layout.
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; channels: CctvChannel[] }>();
    for (const ch of channels ?? []) {
      const key = ch.deviceId;
      if (!map.has(key)) map.set(key, { name: ch.device?.name ?? 'Unknown Device', channels: [] });
      map.get(key)!.channels.push(ch);
    }
    return Array.from(map.values());
  }, [channels]);

  const onReset = () => {
    setStatus('');
    setSearch('');
    setPage(1);
    setSearchParams({});
  };

  const hasFilters = Boolean(deviceId || status || search);

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">CCTV Streams</h1>
        <p className="mt-1 text-sm text-slate-500">
          Camera/channel yang tersinkron dari Device. Atur Name dan Location di sini.
        </p>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, CH, technical name, location..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className={`${inputClass} pl-10`}
          />
        </div>
        <select
          value={deviceId ?? ''}
          onChange={(e) => {
            const v = e.target.value || undefined;
            setSearchParams(v ? { deviceId: v } : {});
            setPage(1);
          }}
          className={inputClass}
          aria-label="Filter by device"
        >
          <option value="">All Devices</option>
          {devices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className={inputClass}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={onReset}
            className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 lg:col-span-4"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Filters
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <p className="mb-2 text-sm text-red-500">{(error as Error)?.message || 'Unable to load streams.'}</p>
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Try Again
          </button>
        </div>
      ) : (channels?.length ?? 0) === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            <Video className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-slate-600">Belum ada channel tersinkron</p>
          <p className="mt-1 text-xs text-slate-400">
            Buka CCTV → Device, lalu jalankan Sync Channel pada device yang terhubung.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.name}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">{group.name}</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.channels.map((ch) => (
                  <ChannelCard key={ch.id} channel={ch} canManage={canManage} onEdit={setEditing} />
                ))}
              </div>
            </section>
          ))}

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>
                Page {meta.page} of {meta.totalPages} ({meta.total} total)
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={!meta.hasPreviousPage}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-30 hover:bg-slate-50"
                >
                  Previous
                </button>
                <button
                  disabled={!meta.hasNextPage}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-30 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <ChannelEditDialog
        channel={editing}
        isSubmitting={updateMutation.isPending}
        onClose={() => setEditing(null)}
        onSubmit={(payload) => editing && updateMutation.mutate({ id: editing.id, payload })}
      />
    </div>
  );
}
