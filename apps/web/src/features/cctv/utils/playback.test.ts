import { describe, it, expect } from 'vitest';
import { resolveTransportOrder, buildPlaybackUrl, buildLiveViewUrl } from './playback';

describe('cctv playback utils', () => {
  it('prefers WebRTC and falls back to HLS when a WebRTC descriptor exists', () => {
    expect(resolveTransportOrder('webrtc', { webrtc: { endpoint: '/x/whep' } })).toEqual(['webrtc', 'hls']);
  });

  it('uses HLS directly when no WebRTC descriptor exists', () => {
    expect(resolveTransportOrder('webrtc', { webrtc: null })).toEqual(['hls']);
  });

  it('honours an explicit HLS preference', () => {
    expect(resolveTransportOrder('hls', { webrtc: { endpoint: '/x/whep' } })).toEqual(['hls']);
  });

  it('joins the API base and a relative playback path without a double slash', () => {
    expect(buildPlaybackUrl('/api/v1', '/cctv/live-sessions/1/hls/index.m3u8')).toBe(
      '/api/v1/cctv/live-sessions/1/hls/index.m3u8',
    );
    expect(buildPlaybackUrl('/api/v1/', '/cctv/live-sessions/1/whep')).toBe(
      '/api/v1/cctv/live-sessions/1/whep',
    );
  });

  it('never introduces an rtsp scheme', () => {
    const url = buildPlaybackUrl('/api/v1', '/cctv/live-sessions/1/whep');
    expect(url).not.toContain('rtsp://');
  });
});

describe('buildLiveViewUrl (Monitor tile -> Live View target selection)', () => {
  it('encodes device, channel and stream so Live View can auto-select', () => {
    const url = buildLiveViewUrl('dev-1', 'ch-9', 'SUB');
    expect(url.startsWith('/cctv/live?')).toBe(true);
    expect(url).toContain('deviceId=dev-1');
    expect(url).toContain('channelId=ch-9');
    expect(url).toContain('stream=SUB');
  });

  it('encodes ids with special characters', () => {
    const url = buildLiveViewUrl('a b', 'c/d', 'MAIN');
    expect(url).toContain('deviceId=a%20b');
    expect(url).toContain('channelId=c%2Fd');
  });
});
