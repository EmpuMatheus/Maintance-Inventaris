import { Clock, Loader2, PlayCircle, VideoOff } from 'lucide-react';
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
 * The tile NEVER starts on its own. It only starts when the parent sets
 * `autoStart` (Monitor "Play All"), and is gated by the shared session limiter
 * so a large wall does not open every stream at once (over-limit tiles show
 * "Waiting"). Clicking the tile opens Live View (which also does not autoplay).
 */
export default function CctvStreamTile({
  deviceId,
  deviceName,
  channel,
  streamKind,
  autoStart = false,
  fill = false,
  onOpen,
}: {
  deviceId: string;
  deviceName?: string;
  channel: TileChannel;
  streamKind: CctvLiveStreamKind;
  autoStart?: boolean;
  /** Full Screen wall mode: fill the grid cell instead of using aspect-video. */
  fill?: boolean;
  onOpen: (deviceId: string, channelId: string, streamKind: CctvLiveStreamKind) => void;
}) {
  const { phase, session, error, notifyPlayerStatus } = useLiveSessionPlayer({
    deviceId,
    channelId: channel.id,
    streamKind,
    gated: true,
    autoStart,
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
        onClick={() => onOpen(deviceId, channel.id, streamKind)}
        className="absolute inset-0 z-10 cursor-pointer"
        aria-label={`Buka Live View ${deviceName ? `${deviceName} ` : ''}${label}`}
      />

      <div className={fill ? 'relative h-full w-full' : 'relative aspect-video w-full'}>
        {session ? (
          <LivePlayer
            session={session}
            preferredTransport="webrtc"
            onStatusChange={notifyPlayerStatus}
            fill={fill}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
            {phase === 'error' ? (
              <div className="flex flex-col items-center gap-1 px-3 text-center text-slate-400">
                <VideoOff className="h-6 w-6" />
                <span className="text-[11px]">Stream Error</span>
                {error && <span className="text-[10px] text-slate-500">{error}</span>}
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
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1 pt-4">
        {deviceName && <p className="truncate text-[10px] uppercase tracking-wide text-slate-300">{deviceName}</p>}
        <p className="truncate text-[11px] font-medium text-white">{channel.name || 'Belum diatur'}</p>
        {channel.location && <p className="truncate text-[10px] text-slate-300">{channel.location}</p>}
      </div>
    </div>
  );
}
