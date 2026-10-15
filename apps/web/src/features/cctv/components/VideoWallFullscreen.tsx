import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, Minimize, Play, Square } from 'lucide-react';
import CctvStreamTile from './CctvStreamTile';
import { useFullscreen } from '../hooks/useFullscreen';
import { useIdleControls } from '../hooks/useIdleControls';
import { staggerDelayMs } from '../utils/stream-startup';
import {
  FULLSCREEN_TILE_OPTIONS,
  fullscreenFillerCount,
  fullscreenGridClass,
  type FullScreenTileCount,
} from '../utils/monitor';
import type { CctvLiveStreamKind, CctvMonitorChannel } from '../types';

/**
 * Fullscreen video wall (1/4/9/16 layouts).
 *
 * Uses the browser Fullscreen API on its root container so the entire app shell
 * is hidden natively; a CSS overlay is the fallback. The toolbar is minimal and
 * auto-hides, reappearing on interaction. Tiles use the Sub stream and are
 * started in a staggered, concurrency-limited way (handled by the tile hook).
 * Clicking a tile hands off to the single-camera view (the page owns that
 * transition, so the wall simply unmounts and the browser exits fullscreen).
 */
export default function VideoWallFullscreen({
  channels,
  onClose,
  onOpenSingle,
}: {
  channels: CctvMonitorChannel[];
  onClose: () => void;
  onOpenSingle: (channelId: string) => void;
}) {
  const { ref, enter, exit } = useFullscreen((active) => {
    if (!active) onClose();
  });
  const { visible, reveal } = useIdleControls(3000);

  const [layout, setLayout] = useState<FullScreenTileCount>(() =>
    channels.length >= 9 ? 9 : channels.length >= 4 ? 4 : 1,
  );
  const [streamKind, setStreamKind] = useState<CctvLiveStreamKind>('SUB');
  const [playing, setPlaying] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    channels.slice(0, 16).map((c) => c.id),
  );

  useEffect(() => {
    void enter();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enter once on mount
  }, []);

  const selectedChannels = useMemo(
    () => selectedIds.map((id) => channels.find((c) => c.id === id)).filter((c): c is CctvMonitorChannel => !!c),
    [selectedIds, channels],
  );
  const visibleChannels = selectedChannels.slice(0, layout);
  const filler = fullscreenFillerCount(layout, visibleChannels.length);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[70] flex h-screen w-screen flex-col bg-slate-950"
      onMouseMove={reveal}
      onDoubleClick={() => void exit()}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 bg-slate-900/95 px-3 py-2 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <h1 className="flex items-center gap-2 text-sm font-semibold text-white">
          <LayoutGrid className="h-4 w-4 text-indigo-400" /> Video Wall
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Layout"
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
            value={layout}
            onChange={(e) => setLayout(Number(e.target.value) as FullScreenTileCount)}
          >
            {FULLSCREEN_TILE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} layout
              </option>
            ))}
          </select>
          <select
            aria-label="Stream"
            className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-200"
            value={streamKind}
            onChange={(e) => setStreamKind(e.target.value as CctvLiveStreamKind)}
          >
            <option value="SUB">Sub Stream</option>
            <option value="MAIN">Main Stream</option>
          </select>

          <details className="relative">
            <summary className="cursor-pointer list-none rounded border border-slate-700 px-2 py-1 text-sm text-slate-200">
              Cameras ({selectedIds.length})
            </summary>
            <div className="absolute right-0 z-20 mt-1 max-h-64 w-64 overflow-y-auto rounded border border-slate-700 bg-slate-900 p-2 shadow-xl">
              {channels.map((c) => (
                <label key={c.id} className="flex items-center gap-2 rounded px-1 py-1 text-xs text-slate-200 hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleSelected(c.id)}
                  />
                  <span className="truncate">
                    {c.device?.name ?? ''} · CH{String(c.channelNumber).padStart(2, '0')} {c.name}
                  </span>
                </label>
              ))}
            </div>
          </details>

          {playing ? (
            <button
              type="button"
              onClick={() => setPlaying(false)}
              className="inline-flex items-center gap-1.5 rounded bg-red-600 px-3 py-1 text-sm font-medium text-white hover:bg-red-700"
            >
              <Square className="h-3.5 w-3.5" /> Stop All
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPlaying(true)}
              className="inline-flex items-center gap-1.5 rounded bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Play className="h-3.5 w-3.5" /> Play All
            </button>
          )}
          <button
            type="button"
            onClick={() => void exit()}
            className="inline-flex items-center gap-1.5 rounded border border-slate-600 px-3 py-1 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            <Minimize className="h-3.5 w-3.5" /> Exit
          </button>
        </div>
      </div>

      <div className={`${fullscreenGridClass(layout)} min-h-0 flex-1 gap-1 p-1`}>
        {visibleChannels.map((ch, idx) => (
          <div key={ch.id} className="min-h-0 min-w-0">
            <CctvStreamTile
              channel={ch}
              deviceId={ch.deviceId}
              deviceName={ch.device?.name ?? ''}
              streamKind={streamKind}
              autoStart={playing}
              startDelayMs={staggerDelayMs(idx)}
              fill
              onSelect={() => onOpenSingle(ch.id)}
            />
          </div>
        ))}
        {Array.from({ length: filler }).map((_, i) => (
          <div key={`wall-empty-${i}`} className="rounded border border-slate-800 bg-slate-900/40" />
        ))}
      </div>
    </div>
  );
}
