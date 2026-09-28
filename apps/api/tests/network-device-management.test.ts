import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as svc from '@/modules/network-devices/network-device.service';
import * as assetSvc from '@/modules/assets/asset.service';
import * as assetRepo from '@/modules/assets/asset.repository';
import type { UpdateInput } from '@/modules/network-devices/network-device.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let adminId: string;
let adminName: string;
let siteId: string;
let buildingId: string;
let floorId: string;
let roomId: string;
let otherRoomId: string;
let catId: string;
let netSubId: string;
let nonNetSubId: string;
let switchSubId: string;
let assetId: string; // network-device asset, PIC Fadhil, room
let otherAssetId: string; // second eligible asset
let nonNetAssetId: string; // subcategory not network device
let switchAssetId: string; // subcategory "Switch"
let switchAssetId2: string; // spare Switch asset, used for the change-asset test
let deviceId: string;

function ip(host: number): string {
  return `10.99.${Math.floor(Math.random() * 250)}.${host}`;
}

async function readRaw(id: string) {
  const rows = await sql`SELECT * FROM network_devices WHERE id = ${id}`;
  return rows[0];
}

async function createAsset(name: string, subId: string, room: string, picId?: string): Promise<string> {
  const asset = await assetSvc.create(
    {
      assetName: name,
      categoryId: catId,
      subcategoryId: subId,
      roomId: room,
      condition: 'GOOD',
      status: 'AVAILABLE',
      serialNumber: `${name}-${RUN}-${Math.random()}`,
      currentPicId: picId,
    },
    adminId,
  );
  return asset.id as string;
}

beforeAll(async () => {
  const admin = await sql`SELECT id, name FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = admin[0].id as string;
  adminName = admin[0].name as string;

  const site = await sql`INSERT INTO sites (id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${`QA_ND_SITE_${RUN}`}, 'QA ND Site', now(), now()) RETURNING id`;
  siteId = site[0].id as string;
  const building = await sql`INSERT INTO buildings (id, site_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${siteId}, ${`QA_ND_BLD_${RUN}`}, 'QA ND Building', now(), now()) RETURNING id`;
  buildingId = building[0].id as string;
  const floor = await sql`INSERT INTO floors (id, building_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${buildingId}, ${`QA_ND_FLR_${RUN}`}, 'QA ND Floor', now(), now()) RETURNING id`;
  floorId = floor[0].id as string;
  const room = await sql`INSERT INTO rooms (id, floor_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${floorId}, ${`QA_ND_ROOM_${RUN}`}, 'QA ND Room', now(), now()) RETURNING id`;
  roomId = room[0].id as string;
  const otherRoom = await sql`INSERT INTO rooms (id, floor_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${floorId}, ${`QA_ND_ROOM2_${RUN}`}, 'QA ND Room 2', now(), now()) RETURNING id`;
  otherRoomId = otherRoom[0].id as string;

  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${`QA_ND_CAT_${RUN}`}, 'QA ND Cat', true, now(), now()) RETURNING id`;
  catId = cat[0].id as string;
  const netSub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_network_device, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, ${`QA_ND_NET_${RUN}`}, 'Laptop', true, true, now(), now()) RETURNING id`;
  netSubId = netSub[0].id as string;
  const swSub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_network_device, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, ${`SW_${RUN}`}, 'Switch', true, true, now(), now()) RETURNING id`;
  switchSubId = swSub[0].id as string;
  const nonNetSub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_network_device, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, ${`QA_ND_NON_${RUN}`}, 'Monitor', false, true, now(), now()) RETURNING id`;
  nonNetSubId = nonNetSub[0].id as string;

  assetId = await createAsset(`QA ND Asset ${RUN}`, netSubId, roomId, adminId);
  otherAssetId = await createAsset(`QA ND Asset 2 ${RUN}`, netSubId, otherRoomId, adminId);
  nonNetAssetId = await createAsset(`QA ND NonNet ${RUN}`, nonNetSubId, roomId, adminId);
  switchAssetId = await createAsset(`QA ND Switch ${RUN}`, switchSubId, otherRoomId, adminId);
  switchAssetId2 = await createAsset(`QA ND Switch 2 ${RUN}`, switchSubId, otherRoomId, adminId);
});

afterAll(async () => {
  // Devices must be removed before assets/rooms (asset FK is ON DELETE SET NULL).
  await sql`DELETE FROM network_connection_events WHERE network_device_id IN (SELECT id FROM network_devices WHERE room_id IN (${roomId}, ${otherRoomId}) OR asset_id IN (${assetId}, ${otherAssetId}, ${nonNetAssetId}, ${switchAssetId}, ${switchAssetId2}))`;
  await sql`DELETE FROM network_devices WHERE room_id IN (${roomId}, ${otherRoomId}) OR asset_id IN (${assetId}, ${otherAssetId}, ${nonNetAssetId}, ${switchAssetId}, ${switchAssetId2})`;
  for (const asset of [assetId, otherAssetId, nonNetAssetId, switchAssetId, switchAssetId2]) {
    if (!asset) continue;
    await sql`DELETE FROM asset_condition_history WHERE asset_id = ${asset}`;
    await sql`DELETE FROM assets WHERE id = ${asset}`;
  }
  await sql`DELETE FROM asset_code_counters WHERE subcategory_id IN (${netSubId}, ${switchSubId}, ${nonNetSubId})`;
  await sql`DELETE FROM asset_subcategories WHERE id IN (${netSubId}, ${switchSubId}, ${nonNetSubId})`;
  await sql`DELETE FROM asset_categories WHERE id = ${catId}`;
  await sql`DELETE FROM rooms WHERE id IN (${roomId}, ${otherRoomId})`;
  await sql`DELETE FROM floors WHERE id = ${floorId}`;
  await sql`DELETE FROM buildings WHERE id = ${buildingId}`;
  await sql`DELETE FROM sites WHERE id = ${siteId}`;
  await sql.end();
});

describe('Network device management (service)', () => {
  it('derives deviceType, hostname and room from the selected asset', async () => {
    const created = await svc.create({
      ipAddress: ip(1),
      assetId,
    });
    deviceId = created.id;

    expect(created.status).toBe('UNKNOWN');
    expect(created.consecutiveFailures).toBe(0);
    expect(created.isActive).toBe(true);
    expect(created.assetId).toBe(assetId);
    // Device type is the asset subcategory name ("Laptop").
    expect(created.deviceType).toBe('Laptop');
    // hostname/room derived from asset PIC + asset room.
    expect(created.hostname).toBe(adminName);
    expect(created.roomId).toBe(roomId);

    const raw = await readRaw(deviceId);
    expect(raw.status).toBe('UNKNOWN');
    expect(raw.consecutive_failures).toBe(0);
  });

  it('derives the device type from the asset subcategory name', async () => {
    const created = await svc.create({ ipAddress: ip(11), assetId: switchAssetId });
    expect(created.deviceType).toBe('Switch');
    expect(created.roomId).toBe(otherRoomId);
  });

  it('rejects an asset whose subcategory is not a network device', async () => {
    await expect(svc.create({ ipAddress: ip(12), assetId: nonNetAssetId })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rejects an asset that is already used by another network device', async () => {
    await expect(svc.create({ ipAddress: ip(13), assetId })).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects a create without a valid asset', async () => {
    await expect(
      svc.create({ ipAddress: ip(14), assetId: '00000000-0000-0000-0000-000000000000' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('exposes room site/building/floor on the detail response', async () => {
    const detail = await svc.getById(deviceId);
    expect(detail.room.name).toBe('QA ND Room');
    expect(detail.room.floorName).toBe('QA ND Floor');
    expect(detail.room.buildingName).toBe('QA ND Building');
    expect(detail.room.siteName).toBe('QA ND Site');
  });

  it('previews derived values for an eligible asset and excludes the current device', async () => {
    const preview = await svc.getAssetPreview(assetId, deviceId);
    expect(preview.assetId).toBe(assetId);
    expect(preview.deviceType).toBe('Laptop');
    expect(preview.roomId).toBe(roomId);
    // Without excluding its own device the asset is considered already used.
    await expect(svc.getAssetPreview(assetId)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('searches and filters the list', async () => {
    const byRoom = await svc.list({ roomId, page: 1, limit: 50 });
    expect(byRoom.data.some((d) => d.id === deviceId)).toBe(true);

    const byType = await svc.list({ deviceType: 'Switch', page: 1, limit: 50, roomId });
    expect(byType.data.some((d) => d.id === deviceId)).toBe(false);
  });

  it('updates editable fields without touching monitoring state', async () => {
    await sql`
      UPDATE network_devices
      SET status = 'OFFLINE', consecutive_failures = 3, last_ping_at = now(), offline_started_at = now()
      WHERE id = ${deviceId}
    `;
    const before = await readRaw(deviceId);

    const updated = await svc.update(deviceId, {
      name: `PC Management Edited ${RUN}`,
      macAddress: 'AA:BB:CC:DD:EE:FF',
      // These must be ignored by the service.
      status: 'ONLINE',
      consecutiveFailures: 0,
      lastPingAt: null,
      offlineStartedAt: null,
      isActive: false,
    } as unknown as UpdateInput);

    expect(updated.name).toBe(`PC Management Edited ${RUN}`);
    expect(updated.macAddress).toBe('AA:BB:CC:DD:EE:FF');

    const after = await readRaw(deviceId);
    expect(after.status).toBe(before.status);
    expect(after.consecutive_failures).toBe(before.consecutive_failures);
    expect(after.is_active).toBe(true);
    expect(after.last_ping_at).not.toBeNull();
    expect(after.offline_started_at).not.toBeNull();
    expect(after.device_type).toBe('Laptop');
  });

  it('recomputes derived fields when the asset changes on update', async () => {
    // Move the device to the spare switch asset.
    const updated = await svc.update(deviceId, { assetId: switchAssetId2 });
    expect(updated.assetId).toBe(switchAssetId2);
    expect(updated.deviceType).toBe('Switch');
    expect(updated.roomId).toBe(otherRoomId);

    const raw = await readRaw(deviceId);
    expect(raw.device_type).toBe('Switch');
    expect(raw.room_id).toBe(otherRoomId);

    // Move it back for later assertions.
    await svc.update(deviceId, { assetId });
  });

  it('keeps derived fields when the asset is unchanged on update', async () => {
    const updated = await svc.update(deviceId, { name: `PC Management Same Asset ${RUN}`, assetId });
    expect(updated.assetId).toBe(assetId);
    expect(updated.deviceType).toBe('Laptop');
    expect(updated.roomId).toBe(roomId);
  });

  it('activates and deactivates a device', async () => {
    const inactive = await svc.setActive(deviceId, false);
    expect(inactive.isActive).toBe(false);
    expect((await readRaw(deviceId)).is_active).toBe(false);

    const active = await svc.setActive(deviceId, true);
    expect(active.isActive).toBe(true);
    expect((await readRaw(deviceId)).is_active).toBe(true);
  });

  it('rejects a second active device using the same IP, but allows an inactive one', async () => {
    const sharedIp = ip(2);
    const firstAsset = await createAsset(`QA ND IP Asset A ${RUN}`, netSubId, roomId);
    const secondAsset = await createAsset(`QA ND IP Asset B ${RUN}`, netSubId, roomId);
    const first = await svc.create({ ipAddress: sharedIp, assetId: firstAsset });
    expect(first.isActive).toBe(true);

    await expect(svc.create({ ipAddress: sharedIp, assetId: secondAsset })).rejects.toMatchObject({
      statusCode: 409,
    });

    const thirdAsset = await createAsset(`QA ND IP Asset C ${RUN}`, netSubId, roomId);
    const inactiveDup = await svc.create({
      ipAddress: sharedIp,
      assetId: thirdAsset,
      isActive: false,
    });
    expect(inactiveDup.isActive).toBe(false);

    // Re-activating it collides with the first active device.
    await expect(svc.setActive(inactiveDup.id, true)).rejects.toMatchObject({ statusCode: 409 });

    await sql`DELETE FROM asset_condition_history WHERE asset_id IN (${firstAsset}, ${secondAsset}, ${thirdAsset})`;
    await sql`DELETE FROM asset_code_counters WHERE subcategory_id = ${netSubId}`;
    await sql`DELETE FROM network_devices WHERE asset_id IN (${firstAsset}, ${secondAsset}, ${thirdAsset})`;
    await sql`DELETE FROM assets WHERE id IN (${firstAsset}, ${secondAsset}, ${thirdAsset})`;
  });

  it('never changes asset status or condition', async () => {
    const before = await assetSvc.getById(assetId);
    await svc.update(deviceId, { name: `QA Asset Link Edited ${RUN}` });
    await svc.setActive(deviceId, false);
    await svc.setActive(deviceId, true);

    const after = await assetSvc.getById(assetId);
    expect(after.status).toBe(before.status);
    expect(after.condition).toBe(before.condition);
    expect(after.status).toBe('AVAILABLE');
    expect(after.condition).toBe('GOOD');
  });

  it('only returns eligible assets from the asset list filter', async () => {
    const eligible = await assetRepo.findAssets({ networkDeviceEligible: true, limit: 100 });
    const ids = eligible.data.map((a) => a.id);
    expect(ids).toContain(otherAssetId);
    expect(ids).not.toContain(nonNetAssetId);
    expect(ids).not.toContain(assetId); // linked to deviceId
    expect(ids).not.toContain(switchAssetId); // linked to the switch device
  });
});
