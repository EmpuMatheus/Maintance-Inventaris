import { Clock, Loader2, Maximize2, PlayCircle, RefreshCw, VideoOff } from 'lucide-react';
import LivePlayer from './LivePlayer';
import { useLiveSessionPlayer } from '../hooks/useLiveSessionPlayer';
import type { CctvLiveStreamKind } from '../types';

/** Minimal channel shape the tile renders (full channel or monitor row). */
interface TileChannel {
  id: string;
  channelNumber: number;
  name: string;
  location: string | null;
}

/**
 * A single, uniform tile in the CCTV video-wall grid.
 *
 * The tile NEVER starts on its own. It starts when the parent sets `autoStart`
 * (Monitor "Play All", or when this tile is the fullscreen focus), and is gated
 * by the shared start limiter so a large wall negotiates a few streams at a
 * time instead of all at once (over-limit tiles show "Waiting"). `startDelayMs`
 * staggers the first attempts. Clicking the tile (or its fullscreen button) asks
 * the parent to show it full screen and play it.
 */
export default function CctvStreamTile({
  deviceId,
  deviceName,
  channel,
  streamKind,
  autoStart = false,
  startDelayMs = 0,
  fill = false,
  onSelect,
}: {
  deviceId: string;
  deviceName?: string;
  channel: TileChannel;
  streamKind: CctvLiveStreamKind;
  autoStart?: boolean;
  /** Staggered startup delay for this tile, in ms. */
  startDelayMs?: number;
  /** Full Screen wall mode: fill the grid cell instead of using aspect-video. */
  fill?: boolean;
  onSelect: () => void;
}) {
  const { phase, session, error, reconnecting, retryAttempt, notifyPlayerStatus } =
    useLiveSessionPlayer({
      deviceId,
      channelId: channel.id,
      streamKind,
      gated: true,
      autoStart,
      startDelayMs,
    });

  const label = `CH${String(channel.channelNumber).padStart(2, '0')}`;

  return (
    <div
      className={`group relative overflow-hidden rounded-lg border border-slate-200 bg-black ${
        fill ? 'h-full w-full' : ''
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label={`Tampilkan layar penuh ${deviceName ? `${deviceName} ` : ''}${label}`}
      />

      <div className={fill ? 'relative h-full w-full' : 'relative aspect-video w-full'}>
        {session ? (
          <LivePlayer
            session={session}
            preferredTransport="webrtc"
            onStatusChange={notifyPlayerStatus}
            fill={fill}
            stretch
            showControls={false}
            audio={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            {phase === 'error' ? (
              <div className="flex flex-col items-center gap-1 px-3 text-center text-slate-400">
                <VideoOff className="h-6 w-6" />
                <span className="text-[11px]">{reconnecting ? 'Reconnecting…' : 'Stream Error'}</span>
                {reconnecting && retryAttempt > 0 && (
                  <span className="text-[10px] text-slate-500">attempt {retryAttempt}</span>
                )}
                {error && !reconnecting && <span className="text-[10px] text-slate-500">{error}</span>}
              </div>
            ) : phase === 'waiting' ? (
              <div className="flex flex-col items-center gap-1 text-amber-400/80">
                <Clock className="h-5 w-5" />
                <span className="text-[11px]">Waiting</span>
              </div>
            ) : phase === 'starting' ? (
              <div className="flex flex-col items-center gap-1 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-[11px]">Starting…</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-500">
                <PlayCircle className="h-6 w-6" />
                <span className="text-[11px]">Ready</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overlay labels (pointer-events disabled so the tile button stays clickable). */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-2 py-1">
        <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[11px] text-white">{label}</span>
        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
          {streamKind === 'MAIN' ? 'MAIN' : 'SUB'}
        </span>
      </div>

      {/* Reconnect indicator (visible state per camera). */}
      {reconnecting && (
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 flex -translate-x-1/2 items-center gap-1 rounded bg-black/70 px-2 py-0.5 text-[10px] text-amber-300">
          <RefreshCw className="h-3 w-3 animate-spin" /> Reconnecting
        </div>
      )}

      {/* Fullscreen control. */}
      <button
        type="button"
        onClick={onSelect}
        aria-label={`Layar penuh ${label}`}
        className="absolute right-1.5 top-1.5 z-30 rounded bg-black/50 p-1 text-white opacity-0 transition-opacity hover:bg-black/70 focus:opacity-100 group-hover:opacity-100"
      >
        <Maximize2 className="h-3.5 w-3.5" />
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4">
        {deviceName && <p className="truncate text-[10px] uppercase tracking-wide text-slate-300">{deviceName}</p>}
        <p className="truncate text-[11px] font-medium text-white">{channel.name || 'Belum diatur'}</p>
        {channel.location && <p className="truncate text-[10px] text-slate-300">{channel.location}</p>}
      </div>
    </div>
  );
}
