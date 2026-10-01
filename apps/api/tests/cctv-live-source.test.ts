import { describe, it, expect } from 'vitest';
import { HikvisionIsapiProvider, parseHikvisionStreamId } from '@/modules/cctv/integration/hikvision.provider';
import { buildHikvisionRtspPath } from '@/modules/cctv/cctv.helpers';
import { buildGatewayConfig } from '@/lib/streaming/process-manager';
import type { IsapiClient } from '@/lib/isapi';

/** Minimal ISAPI client fake; the provider only uses channel discovery. */
class FakeIsapi {
  constructor(private channels: { id: string; channelName?: string | null; enabled?: boolean | null }[]) {}
  async getStreamingChannels() {
    return this.channels.map((c) => ({
      id: c.id,
      channelName: c.channelName ?? null,
      rtspPort: 554,
      enabled: c.enabled ?? true,
    }));
  }
  async getDeviceInformation() {
    return {
      manufacturer: 'Hikvision',
      model: 'DS-7216HGHI-K1',
      firmwareVersion: '1',
      serialNumber: 's',
      hardwareId: 'h',
      deviceName: 'DVR',
    };
  }
}

function provider(channels: { id: string; channelName?: string | null; enabled?: boolean | null }[]) {
  return new HikvisionIsapiProvider(new FakeIsapi(channels) as unknown as IsapiClient);
}

describe('HikvisionIsapiProvider - Live View source resolution', () => {
  it('builds path-based main/sub sources using the device channel number', async () => {
    const p = provider([{ id: '101', channelName: 'Cam 1' }]);
    const main = await p.resolveStreamSource({ channel: 1, kind: 'main', storedProfiles: [] });
    const sub = await p.resolveStreamSource({ channel: 3, kind: 'sub', storedProfiles: [] });
    expect(main.path).toBe('/Streaming/channels/101');
    expect(sub.path).toBe('/Streaming/channels/302');
    // Hikvision never returns a URI source.
    expect(main.uri).toBeUndefined();
  });

  it('derives channel numbering from the streaming id, not a fixed layout', () => {
    expect(parseHikvisionStreamId('101')).toEqual({ channel: 1, streamDigit: '01' });
    expect(parseHikvisionStreamId('1602')).toEqual({ channel: 16, streamDigit: '02' });
    expect(parseHikvisionStreamId('abc')).toBeNull();
  });

  it('groups per-stream ids into physical channels with main first', async () => {
    const p = provider([
      { id: '102', channelName: 'Cam 1', enabled: true },
      { id: '101', channelName: 'Cam 1', enabled: true },
      { id: '201', channelName: 'Cam 2', enabled: false },
    ]);
    const channels = await p.discoverChannels();
    expect(channels.map((c) => c.channelNumber)).toEqual([1, 2]);
    expect(channels[0].profiles.map((x) => x.streamType)).toEqual(['MAIN', 'SUB']);
    expect(channels[1].status).toBe('UNKNOWN'); // disabled channel
  });

  it('matches the shared RTSP path builder', () => {
    expect(buildHikvisionRtspPath(1, 'main')).toBe('/Streaming/channels/101');
    expect(buildHikvisionRtspPath(16, 'sub')).toBe('/Streaming/channels/1602');
  });
});

describe('streaming gateway config builder', () => {
  it('binds to loopback and pins RTSP to TCP for stability', () => {
    const yaml = buildGatewayConfig();
    expect(yaml).toContain('api: yes');
    expect(yaml).toContain('rtspTransports: [tcp]');
    expect(yaml).toContain('webrtc: yes');
    expect(yaml).toContain('hls: yes');
    expect(yaml).toContain('paths: {}');
    // No credentials ever appear in the generated config.
    expect(yaml).not.toMatch(/password/i);
  });
});
