import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { Loader2, VideoOff } from 'lucide-react';
import { createWhepReader } from '../utils/whep';
import { resolveTransportOrder } from '../utils/playback';
import { cctvLiveSessionUrl, heartbeatCctvLiveSession } from '../api/cctv';
import { getStoredToken } from '@/services/auth';
import type { CctvLiveSession, CctvPlaybackTransport } from '../types';

export type PlayerStatus = 'connecting' | 'playing' | 'error';

/** Renew the session TTL well inside the backend TTL (default 300s). */
const HEARTBEAT_MS = 30_000;
/** Fail the UI instead of spinning forever when neither transport connects. */
const CONNECT_TIMEOUT_MS = 30_000;

export interface LivePlayerProps {
  session: CctvLiveSession;
  /** Preferred transport; WebRTC is attempted first, HLS is the fallback. */
  preferredTransport: CctvPlaybackTransport;
  onStatusChange?: (status: PlayerStatus, transport: CctvPlaybackTransport | null) => void;
}

/**
 * Plays a Live View session using WebRTC (WHEP) with an HLS fallback.
 *
 * - The player only ever talks to the same-origin API proxy; it never sees an
 *   RTSP URL or a CCTV credential.
 * - It renews the live session with a heartbeat so a stream keeps running for
 *   as long as the component is mounted (not just the base TTL).
 * - WebRTC failure is not treated as a fatal error: HLS fallback success still
 *   reports `playing`.
 */
export default function LivePlayer({ session, preferredTransport, onStatusChange }: LivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<PlayerStatus>('connecting');
  const [transport, setTransport] = useState<CctvPlaybackTransport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onStatusChange?.(status, transport);
  }, [status, transport, onStatusChange]);

  // Renew the live session while this player is mounted so the reaper never
  // closes an actively-watched stream.
  useEffect(() => {
    const id = session?.id;
    if (!id) return;
    void heartbeatCctvLiveSession(id).catch(() => {});
    const timer = window.setInterval(() => {
      void heartbeatCctvLiveSession(id).catch(() => {});
    }, HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [session?.id]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !session) return;

    setStatus('connecting');
    setError(null);
    setTransport(null);

    let disposed = false;
    let settled = false;
    let whepReader: { close: () => void } | null = null;
    let hls: Hls | null = null;

    // Safety net: never leave the UI in a permanent "connecting" state.
    const connectTimer = window.setTimeout(() => {
      if (disposed || settled) return;
      setStatus('error');
      setError((prev) => prev ?? 'Stream connection timed out.');
    }, CONNECT_TIMEOUT_MS);

    const markPlaying = (t: CctvPlaybackTransport) => {
      if (disposed) return;
      settled = true;
      window.clearTimeout(connectTimer);
      setTransport(t);
      setStatus('playing');
    };

    const startHls = () => {
      if (disposed) return;
      const manifestUrl = cctvLiveSessionUrl(session.hls.manifestUrl);
      const token = getStoredToken();

      if (Hls.isSupported()) {
        hls = new Hls({
          xhrSetup: (xhr) => {
            if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          },
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          markPlaying('hls');
          void video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            if (disposed) return;
            setStatus('error');
            setTransport('hls');
            // Surface the real reason instead of a generic message so the
            // gateway/stream state is diagnosable from the UI.
            const detail = data.details ? ` (${data.details})` : '';
            const reason = data.reason ? `: ${data.reason}` : '';
            setError(`HLS playback failed${detail}${reason}`);
          }
        });
        hls.loadSource(manifestUrl);
        hls.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari). No auth header support; relies on same-origin.
        video.src = manifestUrl;
        markPlaying('hls');
        void video.play().catch(() => {});
      } else {
        setStatus('error');
        setError('This browser cannot play the stream.');
      }
    };

    const startWebrtc = () => {
      if (disposed || !session.webrtc) {
        startHls();
        return;
      }
      const endpoint = cctvLiveSessionUrl(session.webrtc.endpoint);
      let firstTrack = true;
      whepReader = createWhepReader(endpoint, getStoredToken(), {
        onTrack: (stream) => {
          if (disposed) return;
          video.srcObject = stream;
          if (firstTrack) {
            firstTrack = false;
            markPlaying('webrtc');
          }
          void video.play().catch(() => {});
        },
        onError: () => {
          if (disposed) return;
          // WebRTC failed: fall back to HLS once. This is NOT a fatal error —
          // the stream can still be considered connected if HLS plays.
          if (whepReader) {
            whepReader.close();
            whepReader = null;
          }
          startHls();
        },
      });
    };

    if (preferredTransport === 'hls') {
      startHls();
    } else if (resolveTransportOrder(preferredTransport, session)[0] === 'webrtc') {
      startWebrtc();
    } else {
      startHls();
    }

    return () => {
      disposed = true;
      window.clearTimeout(connectTimer);
      if (whepReader) whepReader.close();
      if (hls) hls.destroy();
      if (video) {
        video.srcObject = null;
        video.removeAttribute('src');
        video.load();
      }
    };
  }, [session, preferredTransport]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        controls
        muted
        autoPlay
        playsInline
      />
      {status === 'connecting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-slate-200">
          <Loader2 className="h-7 w-7 animate-spin" />
          <span className="text-xs">Connecting…</span>
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-slate-200">
          <VideoOff className="h-7 w-7" />
          <span className="px-6 text-center text-xs">{error ?? 'Stream unavailable.'}</span>
        </div>
      )}
      {status === 'playing' && transport && (
        <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium uppercase text-white">
          {transport}
        </span>
      )}
    </div>
  );
}
