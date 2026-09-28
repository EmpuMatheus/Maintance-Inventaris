import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as svc from '@/modules/cctv/cctv.service';
import type { CctvOnvifClient } from '@/modules/cctv/cctv.service';
import { OnvifError } from '@/lib/onvif/errors';
import { encryptSecret } from '@/lib/crypto/secret-box';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let deviceId: string;

/**
 * A configurable fake ONVIF client. It lets each test simulate a healthy
 * device, an auth failure, or a specific channel/profile layout.
 */
class FakeOnvif implements CctvOnvifClient {
  constructor(
    private opts: {
      info?: Partial<Awaited<ReturnType<CctvOnvifClient['getDeviceInformation']>>>;
      sources?: { token: string; sourceToken: string | null; name: string | null; resolution: string | null }[];
      profiles?: Awaited<ReturnType<CctvOnvifClient['getProfiles']>>;
      fail?: 'AUTHENTICATION_FAILED' | 'DEVICE_UNREACHABLE';
    } = {},
  ) {}

  async getDeviceInformation() {
    if (this.opts.fail) throw new OnvifError(this.opts.fail);
    return {
      manufacturer: 'Hikvision',
      model: 'DS-7216HGHI',
      firmwareVersion: 'V3.4.0',
      serialNumber: 'SN-TEST',
      hardwareId: '88',
      ...this.opts.info,
    };
  }
  async getServices() {
    if (this.opts.fail) throw new OnvifError(this.opts.fail);
    return [{ namespace: 'http://www.onvif.org/ver10/media/wsdl', xAddr: 'http://host/onvif/media_service' }];
  }
  async getVideoSources() {
    return this.opts.sources ?? [];
  }
  async getProfiles() {
    return this.opts.profiles ?? [];
  }
  async getStreamUri(profileToken: string) {
    return { uri: `rtsp://admin:secret@10.0.0.5:554/Streaming/Channels/${profileToken}` };
  }
}

function profile(token: string, name: string, sourceToken: string) {
  return {
    token,
    name,
    videoSourceToken: sourceToken,
    videoSourceName: null,
    encoderToken: null,
    encoding: 'H264',
    resolution: '1920x1080',
    fps: 25,
  };
}

beforeAll(async () => {
  // XMEye -> ONVIF provider. (The fake reports manufacturer "Hikvision"; the
  // persisted ONVIF protocol must remain sticky and not be re-derived.)
  const created = await svc.create({
    name: `QA CCTV Sync ${RUN}`,
    deviceType: 'NVR',
    brand: 'XMEye',
    ipAddress: `10.77.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    port: 80,
    username: 'admin',
    password: 'secret-password',
  });
  deviceId = created!.id as string;
});

afterAll(async () => {
  svc.resetCctvClientFactory();
  await sql`DELETE FROM cctv_devices WHERE id = ${deviceId}`;
  await sql.end();
});

beforeEach(() => {
  svc.resetCctvClientFactory();
});

describe('cctv service - create/read credential safety', () => {
  it('stores an encrypted password, never plaintext', async () => {
    const raw = await sql`SELECT password_encrypted FROM cctv_devices WHERE id = ${deviceId}`;
    expect(raw[0].password_encrypted).toBeTruthy();
    expect(raw[0].password_encrypted).not.toContain('secret-password');
    expect(raw[0].password_encrypted.startsWith('v1:')).toBe(true);
  });

  it('does not return the password through service reads', async () => {
    const device = await svc.getById(deviceId);
    expect(device).not.toHaveProperty('passwordEncrypted');
    expect(JSON.stringify(device)).not.toContain('secret-password');
  });

  it('preserves the stored password when update omits it', async () => {
    const before = await sql`SELECT password_encrypted FROM cctv_devices WHERE id = ${deviceId}`;
    await svc.update(deviceId, { name: `QA CCTV Sync ${RUN} renamed` });
    const after = await sql`SELECT password_encrypted FROM cctv_devices WHERE id = ${deviceId}`;
    expect(after[0].password_encrypted).toBe(before[0].password_encrypted);
  });

  it('re-encrypts when a new password is provided', async () => {
    await svc.update(deviceId, { password: 'new-secret' });
    const raw = await sql`SELECT password_encrypted FROM cctv_devices WHERE id = ${deviceId}`;
    expect(raw[0].password_encrypted).not.toContain('new-secret');
    // restore
    await svc.update(deviceId, { password: 'secret-password' });
  });
});

describe('cctv service - test connection', () => {
  it('reports success and retrieves device information', async () => {
    svc.setCctvClientFactory(() => new FakeOnvif());
    const result = await svc.testConnection(deviceId);
    expect(result.protocol).toBe('ONVIF');
    expect(result.success).toBe(true);
    expect(result.status).toBe('ONLINE');
    expect(result.steps.every((s) => s.ok)).toBe(true);
    expect(result.steps.some((s) => s.label === 'ONVIF available')).toBe(true);
    expect(result.deviceInformation?.manufacturer).toBe('Hikvision');
  });

  it('classifies an authentication failure specifically', async () => {
    svc.setCctvClientFactory(() => new FakeOnvif({ fail: 'AUTHENTICATION_FAILED' }));
    const result = await svc.testConnection(deviceId);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('AUTHENTICATION_FAILED');
    expect(result.errorMessage).toBe('Authentication failed');
    // Reachable + ONVIF available, but not authenticated.
    expect(result.steps.find((s) => s.key === 'reachable')?.ok).toBe(true);
    expect(result.steps.find((s) => s.key === 'auth')?.ok).toBe(false);
  });

  it('classifies an unreachable device specifically', async () => {
    svc.setCctvClientFactory(() => new FakeOnvif({ fail: 'DEVICE_UNREACHABLE' }));
    const result = await svc.testConnection(deviceId);
    expect(result.errorCode).toBe('DEVICE_UNREACHABLE');
    expect(result.errorMessage).toBe('Device unreachable');
    expect(result.steps.find((s) => s.key === 'reachable')?.ok).toBe(false);
  });
});

describe('cctv service - sync channels', () => {
  it('groups media profiles by video source (not profile count = channel count)', async () => {
    // 2 video sources; source 1 has 2 profiles (main+sub), source 2 has 1.
    svc.setCctvClientFactory(
      () =>
        new FakeOnvif({
          sources: [
            { token: 'VideoSource_1', sourceToken: null, name: 'IPC_001', resolution: null },
            { token: 'VideoSource_2', sourceToken: null, name: 'IPC_002', resolution: null },
          ],
          profiles: [
            profile('P1', 'mainStream', 'VideoSource_1'),
            profile('P2', 'subStream', 'VideoSource_1'),
            profile('P3', 'mainStream', 'VideoSource_2'),
          ],
        }),
    );

    const result = await svc.syncChannels(deviceId);
    expect(result.channels.total).toBe(2); // 2 channels, NOT 3 profiles

    const channels = await svc.listChannels({ deviceId, limit: 100 });
    expect(channels.data).toHaveLength(2);

    const ch1 = channels.data.find((c) => c.channelNumber === 1)!;
    const ch2 = channels.data.find((c) => c.channelNumber === 2)!;
    expect(ch1.technicalName).toBe('IPC_001');
    expect(ch1.name).toBe('Belum diatur'); // no fabricated name
    expect(ch1.streamProfiles).toHaveLength(2); // main + sub
    expect(ch2.streamProfiles).toHaveLength(1);
  });

  it('never overwrites user name/location on re-sync', async () => {
    const channels = await svc.listChannels({ deviceId, limit: 100 });
    const ch1 = channels.data.find((c) => c.channelNumber === 1)!;

    await svc.updateChannel(ch1.id, { name: 'Kamera Lobby', location: 'Lobby' });

    // Re-run sync with the same device data.
    svc.setCctvClientFactory(
      () =>
        new FakeOnvif({
          sources: [
            { token: 'VideoSource_1', sourceToken: null, name: 'IPC_001', resolution: null },
            { token: 'VideoSource_2', sourceToken: null, name: 'IPC_002', resolution: null },
          ],
          profiles: [
            profile('P1', 'mainStream', 'VideoSource_1'),
            profile('P2', 'subStream', 'VideoSource_1'),
            profile('P3', 'mainStream', 'VideoSource_2'),
          ],
        }),
    );
    await svc.syncChannels(deviceId);

    const after = await svc.getChannelById(ch1.id);
    expect(after.name).toBe('Kamera Lobby');
    expect(after.location).toBe('Lobby');
  });

  it('strips credential-bearing credentials from stored stream URIs', async () => {
    const channels = await svc.listChannels({ deviceId, limit: 100 });
    const ch1 = channels.data.find((c) => c.channelNumber === 1)!;
    for (const p of ch1.streamProfiles) {
      expect(p.streamUri ?? '').not.toContain('admin');
      expect(p.streamUri ?? '').not.toContain('secret');
    }
  });

  it('marks disappeared channels MISSING and keeps user data', async () => {
    // Device now reports only source 2.
    svc.setCctvClientFactory(
      () =>
        new FakeOnvif({
          sources: [{ token: 'VideoSource_2', sourceToken: null, name: 'IPC_002', resolution: null }],
          profiles: [profile('P3', 'mainStream', 'VideoSource_2')],
        }),
    );
    const result = await svc.syncChannels(deviceId);
    expect(result.channels.missing).toBeGreaterThanOrEqual(1);

    const channels = await svc.listChannels({ deviceId, limit: 100 });
    const ch1 = channels.data.find((c) => c.channelNumber === 1)!;
    expect(ch1.status).toBe('MISSING');
    expect(ch1.name).toBe('Kamera Lobby'); // user data preserved even when missing
  });
});
