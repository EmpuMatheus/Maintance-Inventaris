import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as repo from '@/modules/cctv/cctv.repository';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let deviceId: string;

beforeAll(async () => {
  const created = await repo.create({
    name: `QA CCTV ${RUN}`,
    deviceType: 'DVR',
    ipAddress: `10.88.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    port: 8080,
    username: 'admin',
    passwordEncrypted: 'v1:iv:tag:cipher',
    location: 'Ruang QA',
    isActive: true,
    status: 'UNKNOWN',
  });
  deviceId = created!.id as string;
});

afterAll(async () => {
  await sql`DELETE FROM cctv_devices WHERE id = ${deviceId}`;
  await sql.end();
});

describe('cctv repository - credential safety', () => {
  it('never returns passwordEncrypted from findById', async () => {
    const device = await repo.findById(deviceId);
    expect(device).toBeTruthy();
    expect(device).not.toHaveProperty('passwordEncrypted');
    expect(JSON.stringify(device)).not.toContain('cipher');
  });

  it('exposes passwordEncrypted only via findRawById (internal)', async () => {
    const raw = await repo.findRawById(deviceId);
    expect(raw).toBeTruthy();
    expect(raw!.passwordEncrypted).toBe('v1:iv:tag:cipher');
  });
});

describe('cctv repository - channel sync preserves operational data', () => {
  it('upserts technical fields while keeping user name/location', async () => {
    // First sync creates the channel with a technical name.
    const first = await repo.upsertChannelTechnical(deviceId, 1, {
      deviceChannelId: 'VideoSource_1',
      technicalName: 'IPC_001',
      cameraIp: null,
      status: 'ONLINE',
      lastSyncAt: new Date(),
    });
    const channelId = first!.id as string;

    // User sets operational data through the BBP UI.
    await repo.updateChannelOperational(channelId, {
      name: 'Kamera Lobby',
      location: 'Lobby',
      displayOrder: 3,
      isActive: true,
    });

    // Second sync only carries technical data and must not touch the user data.
    await repo.upsertChannelTechnical(deviceId, 1, {
      deviceChannelId: 'VideoSource_1',
      technicalName: 'IPC_001_RENAMED',
      cameraIp: null,
      status: 'ONLINE',
      lastSyncAt: new Date(),
    });

    const channel = await repo.findChannelById(channelId);
    expect(channel).toBeTruthy();
    expect(channel!.technicalName).toBe('IPC_001_RENAMED'); // technical updated
    expect(channel!.name).toBe('Kamera Lobby'); // user data preserved
    expect(channel!.location).toBe('Lobby'); // user data preserved
    expect(channel!.displayOrder).toBe(3);
  });

  it('marks channels not returned by sync as MISSING (never deletes)', async () => {
    await repo.upsertChannelTechnical(deviceId, 2, {
      deviceChannelId: 'VideoSource_2',
      technicalName: 'IPC_002',
      cameraIp: null,
      status: 'ONLINE',
      lastSyncAt: new Date(),
    });

    // Sync reports only channel 1 as present (identified by its channel id).
    const ch1Before = await repo.findChannelByNumber(deviceId, 1);
    await repo.markChannelsMissing(deviceId, [ch1Before!.id as string], new Date());

    const channels = await repo.findChannelsByDevice(deviceId);
    const ch2 = channels.find((c) => c.channelNumber === 2);
    expect(ch2).toBeTruthy(); // not deleted
    expect(ch2!.status).toBe('MISSING');

    const ch1 = channels.find((c) => c.channelNumber === 1);
    expect(ch1!.status).toBe('ONLINE'); // untouched
  });

  it('creates channels with the default "Belum diatur" name (no fabricated data)', async () => {
    await repo.upsertChannelTechnical(deviceId, 3, {
      deviceChannelId: null,
      technicalName: null,
      cameraIp: null,
      status: 'UNKNOWN',
      lastSyncAt: new Date(),
    });
    const channel = await repo.findChannelByNumber(deviceId, 3);
    expect(channel!.name).toBe('Belum diatur');
    expect(channel!.technicalName).toBeNull();
  });
});

describe('cctv repository - stream profiles', () => {
  it('keeps multiple profiles for a single channel and removes stale ones', async () => {
    const channel = await repo.findChannelByNumber(deviceId, 1);
    const channelId = channel!.id as string;

    await repo.upsertStreamProfiles(channelId, [
      {
        profileToken: 'Profile_1',
        profileName: 'mainStream',
        streamType: 'MAIN',
        streamUri: 'rtsp://10.0.0.5:554/main',
        videoCodec: 'H264',
        resolution: '1920x1080',
        fps: 25,
        isMainStream: true,
      },
      {
        profileToken: 'Profile_2',
        profileName: 'subStream',
        streamType: 'SUB',
        streamUri: 'rtsp://10.0.0.5:554/sub',
        videoCodec: 'H264',
        resolution: '640x480',
        fps: 25,
        isMainStream: false,
      },
    ]);

    let profiles = await repo.findStreamProfilesByChannelIds([channelId]);
    expect(profiles).toHaveLength(2);

    // A later sync drops the sub stream.
    await repo.deleteStreamProfilesNotIn(channelId, ['Profile_1']);
    profiles = await repo.findStreamProfilesByChannelIds([channelId]);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].profileToken).toBe('Profile_1');
  });
});

describe('cctv repository - endpoint uniqueness', () => {
  it('finds an active device by endpoint and excludes itself', async () => {
    const raw = await repo.findRawById(deviceId);
    const dup = await repo.findActiveByEndpoint(raw!.ipAddress as string, raw!.port as number);
    expect(dup).toBeTruthy();
    const self = await repo.findActiveByEndpoint(raw!.ipAddress as string, raw!.port as number, deviceId);
    expect(self).toBeNull();
  });
});
