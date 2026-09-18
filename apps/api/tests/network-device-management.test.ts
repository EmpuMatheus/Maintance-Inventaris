import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as svc from '@/modules/network-devices/network-device.service';
import * as assetSvc from '@/modules/assets/asset.service';
import type { UpdateInput } from '@/modules/network-devices/network-device.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let siteId: string;
let buildingId: string;
let floorId: string;
let roomId: string;
let catId: string;
let subId: string;
let assetId: string;
let deviceId: string;

function ip(host: number): string {
  return `10.99.${Math.floor(Math.random() * 250)}.${host}`;
}

async function readRaw(id: string) {
  const rows = await sql`SELECT * FROM network_devices WHERE id = ${id}`;
  return rows[0];
}

beforeAll(async () => {
  const site = await sql`INSERT INTO sites (id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${`QA_ND_SITE_${RUN}`}, 'QA ND Site', now(), now()) RETURNING id`;
  siteId = site[0].id as string;
  const building = await sql`INSERT INTO buildings (id, site_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${siteId}, ${`QA_ND_BLD_${RUN}`}, 'QA ND Building', now(), now()) RETURNING id`;
  buildingId = building[0].id as string;
  const floor = await sql`INSERT INTO floors (id, building_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${buildingId}, ${`QA_ND_FLR_${RUN}`}, 'QA ND Floor', now(), now()) RETURNING id`;
  floorId = floor[0].id as string;
  const room = await sql`INSERT INTO rooms (id, floor_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${floorId}, ${`QA_ND_ROOM_${RUN}`}, 'QA ND Room', now(), now()) RETURNING id`;
  roomId = room[0].id as string;

  const admin = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${`QA_ND_CAT_${RUN}`}, 'QA ND Cat', true, now(), now()) RETURNING id`;
  catId = cat[0].id as string;
  const sub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, ${`QA_ND_SUB_${RUN}`}, 'QA ND Sub', true, now(), now()) RETURNING id`;
  subId = sub[0].id as string;
  const asset = await assetSvc.create(
    { assetName: `QA ND Asset ${RUN}`, categoryId: catId, subcategoryId: subId, condition: 'GOOD', status: 'AVAILABLE' },
    admin[0].id as string,
  );
  assetId = asset.id as string;
});

afterAll(async () => {
  await sql`DELETE FROM network_connection_events WHERE network_device_id IN (SELECT id FROM network_devices WHERE room_id = ${roomId})`;
  await sql`DELETE FROM network_devices WHERE room_id = ${roomId}`;
  await sql`DELETE FROM asset_condition_history WHERE asset_id = ${assetId}`;
  await sql`DELETE FROM assets WHERE id = ${assetId}`;
  await sql`DELETE FROM asset_code_counters WHERE category_id = ${catId} AND subcategory_id = ${subId}`;
  await sql`DELETE FROM asset_subcategories WHERE id = ${subId}`;
  await sql`DELETE FROM asset_categories WHERE id = ${catId}`;
  await sql`DELETE FROM rooms WHERE id = ${roomId}`;
  await sql`DELETE FROM floors WHERE id = ${floorId}`;
  await sql`DELETE FROM buildings WHERE id = ${buildingId}`;
  await sql`DELETE FROM sites WHERE id = ${siteId}`;
  await sql.end();
});

describe('Network device management (service)', () => {
  it('creates a device as UNKNOWN and ignores client-supplied monitoring fields', async () => {
    const created = await svc.create({
      name: `PC Management ${RUN}`,
      deviceType: 'COMPUTER',
      ipAddress: ip(1),
      roomId,
      assetId,
      // Extra monitoring fields must never be honoured by the backend.
      status: 'ONLINE',
      consecutiveFailures: 7,
    } as unknown as Parameters<typeof svc.create>[0]);
    deviceId = created.id;

    expect(created.status).toBe('UNKNOWN');
    expect(created.consecutiveFailures).toBe(0);
    expect(created.isActive).toBe(true);

    const raw = await readRaw(deviceId);
    expect(raw.status).toBe('UNKNOWN');
    expect(raw.consecutive_failures).toBe(0);
  });

  it('exposes room site/building/floor on the detail response', async () => {
    const detail = await svc.getById(deviceId);
    expect(detail.room.name).toBe('QA ND Room');
    expect(detail.room.floorName).toBe('QA ND Floor');
    expect(detail.room.buildingName).toBe('QA ND Building');
    expect(detail.room.siteName).toBe('QA ND Site');
  });

  it('searches and filters the list', async () => {
    const bySearch = await svc.list({ search: `Management ${RUN}`, page: 1, limit: 10 });
    expect(bySearch.data.some((d) => d.id === deviceId)).toBe(true);

    const byRoom = await svc.list({ roomId, page: 1, limit: 50 });
    expect(byRoom.data.some((d) => d.id === deviceId)).toBe(true);

    const byType = await svc.list({ deviceType: 'SWITCH', page: 1, limit: 50, roomId });
    expect(byType.data.some((d) => d.id === deviceId)).toBe(false);
  });

  it('edits editable fields without touching monitoring state', async () => {
    // Advance monitoring state directly so we can prove update ignores it.
    await sql`
      UPDATE network_devices
      SET status = 'OFFLINE', consecutive_failures = 3, last_ping_at = now(), offline_started_at = now()
      WHERE id = ${deviceId}
    `;
    const before = await readRaw(deviceId);

    const updated = await svc.update(deviceId, {
      name: `PC Management Edited ${RUN}`,
      hostname: 'pc-mgmt-01',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      // These must be ignored by the service.
      status: 'ONLINE',
      consecutiveFailures: 0,
      lastPingAt: null,
      offlineStartedAt: null,
      isActive: false,
    } as unknown as UpdateInput);

    expect(updated.name).toBe(`PC Management Edited ${RUN}`);
    expect(updated.hostname).toBe('pc-mgmt-01');
    expect(updated.macAddress).toBe('AA:BB:CC:DD:EE:FF');

    const after = await readRaw(deviceId);
    expect(after.status).toBe(before.status);
    expect(after.consecutive_failures).toBe(before.consecutive_failures);
    expect(after.is_active).toBe(true);
    expect(after.last_ping_at).not.toBeNull();
    expect(after.offline_started_at).not.toBeNull();
  });

  it('clears optional hostname, MAC and asset on update', async () => {
    const updated = await svc.update(deviceId, { hostname: null, macAddress: null, assetId: null });
    expect(updated.hostname).toBeNull();
    expect(updated.macAddress).toBeNull();
    expect(updated.assetId).toBeNull();
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
    const first = await svc.create({ name: `QA IP Owner ${RUN}`, deviceType: 'COMPUTER', ipAddress: sharedIp, roomId });
    expect(first.isActive).toBe(true);

    await expect(
      svc.create({ name: `QA IP Dup ${RUN}`, deviceType: 'COMPUTER', ipAddress: sharedIp, roomId }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const inactiveDup = await svc.create({
      name: `QA IP Inactive ${RUN}`,
      deviceType: 'COMPUTER',
      ipAddress: sharedIp,
      roomId,
      isActive: false,
    });
    expect(inactiveDup.isActive).toBe(false);

    // Re-activating it collides with the first active device.
    await expect(svc.setActive(inactiveDup.id, true)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('never changes asset status or condition', async () => {
    const before = await assetSvc.getById(assetId);
    const device = await svc.create({
      name: `QA Asset Link ${RUN}`,
      deviceType: 'SWITCH',
      ipAddress: ip(3),
      roomId,
      assetId,
    });
    await svc.update(device.id, { name: `QA Asset Link Edited ${RUN}` });
    await svc.setActive(device.id, false);
    await svc.setActive(device.id, true);

    const after = await assetSvc.getById(assetId);
    expect(after.status).toBe(before.status);
    expect(after.condition).toBe(before.condition);
    expect(after.status).toBe('AVAILABLE');
    expect(after.condition).toBe('GOOD');
  });
});
