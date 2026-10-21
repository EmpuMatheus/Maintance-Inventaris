import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Loader2, Maximize, Minimize, Play, Square, TriangleAlert, Video } from 'lucide-react';
import { listMonitorChannels, getCctvLiveLimits } from '../api/cctv';
import CctvStreamTile from '../components/CctvStreamTile';
import type { CctvLiveStreamKind, CctvMonitorChannel } from '../types';
import {
  monitorGridClass,
  flattenMonitorChannels,
  fullscreenGridClass,
  fullscreenFillerCount,
  monitorTileState,
  FULLSCREEN_TILE_OPTIONS,
  type FullScreenTileCount,
  type MonitorView,
} from '../utils/monitor';
import { configureSessionLimiter } from '../utils/session-limiter';

const selectClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';
const selectClassDark =
  'rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

/**
 * CCTV Monitor: ONE flat video-wall grid of ALL channels across every device.
 *
 * - No device selection and no per-device sections: every channel is a single
 *   item in one collection.
 * - Nothing plays on open. The user starts the wall with "Play All" (and stops
 *   it with "Stop All"); the shared limiter caps concurrency and over-limit
 *   tiles show "Waiting".
 * - Clicking a tile shows THAT tile full screen and plays it immediately
 *   (all other tiles stop, so the clicked one never has to wait for a slot).
 * - The "Full Screen" button opens a tile-count chooser (4/9/16/25/32/36/49) for a
 *   multi-tile wall. While full screen, a tile-count <select> changes the wall
 *   live without leaving full screen. "Exit Full Screen" returns to the grid.
 */
export default function CctvMonitorPage() {
  const [streamKind, setStreamKind] = useState<CctvLiveStreamKind>('SUB');
  // Global wall switch. Starts false so the page never autoplays on open.
  const [playingAll, setPlayingAll] = useState(false);
  // Which wall is shown: the page grid, a full-screen multi-tile wall, or a
  // single full-screen tile the user clicked.
  const [view, setView] = useState<MonitorView>('grid');
  const [showFsDialog, setShowFsDialog] = useState(false);
  const [tileChoice, setTileChoice] = useState<FullScreenTileCount | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

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

  const inFullscreen = view !== 'grid';
  const activeTiles: FullScreenTileCount = tileChoice ?? 9;

  // A click on any tile zooms that tile to a single-tile full screen.
  const selectTile = (index: number) => {
    setFocusedIndex(index);
    setView('single');
  };

  // Entering Full Screen never changes the stream state: if the wall is already
  // playing, the visible tiles keep their sessions; if it is idle, it stays idle.
  const enterFullscreen = () => {
    if (!tileChoice) return;
    setShowFsDialog(false);
    setFocusedIndex(null);
    setView('multi');
  };

  const exitFullscreen = () => {
    setView('grid');
    setFocusedIndex(null);
  };

  // Change the multi-tile count while already full screen — no need to exit
  // first and reopen the chooser.
  const changeTileCount = (count: FullScreenTileCount) => {
    setTileChoice(count);
    setFocusedIndex(null);
    setView('multi');
  };

  const streamingDisabled = limitsQuery.data?.streamingEnabled === false;
  const hasChannels = channels.length > 0;
  const canPlay = hasChannels && !streamingDisabled;

  const streamSelect = (
    <select
      id="monitor-stream"
      aria-label="Stream"
      className={inFullscreen ? selectClassDark : selectClass}
      value={streamKind}
      onChange={(e) => setStreamKind(e.target.value as CctvLiveStreamKind)}
    >
      <option value="SUB">Sub Stream (ringan)</option>
      <option value="MAIN">Main Stream</option>
    </select>
  );

  const playStopButton = playingAll ? (
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
  );

  const tileCountSelect = (
    <select
      aria-label="Jumlah tile"
      className={selectClassDark}
      value={activeTiles}
      onChange={(e) => changeTileCount(Number(e.target.value) as FullScreenTileCount)}
    >
      {FULLSCREEN_TILE_OPTIONS.map((n) => (
        <option key={n} value={n}>
          {n} Tiles
        </option>
      ))}
    </select>
  );

  const gridClass =
    view === 'grid'
      ? monitorGridClass(channels.length)
      : view === 'multi'
        ? `${fullscreenGridClass(activeTiles)} flex-1 min-h-0`
        : 'grid grid-cols-1 grid-rows-1 flex-1 min-h-0';

  return (
    <>
      <div
        className={
          inFullscreen
            ? 'fixed inset-0 z-50 flex h-screen w-screen flex-col bg-slate-950'
            : 'p-4 md:p-6'
        }
      >
        {inFullscreen ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-2 py-2">
            <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
              <LayoutGrid className="h-5 w-5 text-indigo-400" /> CCTV Monitor
              <span className="text-sm font-normal text-slate-400">
                · Full Screen ({view === 'single' ? '1 tile' : `${activeTiles} tiles`})
              </span>
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {streamSelect}
              {tileCountSelect}
              {view === 'multi' && playStopButton}
              <button
                type="button"
                onClick={exitFullscreen}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                <Minimize className="h-4 w-4" /> Exit Full Screen
              </button>
            </div>
          </div>
        ) : (
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
                {streamSelect}
              </div>
              {playStopButton}
              <button
                type="button"
                onClick={() => setShowFsDialog(true)}
                disabled={!hasChannels}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Maximize className="h-4 w-4" /> Full Screen
              </button>
            </div>
          </div>
        )}

        {streamingDisabled && !inFullscreen && (
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
            {channels.map((ch, idx) => {
              // Tiles outside the current view stay MOUNTED (so any session is
              // torn down cleanly) but are hidden and never auto-started.
              const { hidden, autoStart } = monitorTileState({
                view,
                index: idx,
                focusedIndex,
                tileCount: activeTiles,
                playingAll,
              });
              return (
                <div
                  key={`${ch.id}:${streamKind}`}
                  className={hidden ? 'hidden' : inFullscreen ? 'min-h-0 min-w-0' : undefined}
                >
                  <CctvStreamTile
                    channel={ch}
                    deviceId={ch.deviceId}
                    deviceName={ch.device?.name ?? ''}
                    streamKind={streamKind}
                    autoStart={autoStart}
                    fill={inFullscreen}
                    onSelect={() => selectTile(idx)}
                  />
                </div>
              );
            })}
            {view === 'multi' &&
              Array.from({ length: fullscreenFillerCount(activeTiles, channels.length) }).map((_, i) => (
                <div key={`empty-slot-${i}`} className="rounded-lg border border-slate-800 bg-slate-900/40" />
              ))}
          </div>
        )}
      </div>

      {showFsDialog && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-900">Full Screen Monitor</h2>
            <p className="mt-1 text-sm text-slate-500">Pilih jumlah tile.</p>
            <div className="mt-4 space-y-2">
              {FULLSCREEN_TILE_OPTIONS.map((n) => (
                <label
                  key={n}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    tileChoice === n ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="fullscreen-tiles"
                    value={n}
                    checked={tileChoice === n}
                    onChange={() => setTileChoice(n)}
                  />
                  <span className="font-medium text-slate-700">{n} Tiles</span>
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowFsDialog(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={enterFullscreen}
                disabled={!tileChoice}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Lanjut
              </button>
            </div>
          </div>
        </div>
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
