import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import {
  resolveSubcategoryProtocol,
  resolveIntegrationProtocol,
  resolveDeviceProtocol,
} from '@/modules/cctv/integration/protocol';
import * as svc from '@/modules/cctv/cctv.service';
import * as repo from '@/modules/cctv/cctv.repository';

/**
 * Subcategory-driven CCTV behaviour:
 *   CCTV / NVR -> ONVIF
 *   DVR        -> ISAPI
 * plus the channel Stream URI edit and the all-channel Monitor query.
 */

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let categoryId: string;
let cctvSubId: string;
let dvrSubId: string;
let nvrSubId: string;
let deviceId: string;
let channelId: string;

beforeAll(async () => {
  const cat = await sql`
    INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${`QA_CCTV_CAT_${RUN}`}, 'QA CCTV Cat', true, now(), now())
    RETURNING id`;
  categoryId = cat[0].id as string;

  const cctv = await sql`
    INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${categoryId}, ${`QA_CCTV_${RUN}`}, 'CCTV', true, now(), now())
    RETURNING id`;
  cctvSubId = cctv[0].id as string;

  const dvr = await sql`
    INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${categoryId}, ${`QA_DVR_${RUN}`}, 'DVR', true, now(), now())
    RETURNING id`;
  dvrSubId = dvr[0].id as string;

  const nvr = await sql`
    INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${categoryId}, ${`QA_NVR_${RUN}`}, 'NVR', true, now(), now())
    RETURNING id`;
  nvrSubId = nvr[0].id as string;

  // A generic-brand device: behaviour must come from the subcategory, not brand.
  const device = await svc.create({
    name: `QA CCTV Subcat ${RUN}`,
    deviceType: 'RECORDER',
    subcategoryId: dvrSubId,
    brand: null,
    ipAddress: `10.44.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    port: 80,
    rtspPort: 554,
    username: 'admin',
    password: 'secret',
  });
  deviceId = device!.id as string;

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
  await sql`DELETE FROM asset_subcategories WHERE category_id = ${categoryId}`;
  await sql`DELETE FROM asset_categories WHERE id = ${categoryId}`;
  await sql.end();
});

describe('subcategory -> protocol mapping', () => {
  it('maps CCTV and NVR to ONVIF and DVR to ISAPI', () => {
    expect(resolveSubcategoryProtocol('CCTV')).toBe('ONVIF');
    expect(resolveSubcategoryProtocol('NVR')).toBe('ONVIF');
    expect(resolveSubcategoryProtocol('DVR')).toBe('ISAPI');
    expect(resolveSubcategoryProtocol('dvr-16ch')).toBe('ISAPI');
    expect(resolveSubcategoryProtocol('Laptop')).toBeNull();
  });

  it('subcategory wins over brand heuristics', () => {
    // A Hikvision-branded camera configured as CCTV must still use ONVIF.
    expect(
      resolveIntegrationProtocol({ subcategoryName: 'CCTV', brand: 'Hikvision' }),
    ).toBe('ONVIF');
    expect(
      resolveIntegrationProtocol({ subcategoryName: 'DVR', brand: 'XMEye' }),
    ).toBe('ISAPI');
  });

  it('falls back to vendor derivation for legacy rows without a subcategory', () => {
    expect(resolveIntegrationProtocol({ brand: 'Hikvision' })).toBe('ISAPI');
    expect(resolveDeviceProtocol({ brand: 'XMEye' })).toBe('ONVIF');
  });
});

describe('cctv service - subcategory drives derived protocol', () => {
  it('persists ISAPI for a DVR subcategory regardless of brand', async () => {
    const device = await svc.getById(deviceId);
    expect(device.subcategoryName).toBe('DVR');
    expect(device.integrationProtocol).toBe('ISAPI');
  });

  it('re-derives the protocol when the subcategory changes to CCTV', async () => {
    await svc.update(deviceId, { subcategoryId: cctvSubId });
    const device = await svc.getById(deviceId);
    expect(device.subcategoryName).toBe('CCTV');
    expect(device.integrationProtocol).toBe('ONVIF');
    // Restore.
    await svc.update(deviceId, { subcategoryId: nvrSubId });
    expect((await svc.getById(deviceId)).integrationProtocol).toBe('ONVIF');
    await svc.update(deviceId, { subcategoryId: dvrSubId });
  });

  it('rejects an unknown subcategory', async () => {
    await expect(
      svc.update(deviceId, { subcategoryId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('cctv service - channel Stream URI edit', () => {
  it('updates the stored stream URI of the selected profile and strips credentials', async () => {
    await repo.upsertStreamProfiles(channelId, [
      {
        profileToken: 'P_sub',
        profileName: 'subStream',
        streamType: 'SUB',
        streamUri: 'rtsp://10.0.0.9:554/original',
        videoCodec: 'H264',
        resolution: '640x480',
        fps: 15,
        isMainStream: false,
      },
    ]);
    const profiles = await repo.findStreamProfilesByChannelIds([channelId]);
    const profile = profiles[0];

    const updated = await svc.updateChannel(channelId, {
      streamProfileId: profile.id as string,
      streamUri: 'rtsp://admin:pass@10.0.0.9:554/corrected',
    });
    const after = updated.streamProfiles.find((p) => p.id === profile.id);
    expect(after?.streamUri).toBe('rtsp://10.0.0.9:554/corrected');
    expect(JSON.stringify(after)).not.toContain('pass');
  });

  it('rejects a stream profile that belongs to another channel', async () => {
    await expect(
      svc.updateChannel(channelId, {
        streamProfileId: '00000000-0000-0000-0000-000000000000',
        streamUri: 'rtsp://10.0.0.9:554/x',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('cctv service - monitor channels across devices', () => {
  it('lists active, non-missing channels with a device summary', async () => {
    const result = await svc.listMonitorChannels();
    const row = result.data.find((c) => c.id === channelId);
    expect(row).toBeTruthy();
    expect(row!.device.id).toBe(deviceId);
    expect(row!.device.name).toBe(`QA CCTV Subcat ${RUN}`);
    expect(row!.channelNumber).toBe(1);
  });

  it('excludes channels marked MISSING', async () => {
    await repo.markChannelsMissing(deviceId, [], new Date());
    const result = await svc.listMonitorChannels();
    expect(result.data.find((c) => c.id === channelId)).toBeFalsy();
    // Restore.
    await repo.upsertChannelTechnical(deviceId, 1, {
      deviceChannelId: '1',
      technicalName: 'Cam 1',
      cameraIp: null,
      status: 'ONLINE',
      lastSyncAt: new Date(),
    });
  });
});
