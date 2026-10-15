import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Loader2, Square, Play, TriangleAlert, Video, Maximize } from 'lucide-react';
import { listMonitorChannels, getCctvLiveLimits } from '../api/cctv';
import CctvStreamTile from '../components/CctvStreamTile';
import SingleCameraFullscreen from '../components/SingleCameraFullscreen';
import VideoWallFullscreen from '../components/VideoWallFullscreen';
import type { CctvLiveStreamKind, CctvMonitorChannel } from '../types';
import { monitorGridClass, flattenMonitorChannels } from '../utils/monitor';
import { configureSessionLimiter } from '../utils/session-limiter';
import { gridConcurrency, staggerDelayMs } from '../utils/stream-startup';

/**
 * CCTV Monitor: ONE flat video-wall grid of ALL channels across every device.
 *
 * Performance model (this is what removes the stutter):
 *  - The grid uses the SUB stream (light) and the single-camera view upgrades to
 *    the MAIN stream.
 *  - Tiles NEVER autoplay; "Play All" starts them through a shared start gate,
 *    so at most a handful negotiate at once and the rest are staggered. Over-
 *    limit tiles show "Waiting" and start as capacity frees.
 *  - Leaving the page / closing a view unmounts tiles, which stops their
 *    sessions and releases the server-side FFmpeg ingest.
 *  - Clicking a tile opens single-camera fullscreen (other streams stop to free
 *    capacity, then resume on exit if Play All was on).
 */
export default function CctvMonitorPage() {
  const [streamKind, setStreamKind] = useState<CctvLiveStreamKind>('SUB');
  // Global grid switch. Starts false so the page never autoplays on open.
  const [playingAll, setPlayingAll] = useState(false);
  const [singleId, setSingleId] = useState<string | null>(null);
  const [showWall, setShowWall] = useState(false);

  const limitsQuery = useQuery({
    queryKey: ['cctv-live-limits'],
    queryFn: async () => (await getCctvLiveLimits()).data,
    staleTime: 5 * 60 * 1000,
  });

  // Bound how many grid tiles negotiate at once: less than the backend session
  // cap, so the wall never races to the cap and thrashes.
  useEffect(() => {
    configureSessionLimiter(gridConcurrency(limitsQuery.data?.maxSessions));
  }, [limitsQuery.data?.maxSessions]);

  const channelsQuery = useQuery({
    queryKey: ['cctv-channels', 'monitor'],
    queryFn: () => listMonitorChannels(),
    refetchInterval: 60 * 1000,
  });

  const channels = useMemo<CctvMonitorChannel[]>(
    () => flattenMonitorChannels(channelsQuery.data?.data ?? []),
    [channelsQuery.data],
  );

  const focusedChannel = useMemo(
    () => (singleId ? channels.find((c) => c.id === singleId) ?? null : null),
    [singleId, channels],
  );

  const streamingDisabled = limitsQuery.data?.streamingEnabled === false;
  const hasChannels = channels.length > 0;
  const canPlay = hasChannels && !streamingDisabled;
  const inOverlay = singleId !== null || showWall;

  const openSingle = (channelId: string) => setSingleId(channelId);
  const closeSingle = () => setSingleId(null);

  const gridClass = monitorGridClass(channels.length);

  return (
    <>
      {/*
        While a fullscreen view is open the grid is UNMOUNTED (not just hidden):
        that stops its sessions and frees the backend session cap for the main
        stream / wall, instead of racing to TOO_MANY_SESSIONS (429). `playingAll`
        is preserved, so the grid resumes (staggered) on exit.
      */}
      {!inOverlay && (
      <div className="p-4 md:p-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <LayoutGrid className="h-6 w-6 text-indigo-600" /> CCTV Monitor
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Semua channel CCTV dari seluruh device dalam satu grid. Tekan Play All untuk menonton semua, atau klik
              satu tile untuk melihatnya layar penuh.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="w-full sm:w-56">
              <label className="mb-1 block text-xs font-medium text-slate-500" htmlFor="monitor-stream">
                Stream
              </label>
              <select
                id="monitor-stream"
                aria-label="Stream"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            <button
              type="button"
              onClick={() => setShowWall(true)}
              disabled={!hasChannels}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Maximize className="h-4 w-4" /> Full Screen
            </button>
          </div>
        </div>

        {streamingDisabled && (
          <p className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            <TriangleAlert className="h-3.5 w-3.5" /> Streaming CCTV sedang dinonaktifkan di server.
          </p>
        )}

        {channelsQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center p-16">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : channelsQuery.isError ? (
          <EmptyState error text="Gagal memuat channel. Coba muat ulang halaman." />
        ) : channels.length === 0 ? (
          <EmptyState text="Belum ada channel tersinkron. Buka Device lalu jalankan Sync Channel." />
        ) : (
          <div className={gridClass}>
            {channels.map((ch, idx) => (
              <CctvStreamTile
                key={`${ch.id}:${streamKind}`}
                channel={ch}
                deviceId={ch.deviceId}
                deviceName={ch.device?.name ?? ''}
                streamKind={streamKind}
                autoStart={playingAll}
                startDelayMs={staggerDelayMs(idx)}
                onSelect={() => openSingle(ch.id)}
              />
            ))}
          </div>
        )}
      </div>
      )}

      {focusedChannel && (
        <SingleCameraFullscreen
          camera={{
            id: focusedChannel.id,
            deviceId: focusedChannel.deviceId,
            deviceName: focusedChannel.device?.name ?? '',
            channelNumber: focusedChannel.channelNumber,
            name: focusedChannel.name,
            location: focusedChannel.location,
          }}
          onClose={closeSingle}
        />
      )}

      {showWall && (
        <VideoWallFullscreen
          channels={channels}
          onClose={() => setShowWall(false)}
          onOpenSingle={(id) => {
            setShowWall(false);
            setSingleId(id);
          }}
        />
      )}
    </>
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