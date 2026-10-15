import { useEffect, useState } from 'react';
import { Minimize, Video } from 'lucide-react';
import LivePlayer, { type PlayerStatus } from './LivePlayer';
import { useLiveSessionPlayer } from '../hooks/useLiveSessionPlayer';
import { useFullscreen } from '../hooks/useFullscreen';
import { useIdleControls } from '../hooks/useIdleControls';
import type { CctvLiveStreamKind } from '../types';

export interface FullscreenCamera {
  id: string;
  deviceId: string;
  deviceName: string;
  channelNumber: number;
  name: string;
  location: string | null;
}

/**
 * Single-camera, YouTube-style fullscreen player.
 *
 * - Owns the browser Fullscreen API on its root container; falls back to a CSS
 *   overlay when the browser denies/doesn't support it.
 * - Upgrades to the Main stream by default (crisp full-screen image) and lets
 *   the user switch back to Sub without leaving the view.
 * - Translucent overlay shows camera, quality and playback status; it auto-hides
 *   after a short idle and reappears on mouse/keyboard activity.
 * - Double-click toggles fullscreen; Escape (handled by the browser / hook)
 *   exits and returns to the grid.
 */
export default function SingleCameraFullscreen({
  camera,
  initialKind = 'MAIN',
  onClose,
}: {
  camera: FullscreenCamera;
  initialKind?: CctvLiveStreamKind;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<CctvLiveStreamKind>(initialKind);
  const [status, setStatus] = useState<PlayerStatus>('connecting');
  const { visible, reveal } = useIdleControls(3000);

  const { ref, enter, exit, toggle } = useFullscreen((active) => {
    if (!active) onClose();
  });

  const { session, reconnecting, notifyPlayerStatus } = useLiveSessionPlayer({
    deviceId: camera.deviceId,
    channelId: camera.id,
    streamKind: kind,
    autoStart: true,
    startDelayMs: 0,
    // The main stream is the priority view: retry quickly if the grid's
    // sessions are still shutting down and the cap is momentarily reached.
    waitRetryMs: 1000,
  });

  // Enter fullscreen once on mount (best effort — fallback covers denial).
  useEffect(() => {
    void enter();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enter once on mount
  }, []);

  const statusLabel = reconnecting
    ? 'Reconnecting…'
    : status === 'playing'
      ? 'LIVE'
      : status === 'error'
        ? 'Stream error'
        : 'Connecting…';

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[70] flex h-screen w-screen flex-col bg-black"
      onDoubleClick={() => void toggle()}
      onMouseMove={reveal}
    >
      <div className="relative flex-1">
        {session ? (
          <LivePlayer
            session={session}
            preferredTransport="webrtc"
            fill
            showControls={false}
            audio={false}
            onStatusChange={(s) => {
              setStatus(s);
              notifyPlayerStatus(s);
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-400">
            <Video className="mr-2 h-6 w-6" /> Connecting…
          </div>
        )}

        {/* Overlay: hidden on idle, revealed on activity. */}
        <div
          className={`absolute inset-0 flex flex-col justify-between transition-opacity duration-300 ${
            visible ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <div className="flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-white">{camera.name || 'Belum diatur'}</p>
              <p className="truncate text-xs text-slate-300">
                {camera.deviceName} · CH{String(camera.channelNumber).padStart(2, '0')}
                {camera.location ? ` · ${camera.location}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-black/60 px-2 py-0.5 text-xs font-semibold uppercase text-white">
                {kind}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${
                  status === 'playing' ? 'bg-red-600 text-white' : 'bg-amber-500/90 text-black'
                }`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-300" htmlFor="single-quality">
                Quality
              </label>
              <select
                id="single-quality"
                className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-slate-100"
                value={kind}
                onChange={(e) => setKind(e.target.value as CctvLiveStreamKind)}
              >
                <option value="MAIN">Main (HD)</option>
                <option value="SUB">Sub (ringan)</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => void exit()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
            >
              <Minimize className="h-4 w-4" /> Keluar Full Screen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
