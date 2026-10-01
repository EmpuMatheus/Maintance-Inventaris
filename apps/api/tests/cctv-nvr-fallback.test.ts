import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import { streamingGatewayConfig } from '@/config/env';
import * as svc from '@/modules/cctv/cctv.service';
import * as live from '@/modules/cctv/cctv.live.service';
import * as repo from '@/modules/cctv/cctv.repository';
import type { CctvRtspClient } from '@/modules/cctv/cctv.service';
import { OnvifError } from '@/lib/onvif/errors';
import { setStreamingGatewayFactory, resetStreamingGatewayFactory } from '@/lib/streaming';
import type { StreamingGateway, GatewayPathConfig, GatewayPathState } from '@/lib/streaming/types';

/**
 * XMEye NVR handling: ONVIF may be unavailable while RTSP still works. These
 * tests prove:
 *   1. Test RTSP uses the STORED ONVIF StreamUri (scoped to the channel) and
 *      does not require a live ONVIF call.
 *   2. Live View opens from that stored RTSP source without ONVIF.
 *   3. Test Connection reports ONVIF failure honestly (no fake success) and adds
 *      a hint that RTSP may still work.
 */

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

const STORED_URI = 'rtsp://10.0.0.9:554/onvif/profile/P_sub';

let deviceId: string;
let channelId: string;

class FakeRtsp implements CctvRtspClient {
  public paths: string[] = [];
  public uris: string[] = [];
  async describe(path: string) {
    this.paths.push(path);
    return { statusCode: 200, latencyMs: 10, authenticated: true, decodedFrames: 5, durationMs: 20 };
  }
  async describeUri(uri: string) {
    this.uris.push(uri);
    return { statusCode: 200, latencyMs: 12, authenticated: true, decodedFrames: 5, durationMs: 22 };
  }
}

class FakeGateway implements StreamingGateway {
  readonly paths = new Map<string, GatewayPathConfig>();
  async isAvailable() { return true; }
  async addPath(config: GatewayPathConfig) {
    this.paths.set(config.name, config);
  }
  async removePath(name: string) { this.paths.delete(name); }
  async getPath(name: string): Promise<GatewayPathState | null> {
    return this.paths.has(name) ? { name, online: true, ready: true } : null;
  }
  webrtcEndpoint(name: string) { return `http://127.0.0.1:8889/${name}/whep`; }
  hlsManifestUrl(name: string) { return `http://127.0.0.1:8888/${name}/index.m3u8`; }
  rtspUrl(name: string) { return `rtsp://127.0.0.1:8554/${name}`; }
}

let gateway: FakeGateway;

beforeAll(async () => {
  const device = await svc.create({
    name: `QA NVR ONVIF ${RUN}`,
    deviceType: 'NVR',
    brand: 'XMEye',
    ipAddress: `10.95.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    port: 80,
    rtspPort: 554,
    username: 'admin',
    password: 'secret-password',
  });
  deviceId = device!.id as string;

  const channel = await repo.upsertChannelTechnical(deviceId, 1, {
    deviceChannelId: 'VS_1',
    technicalName: 'Cam 1',
    cameraIp: null,
    status: 'ONLINE',
    lastSyncAt: new Date(),
  });
  channelId = channel!.id as string;

  await repo.upsertStreamProfiles(channelId, [
    {
      profileToken: 'P_sub',
      profileName: 'subStream',
      streamType: 'SUB',
      streamUri: STORED_URI,
      videoCodec: 'H264',
      resolution: '640x480',
      fps: 15,
      isMainStream: false,
    },
  ]);
});

afterAll(async () => {
  await sql`DELETE FROM cctv_devices WHERE id = ${deviceId}`;
  await sql.end();
});

beforeEach(async () => {
  gateway = new FakeGateway();
  setStreamingGatewayFactory(() => gateway);
  live.setLiveReadyTimeoutMs(300);
  await sql`DELETE FROM cctv_live_sessions WHERE device_id = ${deviceId}`;
});

afterEach(() => {
  live.setLiveReadyTimeoutMs(null);
  resetStreamingGatewayFactory();
  svc.resetCctvRtspClientFactory();
  svc.resetCctvClientFactory();
});

describe('XMEye NVR - RTSP from stored ONVIF source (no live ONVIF)', () => {
  it('Test RTSP uses the stored StreamUri and never a Hikvision path', async () => {
    const fake = new FakeRtsp();
    svc.setCctvRtspClientFactory(() => fake);

    const result = await svc.testRtspConnection(deviceId, { channel: 1 });

    expect(result.protocol).toBe('ONVIF');
    expect(result.success).toBe(true);
    expect(fake.paths).toEqual([]); // no fabricated Hikvision path
    expect(fake.uris).toHaveLength(1);
    expect(fake.uris[0]).toContain('10.0.0.9');
    expect(fake.uris[0]).not.toContain('Streaming/channels');
    // Credential never appears in the response.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('secret-password');
    expect(serialized).not.toContain('admin:');
  });

  it('Live View opens from the stored RTSP source without ONVIF', async () => {
    const original = streamingGatewayConfig.ingestMode;
    (streamingGatewayConfig as { ingestMode: string }).ingestMode = 'passthrough';
    try {
      const view = await live.createLiveSession({
        deviceId,
        channelId,
        streamKind: 'SUB',
        userId: null,
      });
      expect(view.protocol).toBe('ONVIF');
      const config = Array.from(gateway.paths.values())[0];
      expect(config).toBeTruthy();
      // The gateway source is the stored ONVIF RTSP URI, with the stored
      // credential attached server-side.
      expect(String(config.source)).toContain('10.0.0.9');
      expect(String(config.source)).toContain('secret-password');
      // The API response never exposes the credential.
      expect(JSON.stringify(view)).not.toContain('secret-password');
    } finally {
      (streamingGatewayConfig as { ingestMode: string }).ingestMode = original;
    }
  });

  it('Test Connection reports ONVIF failure honestly (no fake success) with an RTSP hint', async () => {
    svc.setCctvClientFactory(() => ({
      async getDeviceInformation() {
        throw new OnvifError('ONVIF_UNAVAILABLE');
      },
      async getServices() {
        return [];
      },
      async getVideoSources() {
        return [];
      },
      async getProfiles() {
        return [];
      },
      async getStreamUri() {
        return { uri: null };
      },
    }));

    const result = await svc.testConnection(deviceId);
    expect(result.protocol).toBe('ONVIF');
    expect(result.success).toBe(false);
    expect(result.protocolAvailable).toBe(false);
    expect(result.hint).toBeTruthy();
    expect(result.hint).toContain('RTSP');
  });
});
