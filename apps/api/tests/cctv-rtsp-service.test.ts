import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as svc from '@/modules/cctv/cctv.service';
import type { CctvRtspClient } from '@/modules/cctv/cctv.service';
import { RtspError } from '@/lib/rtsp/errors';
import { buildHikvisionRtspPath } from '@/modules/cctv/cctv.helpers';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let hikDeviceId: string;
let xmDeviceId: string;

/** Fake RTSP client that records the paths/URIs it was asked to probe. */
class FakeRtsp implements CctvRtspClient {
  public paths: string[] = [];
  public uris: string[] = [];
  constructor(
    private fail?:
      | 'AUTHENTICATION_FAILED'
      | 'DEVICE_UNREACHABLE'
      | 'CONNECTION_TIMEOUT'
      | 'STREAM_UNAVAILABLE',
  ) {}

  async describe(path: string) {
    this.paths.push(path);
    if (this.fail) throw new RtspError(this.fail);
    return { statusCode: 200, latencyMs: 12, authenticated: true };
  }
  async describeUri(uri: string) {
    this.uris.push(uri);
    if (this.fail) throw new RtspError(this.fail);
    return { statusCode: 200, latencyMs: 20, authenticated: true };
  }
}

beforeAll(async () => {
  const hik = await svc.create({
    name: `QA RTSP Hikvision ${RUN}`,
    deviceType: 'DVR',
    brand: 'Hikvision',
    model: 'DS-7216HGHI-K1',
    ipAddress: `10.99.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    port: 80,
    rtspPort: 10554, // a non-default RTSP port proves the config is honoured
    username: 'admin',
    password: 'secret-password',
  });
  hikDeviceId = hik!.id as string;

  const xm = await svc.create({
    name: `QA RTSP XMEye ${RUN}`,
    deviceType: 'NVR',
    brand: 'XMEye',
    ipAddress: `10.98.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    port: 80,
    rtspPort: 554,
    username: 'admin',
    password: 'secret-password',
  });
  xmDeviceId = xm!.id as string;
});

afterAll(async () => {
  svc.resetCctvRtspClientFactory();
  await sql`DELETE FROM cctv_devices WHERE id IN (${hikDeviceId}, ${xmDeviceId})`;
  await sql.end();
});

beforeEach(() => {
  svc.resetCctvRtspClientFactory();
});

describe('cctv RTSP path builder', () => {
  it('builds Hikvision main/sub channel paths', () => {
    expect(buildHikvisionRtspPath(1, 'main')).toBe('/Streaming/channels/101');
    expect(buildHikvisionRtspPath(1, 'sub')).toBe('/Streaming/channels/102');
    expect(buildHikvisionRtspPath(2, 'main')).toBe('/Streaming/channels/201');
    expect(buildHikvisionRtspPath(2, 'sub')).toBe('/Streaming/channels/202');
    // Default is the sub stream.
    expect(buildHikvisionRtspPath(1)).toBe('/Streaming/channels/102');
  });
});

describe('cctv service - test RTSP (Hikvision / ISAPI path)', () => {
  it('defaults to channel 1 sub stream and reports success', async () => {
    const fake = new FakeRtsp();
    svc.setCctvRtspClientFactory(() => fake);

    const result = await svc.testRtspConnection(hikDeviceId);
    expect(result.protocol).toBe('ISAPI');
    expect(result.success).toBe(true);
    expect(result.channel).toBe(1);
    expect(result.stream).toBe('sub');
    expect(result.path).toBe('/Streaming/channels/102');
    expect(fake.paths).toEqual(['/Streaming/channels/102']);
    expect(result.latencyMs).toBe(12);
    expect(result.steps.every((s) => s.ok)).toBe(true);
  });

  it('uses the device RTSP port (not hard-coded 554)', async () => {
    let seenPort: number | undefined;
    svc.setCctvRtspClientFactory((device) => {
      seenPort = device.rtspPort as number;
      return new FakeRtsp();
    });
    const result = await svc.testRtspConnection(hikDeviceId);
    expect(seenPort).toBe(10554);
    expect(result.device.rtspPort).toBe(10554);
  });

  it('can probe an explicit channel and include the main stream', async () => {
    const fake = new FakeRtsp();
    svc.setCctvRtspClientFactory(() => fake);

    const result = await svc.testRtspConnection(hikDeviceId, { channel: 3, includeMain: true });
    expect(fake.paths).toEqual(['/Streaming/channels/301', '/Streaming/channels/302']);
    expect(result.streams.map((s) => s.stream)).toEqual(['main', 'sub']);
    // Primary tested stream remains the sub stream.
    expect(result.stream).toBe('sub');
    expect(result.success).toBe(true);
  });

  it('never returns the password or a credential-bearing URL', async () => {
    svc.setCctvRtspClientFactory(() => new FakeRtsp());
    const result = await svc.testRtspConnection(hikDeviceId);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('secret-password');
    expect(serialized).not.toContain('admin:');
    expect(serialized).not.toContain('rtsp://');
    expect(result.path).toBe('/Streaming/channels/102');
  });

  it('classifies authentication failure', async () => {
    svc.setCctvRtspClientFactory(() => new FakeRtsp('AUTHENTICATION_FAILED'));
    const result = await svc.testRtspConnection(hikDeviceId);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('AUTHENTICATION_FAILED');
    expect(result.errorMessage).toBe('Authentication failed');
  });

  it('classifies unreachable device', async () => {
    svc.setCctvRtspClientFactory(() => new FakeRtsp('DEVICE_UNREACHABLE'));
    const result = await svc.testRtspConnection(hikDeviceId);
    expect(result.errorCode).toBe('DEVICE_UNREACHABLE');
    expect(result.message).toContain('device unreachable');
  });

  it('classifies timeout', async () => {
    svc.setCctvRtspClientFactory(() => new FakeRtsp('CONNECTION_TIMEOUT'));
    const result = await svc.testRtspConnection(hikDeviceId);
    expect(result.errorCode).toBe('CONNECTION_TIMEOUT');
    expect(result.errorMessage).toBe('Connection timeout');
  });

  it('classifies invalid stream/channel', async () => {
    svc.setCctvRtspClientFactory(() => new FakeRtsp('STREAM_UNAVAILABLE'));
    const result = await svc.testRtspConnection(hikDeviceId);
    expect(result.errorCode).toBe('STREAM_UNAVAILABLE');
    expect(result.errorMessage).toBe('Stream unavailable');
  });

  it('throws NOT_FOUND for an unknown device', async () => {
    await expect(
      svc.testRtspConnection('00000000-0000-0000-0000-000000000000'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('cctv service - test RTSP (XMEye / ONVIF stream URI)', () => {
  it('probes the device-provided ONVIF StreamUri, not a Hikvision path', async () => {
    // Fake ONVIF client returns a StreamUri with embedded credentials; the
    // probe must use the URI (credentials stripped) and never a Hikvision path.
    svc.setCctvClientFactory(() => ({
      async getDeviceInformation() {
        return { manufacturer: 'XMEye', model: 'NVR', firmwareVersion: '1', serialNumber: 's', hardwareId: 'h' };
      },
      async getServices() {
        return [{ namespace: 'http://www.onvif.org/ver10/media/wsdl', xAddr: 'http://host/onvif/media_service' }];
      },
      async getVideoSources() {
        return [{ token: 'VS_1', sourceToken: null, name: 'Cam 1', resolution: null }];
      },
      async getProfiles() {
        return [
          {
            token: 'Profile_sub',
            name: 'subStream',
            videoSourceToken: 'VS_1',
            videoSourceName: null,
            encoderToken: null,
            encoding: 'H264',
            resolution: '640x480',
            fps: 15,
          },
        ];
      },
      async getStreamUri() {
        return { uri: 'rtsp://admin:secret@10.0.0.9:554/cam/realmonitor?channel=1&subtype=1' };
      },
    }));

    const fake = new FakeRtsp();
    svc.setCctvRtspClientFactory(() => fake);

    const result = await svc.testRtspConnection(xmDeviceId);
    expect(result.protocol).toBe('ONVIF');
    expect(fake.paths).toEqual([]); // no Hikvision path used
    expect(fake.uris).toHaveLength(1);
    // The resolved URI must not contain the credential.
    expect(fake.uris[0]).not.toContain('admin');
    expect(fake.uris[0]).not.toContain('secret');
    expect(result.success).toBe(true);
    expect(result.path).not.toContain('Streaming/channels');
    // The response never leaks the credential.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('secret-password');
    expect(serialized).not.toContain('admin:');
  });

  it('reports stream unavailable when ONVIF has no resolvable profile', async () => {
    svc.setCctvClientFactory(() => ({
      async getDeviceInformation() {
        return { manufacturer: 'XMEye', model: 'NVR', firmwareVersion: '1', serialNumber: 's', hardwareId: 'h' };
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
    svc.setCctvRtspClientFactory(() => new FakeRtsp());

    const result = await svc.testRtspConnection(xmDeviceId);
    expect(result.success).toBe(false);
    expect(result.protocol).toBe('ONVIF');
  });
});
