import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as svc from '@/modules/network-monitoring/monitoring.service';
import { evaluateTransition } from '@/modules/network-monitoring/monitoring.state-machine';
import { IcmpProviderError } from '@/modules/network-monitoring/icmp/binary-ping-provider';
import type { ICMPProvider, PingResult } from '@/modules/network-monitoring/icmp/ping-provider';
import type { DeviceMonitorSnapshot, MonitoringResult } from '@/modules/network-monitoring/monitoring.types';
import * as assetSvc from '@/modules/assets/asset.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let siteId: string;
let buildingId: string;
let floorId: string;
let roomId: string;
let catId: string;
let subId: string;
let assetId: string;

// ---- Fake provider -----------------------------------------------------------

/**
 * Deterministic fake ICMP provider. Pops one scripted result per call; the
 * final scripted result repeats for any extra calls.
 */
function fakeProvider(script: { success: boolean; checkedAt?: Date }[]): ICMPProvider {
  let i = 0;
  return {
    async ping(_ip: string): Promise<PingResult> {
      const entry = script[Math.min(i, script.length - 1)];
      i += 1;
      return { success: entry.success, checkedAt: entry.checkedAt ?? new Date() };
    },
  };
}

const sampleSnapshot = (overrides: Partial<DeviceMonitorSnapshot> = {}): DeviceMonitorSnapshot => ({
  id: '00000000-0000-0000-0000-000000000000',
  status: 'UNKNOWN',
  consecutiveFailures: 0,
  offlineStartedAt: null,
  lastPingAt: null,
  lastSuccessAt: null,
  lastStatusChangeAt: null,
  ...overrides,
});

const result = (success: boolean, checkedAt: Date = new Date()): MonitoringResult => ({
  deviceId: '00000000-0000-0000-0000-000000000000',
  success,
  checkedAt,
});

let deviceSeq = 0;
async function createDevice(ip: string, assetIdValue: string | null = null): Promise<string> {
  const rows = await sql`
    INSERT INTO network_devices (id, name, device_type, ip_address, room_id, asset_id, status, consecutive_failures, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${`QA Device ${RUN} ${deviceSeq++}`}, 'COMPUTER', ${ip}, ${roomId}, ${assetIdValue}, 'UNKNOWN', 0, true, now(), now())
    RETURNING id
  `;
  return rows[0].id as string;
}

async function readDevice(id: string) {
  const rows = await sql`SELECT * FROM network_devices WHERE id = ${id}`;
  return rows[0];
}

async function readIncidents(deviceId: string) {
  return sql`SELECT * FROM network_connection_events WHERE network_device_id = ${deviceId} ORDER BY started_at`;
}

beforeAll(async () => {
  const site = await sql`INSERT INTO sites (id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${`QA_SITE_${RUN}`}, 'QA Site', now(), now()) RETURNING id`;
  siteId = site[0].id as string;
  const building = await sql`INSERT INTO buildings (id, site_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${siteId}, ${`QA_BLD_${RUN}`}, 'QA Building', now(), now()) RETURNING id`;
  buildingId = building[0].id as string;
  const floor = await sql`INSERT INTO floors (id, building_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${buildingId}, ${`QA_FLR_${RUN}`}, 'QA Floor', now(), now()) RETURNING id`;
  floorId = floor[0].id as string;
  const room = await sql`INSERT INTO rooms (id, floor_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${floorId}, ${`QA_ROOM_${RUN}`}, 'QA Room', now(), now()) RETURNING id`;
  roomId = room[0].id as string;

  const admin = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${`QA_NM_CAT_${RUN}`}, 'QA NM Cat', true, now(), now()) RETURNING id`;
  catId = cat[0].id as string;
  const sub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, ${`QA_NM_SUB_${RUN}`}, 'QA NM Sub', true, now(), now()) RETURNING id`;
  subId = sub[0].id as string;
  const asset = await assetSvc.create(
    { assetName: `QA NM Asset ${RUN}`, categoryId: catId, subcategoryId: subId, condition: 'GOOD', status: 'AVAILABLE' },
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

// ---- Pure state machine ------------------------------------------------------

describe('Network monitoring state machine', () => {
  it('UNKNOWN + SUCCESS -> SET_ONLINE', () => {
    const action = evaluateTransition(sampleSnapshot({ status: 'UNKNOWN' }), result(true, new Date()));
    expect(action.type).toBe('SET_ONLINE');
  });

  it('UNKNOWN + FAIL -> increments failure but stays UNKNOWN', () => {
    const action = evaluateTransition(sampleSnapshot({ status: 'UNKNOWN' }), result(false, new Date()));
    expect(action).toEqual({ type: 'INCREMENT_FAILURE', consecutiveFailures: 1 });
  });

  it('ONLINE + FAIL (first) -> increments to 1 without going offline', () => {
    const action = evaluateTransition(sampleSnapshot({ status: 'ONLINE' }), result(false, new Date()));
    expect(action).toEqual({ type: 'INCREMENT_FAILURE', consecutiveFailures: 1 });
  });

  it('ONLINE + FAIL (second) -> GO_OFFLINE', () => {
    const at = new Date();
    const action = evaluateTransition(sampleSnapshot({ status: 'ONLINE', consecutiveFailures: 1 }), result(false, at));
    expect(action).toEqual({ type: 'GO_OFFLINE', offlineStartedAt: at, consecutiveFailures: 2 });
  });

  it('OFFLINE + FAIL -> no-op', () => {
    const action = evaluateTransition(
      sampleSnapshot({ status: 'OFFLINE', consecutiveFailures: 2, offlineStartedAt: new Date() }),
      result(false, new Date()),
    );
    expect(action).toEqual({ type: 'CONTINUE' });
  });

  it('OFFLINE + SUCCESS -> RECOVER with non-negative duration', () => {
    const started = new Date('2026-09-09T03:04:00.000Z');
    const resolved = new Date('2026-09-09T03:10:00.000Z');
    const action = evaluateTransition(
      sampleSnapshot({ status: 'OFFLINE', consecutiveFailures: 2, offlineStartedAt: started }),
      result(true, resolved),
    );
    expect(action).toEqual({
      type: 'RECOVER',
      resolvedAt: resolved,
      startedAt: started,
      durationSeconds: 360,
    });
  });
});

// ---- Provider abstraction ----------------------------------------------------

describe('ICMP provider', () => {
  it('rejects malformed IP addresses with a provider error', async () => {
    const { BinaryPingProvider } = await import('@/modules/network-monitoring/icmp/binary-ping-provider');
    const provider = new BinaryPingProvider();
    await expect(provider.ping('not-an-ip')).rejects.toBeInstanceOf(IcmpProviderError);
  });
});

// ---- Integration: DB state transitions --------------------------------------

describe('Network monitoring engine (integration)', () => {
  it('Test 1: UNKNOWN + SUCCESS -> ONLINE', async () => {
    const id = await createDevice(`10.10.${Math.floor(Math.random() * 200)}.1`);
    const outcome = await svc.monitorDeviceById(id, fakeProvider([{ success: true }]));
    expect(outcome?.transition).toBe('UNKNOWN_ONLINE');

    const device = await readDevice(id);
    expect(device.status).toBe('ONLINE');
    expect(device.consecutive_failures).toBe(0);
    expect(device.last_success_at).not.toBeNull();
    expect(device.last_status_change_at).not.toBeNull();
    expect(device.offline_started_at).toBeNull();
    expect(await readIncidents(id)).toHaveLength(0);
  });

  it('Test 2: ONLINE + FAIL -> still ONLINE with failure = 1', async () => {
    const id = await createDevice(`10.11.${Math.floor(Math.random() * 200)}.1`);
    await svc.monitorDeviceById(id, fakeProvider([{ success: true }]));

    const outcome = await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));
    expect(outcome?.transition).toBe('INCREMENT_FAILURE');

    const device = await readDevice(id);
    expect(device.status).toBe('ONLINE');
    expect(device.consecutive_failures).toBe(1);
    expect(await readIncidents(id)).toHaveLength(0);
  });

  it('Test 3: ONLINE + FAIL + FAIL -> OFFLINE with exactly one incident', async () => {
    const id = await createDevice(`10.12.${Math.floor(Math.random() * 200)}.1`);
    const t0 = new Date();
    const t1 = new Date(t0.getTime() + 120_000);
    const t2 = new Date(t0.getTime() + 240_000);

    await svc.monitorDeviceById(id, fakeProvider([{ success: true, checkedAt: t0 }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false, checkedAt: t1 }]));
    const outcome = await svc.monitorDeviceById(id, fakeProvider([{ success: false, checkedAt: t2 }]));
    expect(outcome?.transition).toBe('GO_OFFLINE');

    const device = await readDevice(id);
    expect(device.status).toBe('OFFLINE');
    expect(device.consecutive_failures).toBe(2);
    expect(device.offline_started_at).not.toBeNull();
    expect(device.last_status_change_at).not.toBeNull();

    const incidents = await readIncidents(id);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].event_type).toBe('CONNECTION_LOST');
    expect(incidents[0].resolved_at).toBeNull();
    expect(incidents[0].duration_seconds).toBeNull();
    // started_at is the moment the device officially became OFFLINE (= t2).
    expect(new Date(incidents[0].started_at as Date).getTime()).toBe(t2.getTime());
  });

  it('Test 4: OFFLINE + FAIL + FAIL -> stays OFFLINE with still one incident', async () => {
    const id = await createDevice(`10.13.${Math.floor(Math.random() * 200)}.1`);
    const t0 = new Date();
    await svc.monitorDeviceById(id, fakeProvider([{ success: true, checkedAt: t0 }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false, checkedAt: new Date(t0.getTime() + 1000) }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false, checkedAt: new Date(t0.getTime() + 2000) }]));

    const before = await readIncidents(id);
    expect(before).toHaveLength(1);
    const startedBefore = new Date(before[0].started_at as Date).getTime();

    await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));

    const after = await readIncidents(id);
    expect(after).toHaveLength(1);
    expect(new Date(after[0].started_at as Date).getTime()).toBe(startedBefore);

    const device = await readDevice(id);
    expect(device.status).toBe('OFFLINE');
  });

  it('Test 5: OFFLINE + SUCCESS -> ONLINE, incident resolved with correct duration', async () => {
    const id = await createDevice(`10.14.${Math.floor(Math.random() * 200)}.1`);
    const t0 = new Date();
    const tOffline = new Date(t0.getTime() + 240_000);
    const tRecover = new Date(tOffline.getTime() + 360_000);

    await svc.monitorDeviceById(id, fakeProvider([{ success: true, checkedAt: t0 }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false, checkedAt: new Date(t0.getTime() + 120_000) }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false, checkedAt: tOffline }]));

    const outcome = await svc.monitorDeviceById(id, fakeProvider([{ success: true, checkedAt: tRecover }]));
    expect(outcome?.transition).toBe('RECOVERED');
    expect(outcome?.durationSeconds).toBe(360);

    const device = await readDevice(id);
    expect(device.status).toBe('ONLINE');
    expect(device.consecutive_failures).toBe(0);
    expect(device.offline_started_at).toBeNull();
    expect(device.last_success_at).not.toBeNull();

    const incidents = await readIncidents(id);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].resolved_at).not.toBeNull();
    expect(incidents[0].duration_seconds).toBe(360);
  });

  it('Test 6: monitoring never changes asset status or condition', async () => {
    const before = await assetSvc.getById(assetId);
    const id = await createDevice(`10.15.${Math.floor(Math.random() * 200)}.1`, assetId);

    await svc.monitorDeviceById(id, fakeProvider([{ success: true }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: true }]));

    const after = await assetSvc.getById(assetId);
    expect(after.status).toBe(before.status);
    expect(after.condition).toBe(before.condition);
    expect(after.status).toBe('AVAILABLE');
    expect(after.condition).toBe('GOOD');
  });

  it('isolates provider errors: a malformed device does not stop or alter others', async () => {
    const good = await createDevice(`10.16.${Math.floor(Math.random() * 200)}.1`);
    const bad = await createDevice(`10.17.${Math.floor(Math.random() * 200)}.1`);

    // Provider that throws for the bad device and succeeds for the good one.
    const provider: ICMPProvider = {
      async ping(ip: string) {
        if (ip.endsWith('.1') && ip.startsWith('10.17.')) throw new IcmpProviderError('boom');
        return { success: true, checkedAt: new Date() };
      },
    };

    const outcomes = await svc.runMonitoringCycle(provider);

    const goodDevice = await readDevice(good);
    expect(goodDevice.status).toBe('ONLINE');

    // The failing device keeps its previous state (UNKNOWN) and has no incidents.
    const badDevice = await readDevice(bad);
    expect(badDevice.status).toBe('UNKNOWN');
    expect(await readIncidents(bad)).toHaveLength(0);

    // Good device appears in outcomes, bad one does not.
    expect(outcomes.some((o) => o.deviceId === good)).toBe(true);
    expect(outcomes.some((o) => o.deviceId === bad)).toBe(false);
  });
});