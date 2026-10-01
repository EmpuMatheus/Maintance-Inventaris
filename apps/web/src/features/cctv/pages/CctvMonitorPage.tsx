import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Loader2, Play, Square, TriangleAlert, Video } from 'lucide-react';
import { listMonitorChannels, getCctvLiveLimits } from '../api/cctv';
import CctvStreamTile from '../components/CctvStreamTile';
import type { CctvLiveStreamKind, CctvMonitorChannel } from '../types';
import { monitorGridClass, flattenMonitorChannels } from '../utils/monitor';
import { buildLiveViewUrl } from '../utils/playback';
import { configureSessionLimiter } from '../utils/session-limiter';

const selectClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

/**
 * CCTV Monitor: ONE flat video-wall grid of ALL channels across every device.
 *
 * - No device selection and no per-device sections: every channel is a single
 *   item in one collection.
 * - Nothing plays on open. The user starts the wall with "Play All" (and stops
 *   it with "Stop All"); the shared limiter caps concurrency and over-limit
 *   tiles show "Waiting".
 * - Clicking a tile opens Live View (which also does not autoplay).
 */
export default function CctvMonitorPage() {
  const navigate = useNavigate();
  const [streamKind, setStreamKind] = useState<CctvLiveStreamKind>('SUB');
  // Global wall switch. Starts false so the page never autoplays on open.
  const [playingAll, setPlayingAll] = useState(false);

  const limitsQuery = useQuery({
    queryKey: ['cctv-live-limits'],
    queryFn: async () => (await getCctvLiveLimits()).data,
    staleTime: 5 * 60 * 1000,
  });

  // Keep the client-side concurrency limiter aligned with the backend cap so a
  // burst of tiles never exceeds CCTV_LIVE_SESSION_MAX sessions at once.
  useEffect(() => {
    if (limitsQuery.data?.maxSessions) configureSessionLimiter(limitsQuery.data.maxSessions);
  }, [limitsQuery.data?.maxSessions]);

  const channelsQuery = useQuery({
    queryKey: ['cctv-channels', 'monitor'],
    queryFn: () => listMonitorChannels(),
    refetchInterval: 60 * 1000,
  });

  // One flat collection: ordered by device then channel number, but with NO
  // visual grouping by device.
  const channels = useMemo<CctvMonitorChannel[]>(
    () => flattenMonitorChannels(channelsQuery.data?.data ?? []),
    [channelsQuery.data],
  );

  const onOpen = (dev: string, channelId: string, kind: CctvLiveStreamKind) => {
    // Navigating away unmounts the wall, which stops every tile session.
    navigate(buildLiveViewUrl(dev, channelId, kind));
  };

  const streamingDisabled = limitsQuery.data?.streamingEnabled === false;
  const hasChannels = channels.length > 0;
  const canPlay = hasChannels && !streamingDisabled;

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <LayoutGrid className="h-6 w-6 text-indigo-600" /> CCTV Monitor
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Semua channel CCTV dari seluruh device dalam satu grid. Tekan Play All untuk menonton semua.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:w-56">
            <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="monitor-stream">
              Stream
            </label>
            <select
              id="monitor-stream"
              className={selectClass}
              value={streamKind}
              onChange={(e) => setStreamKind(e.target.value as CctvLiveStreamKind)}
            >
              <option value="SUB">Sub Stream (ringan)</option>
              <option value="MAIN">Main Stream</option>
            </select>
          </div>

          {playingAll ? (
            <button
              type="button"
              onClick={() => setPlayingAll(false)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              disabled={!hasChannels}
            >
              <Square className="h-4 w-4" /> Stop All
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPlayingAll(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={!canPlay}
            >
              <Play className="h-4 w-4" /> Play All
            </button>
          )}
        </div>
      </div>

      {streamingDisabled && (
        <p className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <TriangleAlert className="h-3.5 w-3.5" /> Live View streaming sedang dinonaktifkan di server.
        </p>
      )}

      {channelsQuery.isLoading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : channelsQuery.isError ? (
        <EmptyState error text="Gagal memuat channel. Coba muat ulang halaman." />
      ) : channels.length === 0 ? (
        <EmptyState text="Belum ada channel tersinkron. Buka Device lalu jalankan Sync Channel." />
      ) : (
        <div className={monitorGridClass(channels.length)}>
          {channels.map((ch) => (
            <CctvStreamTile
              key={`${ch.id}:${streamKind}`}
              deviceId={ch.deviceId}
              deviceName={ch.device?.name ?? ''}
              channel={ch}
              streamKind={streamKind}
              autoStart={playingAll}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text, error }: { text: string; error?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Video className="h-6 w-6" />
      </div>
      <p className={`text-sm font-medium ${error ? 'text-red-500' : 'text-slate-600'}`}>{text}</p>
    </div>
  );
}
