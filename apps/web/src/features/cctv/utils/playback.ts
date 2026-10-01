import type { CctvPlaybackTransport } from '../types';

/**
 * Decides the transport order for a Live View session.
 *
 * WebRTC is the primary transport; HLS is the fallback. When a session has no
 * WebRTC descriptor (e.g. the gateway could not offer it), HLS is used
 * directly. The user may also force HLS.
 */
export function resolveTransportOrder(
  preferred: CctvPlaybackTransport,
  session: { webrtc: { endpoint: string } | null },
): CctvPlaybackTransport[] {
  if (preferred === 'hls') return ['hls'];
  if (!session.webrtc) return ['hls'];
  return ['webrtc', 'hls'];
}

/**
 * Builds the absolute, same-origin playback URL from an API-relative path.
 * Mirrors `cctvLiveSessionUrl` without importing the API module (kept pure so
 * it can be unit-tested without the app's fetch/auth stack).
 */
export function buildPlaybackUrl(apiUrl: string, relative: string): string {
  return `${apiUrl.replace(/\/+$/, '')}${relative}`;
}

/**
 * Builds the Live View deep link used by a Monitor tile. The Live View page
 * reads these params to AUTO-SELECT the device/channel only; it never uses them
 * to start playback (Live View does not autoplay).
 */
export function buildLiveViewUrl(
  deviceId: string,
  channelId: string,
  streamKind: 'MAIN' | 'SUB',
): string {
  return `/cctv/live?deviceId=${encodeURIComponent(deviceId)}&channelId=${encodeURIComponent(
    channelId,
  )}&stream=${streamKind}`;
}
