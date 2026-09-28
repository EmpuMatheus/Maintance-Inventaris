import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as svc from '@/modules/cctv/cctv.service';
import { IsapiError } from '@/lib/isapi/errors';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let deviceId: string;

/**
 * Fake ISAPI client. `streams` is what the device reports; `fail` simulates an
 * auth/unreachable failure. Implements only the methods the provider uses.
 */
class FakeIsapi {
  constructor(
    private opts: {
      info?: {
        manufacturer?: string | null;
        model?: string | null;
        firmwareVersion?: string | null;
        serialNumber?: string | null;
        hardwareId?: string | null;
        deviceName?: string | null;
      };
      channels?: { id: string; channelName: string | null; rtspPort: number | null; enabled: boolean | null }[];
      fail?: 'AUTHENTICATION_FAILED' | 'DEVICE_UNREACHABLE' | 'ISAPI_UNAVAILABLE';
    } = {},
  ) {}

  async getDeviceInformation() {
    if (this.opts.fail) throw new IsapiError(this.opts.fail);
    return {
      manufacturer: 'Hikvision',
      model: 'DS-7216HGHI-K1',
      firmwareVersion: 'V4.30.000',
      serialNumber: 'SN-HIK',
      hardwareId: 'SN-HIK',
      deviceName: 'DVR-LOBBY',
      ...this.opts.info,
    };
  }
  async getStreamingChannels() {
    if (this.opts.fail) throw new IsapiError(this.opts.fail);
    return this.opts.channels ?? [];
  }
}

beforeAll(async () => {
  const created = await svc.create({
    name: `QA Hikvision Sync ${RUN}`,
    deviceType: 'DVR',
    brand: 'Hikvision',
    model: 'DS-7216HGHI-K1',
    ipAddress: `10.55.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    port: 80,
    rtspPort: 554,
    username: 'admin',
    password: 'secret-password',
  });
  deviceId = created!.id as string;
});

afterAll(async () => {
  svc.resetCctvIsapiClientFactory();
  await sql`DELETE FROM cctv_devices WHERE id = ${deviceId}`;
  await sql.end();
});

beforeEach(() => {
  svc.resetCctvIsapiClientFactory();
});

describe('cctv service - Hikvision protocol detection', () => {
  it('persists ISAPI as the derived integration protocol', async () => {
    const device = await svc.getById(deviceId);
    expect(device.integrationProtocol).toBe('ISAPI');
  });
});

describe('cctv service - Hikvision test connection (ISAPI)', () => {
  it('reports success via ISAPI and retrieves device information', async () => {
    svc.setCctvIsapiClientFactory(() => new FakeIsapi());
    const result = await svc.testConnection(deviceId);
    expect(result.protocol).toBe('ISAPI');
    expect(result.success).toBe(true);
    expect(result.status).toBe('ONLINE');
    expect(result.deviceInformation?.manufacturer).toBe('Hikvision');
    expect(result.steps.every((s) => s.ok)).toBe(true);
    // The protocol step is labelled with the actual protocol, not ONVIF.
    expect(result.steps.some((s) => s.label === 'ISAPI available')).toBe(true);
    expect(result.steps.some((s) => s.label === 'ONVIF available')).toBe(false);
  });

  it('classifies an ISAPI authentication failure', async () => {
    svc.setCctvIsapiClientFactory(() => new FakeIsapi({ fail: 'AUTHENTICATION_FAILED' }));
    const result = await svc.testConnection(deviceId);
    expect(result.success).toBe(false);
    expect(result.protocol).toBe('ISAPI');
    expect(result.errorCode).toBe('AUTHENTICATION_FAILED');
    expect(result.errorMessage).toBe('Authentication failed');
    expect(result.steps.find((s) => s.key === 'reachable')?.ok).toBe(true);
    expect(result.steps.find((s) => s.key === 'protocol')?.ok).toBe(true);
    expect(result.steps.find((s) => s.key === 'auth')?.ok).toBe(false);
  });

  it('classifies an unreachable device', async () => {
    svc.setCctvIsapiClientFactory(() => new FakeIsapi({ fail: 'DEVICE_UNREACHABLE' }));
    const result = await svc.testConnection(deviceId);
    expect(result.errorCode).toBe('DEVICE_UNREACHABLE');
    expect(result.steps.find((s) => s.key === 'reachable')?.ok).toBe(false);
  });

  it('classifies ISAPI unavailable distinctly', async () => {
    svc.setCctvIsapiClientFactory(() => new FakeIsapi({ fail: 'ISAPI_UNAVAILABLE' }));
    const result = await svc.testConnection(deviceId);
    expect(result.errorCode).toBe('ISAPI_UNAVAILABLE');
    expect(result.errorMessage).toBe('ISAPI unavailable');
    expect(result.steps.find((s) => s.key === 'protocol')?.ok).toBe(false);
  });
});

describe('cctv service - Hikvision sync channels (ISAPI)', () => {
  it('discovers channels from ISAPI and never hard-codes 1..16', async () => {
    // The device reports only channels 1 and 3 (sparse). No channels are
    // fabricated for the gaps.
    svc.setCctvIsapiClientFactory(
      () =>
        new FakeIsapi({
          channels: [
            { id: '101', channelName: 'Cam 1', rtspPort: 554, enabled: true },
            { id: '102', channelName: 'Cam 1', rtspPort: 554, enabled: true },
            { id: '301', channelName: 'Cam 3', rtspPort: 554, enabled: true },
          ],
        }),
    );

    const result = await svc.syncChannels(deviceId);
    expect(result.channels.total).toBe(2); // channels 1 and 3, not 16

    const channels = await svc.listChannels({ deviceId, limit: 100 });
    expect(channels.data.map((c) => c.channelNumber).sort((a, b) => a - b)).toEqual([1, 3]);
    const ch1 = channels.data.find((c) => c.channelNumber === 1)!;
    expect(ch1.technicalName).toBe('Cam 1');
    expect(ch1.streamProfiles.map((p) => p.streamType).sort()).toEqual(['MAIN', 'SUB']);
  });

  it('preserves user name/location across ISAPI re-sync', async () => {
    const channels = await svc.listChannels({ deviceId, limit: 100 });
    const ch1 = channels.data.find((c) => c.channelNumber === 1)!;
    await svc.updateChannel(ch1.id, { name: 'Kamera Lobby', location: 'Lobby' });

    svc.setCctvIsapiClientFactory(
      () =>
        new FakeIsapi({
          channels: [
            { id: '101', channelName: 'Cam 1', rtspPort: 554, enabled: true },
            { id: '102', channelName: 'Cam 1', rtspPort: 554, enabled: true },
          ],
        }),
    );
    await svc.syncChannels(deviceId);

    const after = await svc.getChannelById(ch1.id);
    expect(after.name).toBe('Kamera Lobby');
    expect(after.location).toBe('Lobby');
  });

  it('marks disappeared channels MISSING and keeps user data', async () => {
    // Device now reports only channel 3.
    svc.setCctvIsapiClientFactory(
      () =>
        new FakeIsapi({
          channels: [{ id: '301', channelName: 'Cam 3', rtspPort: 554, enabled: true }],
        }),
    );
    const result = await svc.syncChannels(deviceId);
    expect(result.channels.missing).toBeGreaterThanOrEqual(1);

    const channels = await svc.listChannels({ deviceId, limit: 100 });
    const ch1 = channels.data.find((c) => c.channelNumber === 1)!;
    expect(ch1.status).toBe('MISSING');
    expect(ch1.name).toBe('Kamera Lobby');
  });

  it('never returns the password through service reads', async () => {
    const device = await svc.getById(deviceId);
    expect(JSON.stringify(device)).not.toContain('secret-password');
    expect(device).not.toHaveProperty('passwordEncrypted');
  });
});
