import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import { streamingGatewayConfig } from '@/config/env';
import * as svc from '@/modules/cctv/cctv.service';
import * as live from '@/modules/cctv/cctv.live.service';
import { buildAuthorizedRtspSource } from '@/modules/cctv/cctv.live.service';
import { setStreamingGatewayFactory, resetStreamingGatewayFactory } from '@/lib/streaming';
import type { StreamingGateway, GatewayPathConfig, GatewayPathState } from '@/lib/streaming/types';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

const PASSWORD = 'super-secret-pass';

let deviceId: string;
let channelId: string;

/** In-memory fake gateway that records path configs (including the source). */
class FakeGateway implements StreamingGateway {
  readonly paths = new Map<string, GatewayPathConfig>();
  readonly states = new Map<string, GatewayPathState>();
  public ready = true;
  public failAdd = false;

  async isAvailable() {
    return true;
  }
  async addPath(config: GatewayPathConfig) {
    if (this.failAdd) throw new Error('gateway down');
    this.paths.set(config.name, config);
    if (this.ready) this.states.set(config.name, { name: config.name, online: true, ready: true });
  }
  async removePath(name: string) {
    this.paths.delete(name);
    this.states.delete(name);
  }
  async getPath(name: string) {
    return this.states.get(name) ?? null;
  }
  webrtcEndpoint(name: string) {
    return `http://127.0.0.1:8889/${name}/whep`;
  }
  hlsManifestUrl(name: string) {
    return `http://127.0.0.1:8888/${name}/index.m3u8`;
  }
  rtspUrl(name: string) {
    return `rtsp://127.0.0.1:8554/${name}`;
  }
}

let gateway: FakeGateway;

beforeAll(async () => {
  const device = await svc.create({
    name: `QA Live Hikvision ${RUN}`,
    deviceType: 'DVR',
    brand: 'Hikvision',
    model: 'DS-7216HGHI-K1',
    ipAddress: `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    port: 82,
    rtspPort: 554,
    username: 'admin',
    password: PASSWORD,
  });
  deviceId = device!.id as string;

  const sync = {
    async getDeviceInformation() {
      return { manufacturer: 'Hikvision', model: 'DS-7216HGHI-K1', firmwareVersion: '1', serialNumber: 's', hardwareId: 'h' };
    },
    async discoverChannels() {
      return [];
    },
    async resolveRtspTargets() {
      return [];
    },
    async resolveStreamSource() {
      return { channel: 1, kind: 'main' as const, path: '/Streaming/channels/101', display: '/Streaming/channels/101' };
    },
  };
  void sync;

  // Create a channel directly so the live service can resolve it.
  const repo = await import('@/modules/cctv/cctv.repository');
  const channel = await repo.upsertChannelTechnical(deviceId, 1, {
    deviceChannelId: '1',
    technicalName: 'Cam 1',
    cameraIp: null,
    status: 'ONLINE',
    lastSyncAt: new Date(),
  });
  channelId = channel!.id as string;
});

afterAll(async () => {
  await sql`DELETE FROM cctv_devices WHERE id = ${deviceId}`;
  await sql.end();
});

beforeEach(async () => {
  gateway = new FakeGateway();
  setStreamingGatewayFactory(() => gateway);
  // Keep the not-ready path fast under test (default is 10s).
  live.setLiveReadyTimeoutMs(300);
  // Each test starts from a clean session slate so reuse logic is isolated.
  await sql`DELETE FROM cctv_live_sessions WHERE device_id = ${deviceId}`;
});

afterEach(() => {
  live.setLiveReadyTimeoutMs(null);
  resetStreamingGatewayFactory();
});

describe('cctv live session - source builder (credential handling)', () => {
  it('builds a Hikvision RTSP URL with the stored credential, server-side only', () => {
    const url = buildAuthorizedRtspSource(
      { channel: 1, kind: 'main', path: '/Streaming/channels/101', display: '' },
      { ipAddress: '192.168.2.244', rtspPort: 554, username: 'admin', passwordEncrypted: null },
    );
    expect(url).toBe('rtsp://admin:@192.168.2.244:554/Streaming/channels/101');
  });

  it('re-attaches credentials to an ONVIF URI and strips a device-embedded credential', () => {
    const url = buildAuthorizedRtspSource(
      { channel: 1, kind: 'sub', uri: 'rtsp://foo:bar@10.0.0.9:554/cam/realmonitor?channel=1&subtype=1', display: '' },
      { ipAddress: '10.0.0.9', rtspPort: 554, username: 'admin', passwordEncrypted: null },
    );
    expect(url).toContain('admin');
    expect(url).toContain('10.0.0.9');
    expect(url).not.toContain('foo:bar');
  });
});

describe('cctv live session - service', () => {
  it('creates a session, configures the gateway, and returns a safe view', async () => {
    const view = await live.createLiveSession({
      deviceId,
      channelId,
      streamKind: 'MAIN',
      userId: null,
    });

    expect(view.deviceId).toBe(deviceId);
    expect(view.channelId).toBe(channelId);
    expect(view.streamKind).toBe('MAIN');
    expect(view.webrtc?.endpoint).toContain(`/cctv/live-sessions/${view.id}/whep`);
    expect(view.hls.manifestUrl).toContain(`/cctv/live-sessions/${view.id}/hls/index.m3u8`);

    // A path was configured on the gateway...
    const configs = Array.from(gateway.paths.values());
    expect(configs).toHaveLength(1);

    // ...but the API response never contains the credential.
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(PASSWORD);
    expect(serialized).not.toContain('rtsp://');
    expect(serialized).not.toContain('admin:');
  });

  it('passthrough mode puts the credential-bearing source only on the gateway', async () => {
    const original = streamingGatewayConfig.ingestMode;
    (streamingGatewayConfig as { ingestMode: string }).ingestMode = 'passthrough';
    try {
      await live.createLiveSession({ deviceId, channelId, streamKind: 'MAIN', userId: null });
      const configs = Array.from(gateway.paths.values());
      expect(configs).toHaveLength(1);
      expect(String(configs[0].source)).toContain(PASSWORD);
    } finally {
      (streamingGatewayConfig as { ingestMode: string }).ingestMode = original;
    }
  });

  it('normalize mode configures a publisher path (credential lives in the FFmpeg ingest)', async () => {
    const original = streamingGatewayConfig.ingestMode;
    (streamingGatewayConfig as { ingestMode: string }).ingestMode = 'normalize';
    try {
      await live.createLiveSession({ deviceId, channelId, streamKind: 'MAIN', userId: null });
      const configs = Array.from(gateway.paths.values());
      expect(configs).toHaveLength(1);
      // The gateway never receives the credential; it is a publisher path.
      expect(String(configs[0].source)).not.toContain(PASSWORD);
    } finally {
      (streamingGatewayConfig as { ingestMode: string }).ingestMode = original;
    }
  });

  it('reuses an active session for the same channel/kind instead of adding a new path', async () => {
    const first = await live.createLiveSession({ deviceId, channelId, streamKind: 'SUB', userId: null });
    const second = await live.createLiveSession({ deviceId, channelId, streamKind: 'SUB', userId: null });
    expect(second.id).toBe(first.id);
    expect(gateway.paths.size).toBe(1);
  });

  it('throws STREAM_UNAVAILABLE and cleans up when the stream never becomes ready', async () => {
    gateway.ready = false;
    await expect(
      live.createLiveSession({ deviceId, channelId, streamKind: 'MAIN', userId: null }),
    ).rejects.toMatchObject({ code: 'STREAM_UNAVAILABLE' });
    // The unready path must not be left behind.
    expect(gateway.paths.size).toBe(0);
  });

  it('throws GATEWAY_UNAVAILABLE when the gateway cannot accept the path', async () => {
    gateway.failAdd = true;
    await expect(
      live.createLiveSession({ deviceId, channelId, streamKind: 'MAIN', userId: null }),
    ).rejects.toMatchObject({ code: 'GATEWAY_UNAVAILABLE' });
  });

  it('stops a session and removes its gateway path', async () => {
    const view = await live.createLiveSession({ deviceId, channelId, streamKind: 'MAIN', userId: null });
    await live.stopLiveSession(view.id);
    expect(gateway.paths.size).toBe(0);
    await expect(live.getLiveSession(view.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects an unknown channel', async () => {
    await expect(
      live.createLiveSession({
        deviceId,
        channelId: '00000000-0000-0000-0000-000000000000',
        streamKind: 'MAIN',
        userId: null,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects a channel that does not belong to the device', async () => {
    const other = await svc.create({
      name: `QA Live Other ${RUN}`,
      deviceType: 'DVR',
      brand: 'Hikvision',
      ipAddress: `10.76.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
      port: 82,
      rtspPort: 554,
      username: 'admin',
      password: PASSWORD,
    });
    try {
      await expect(
        live.createLiveSession({ deviceId: other!.id as string, channelId, streamKind: 'MAIN', userId: null }),
      ).rejects.toMatchObject({ statusCode: 404 });
    } finally {
      await sql`DELETE FROM cctv_devices WHERE id = ${other!.id as string}`;
    }
  });
});
