import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import { eventBus, type NetworkMonitoringEvent } from '@/lib/event-bus';
import * as svc from '@/modules/network-monitoring/monitoring.service';
import type { ICMPProvider } from '@/modules/network-monitoring/icmp/ping-provider';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let siteId: string;
let buildingId: string;
let floorId: string;
let roomId: string;

function fakeProvider(script: { success: boolean; checkedAt?: Date }[]): ICMPProvider {
  let i = 0;
  return {
    async ping() {
      const entry = script[Math.min(i, script.length - 1)];
      i += 1;
      return { success: entry.success, checkedAt: entry.checkedAt ?? new Date() };
    },
  };
}

let seq = 0;
async function createDevice(ip: string, name: string): Promise<string> {
  const rows = await sql`
    INSERT INTO network_devices (id, name, device_type, ip_address, room_id, status, consecutive_failures, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${name}, 'COMPUTER', ${ip}, ${roomId}, 'UNKNOWN', 0, true, now(), now())
    RETURNING id
  `;
  return rows[0].id as string;
}

async function readDevice(id: string) {
  const rows = await sql`SELECT * FROM network_devices WHERE id = ${id}`;
  return rows[0];
}

beforeAll(async () => {
  const site = await sql`INSERT INTO sites (id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${`EV_SITE_${RUN}`}, 'EV Site', now(), now()) RETURNING id`;
  siteId = site[0].id as string;
  const building = await sql`INSERT INTO buildings (id, site_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${siteId}, ${`EV_BLD_${RUN}`}, 'EV Building', now(), now()) RETURNING id`;
  buildingId = building[0].id as string;
  const floor = await sql`INSERT INTO floors (id, building_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${buildingId}, ${`EV_FLR_${RUN}`}, 'EV Floor', now(), now()) RETURNING id`;
  floorId = floor[0].id as string;
  const room = await sql`INSERT INTO rooms (id, floor_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${floorId}, ${`EV_ROOM_${RUN}`}, 'EV Room', now(), now()) RETURNING id`;
  roomId = room[0].id as string;
});

afterAll(async () => {
  await sql`DELETE FROM network_connection_events WHERE network_device_id IN (SELECT id FROM network_devices WHERE room_id = ${roomId})`;
  await sql`DELETE FROM network_devices WHERE room_id = ${roomId}`;
  await sql`DELETE FROM rooms WHERE id = ${roomId}`;
  await sql`DELETE FROM floors WHERE id = ${floorId}`;
  await sql`DELETE FROM buildings WHERE id = ${buildingId}`;
  await sql`DELETE FROM sites WHERE id = ${siteId}`;
  await sql.end();
});

let captured: NetworkMonitoringEvent[] = [];
let unsubscribe: (() => void) | null = null;

beforeEach(() => {
  captured = [];
  unsubscribe = eventBus.subscribe((event) => {
    if (event.type === 'NETWORK_DEVICE_OFFLINE' || event.type === 'NETWORK_DEVICE_RESTORED') {
      captured.push(event);
    }
  });
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
});

describe('Network monitoring event bus publishing', () => {
  it('publishes NETWORK_DEVICE_OFFLINE on a real ONLINE -> OFFLINE transition', async () => {
    const id = await createDevice(`10.30.${seq++}.1`, `EV Offline ${RUN}`);
    const t0 = new Date();
    const tOffline = new Date(t0.getTime() + 240_000);

    await svc.monitorDeviceById(id, fakeProvider([{ success: true, checkedAt: t0 }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false, checkedAt: new Date(t0.getTime() + 120_000) }]));
    expect(captured).toHaveLength(0);

    await svc.monitorDeviceById(id, fakeProvider([{ success: false, checkedAt: tOffline }]));
    expect(captured).toHaveLength(1);
    const event = captured[0];
    expect(event.type).toBe('NETWORK_DEVICE_OFFLINE');
    if (event.type === 'NETWORK_DEVICE_OFFLINE') {
      expect(event.status).toBe('OFFLINE');
      expect(event.eventType).toBe('CONNECTION_LOST');
      expect(event.deviceId).toBe(id);
      expect(event.roomId).toBe(roomId);
      expect(event.ipAddress).toBe(`10.30.${seq - 1}.1`);
    }
  });

  it('publishes NETWORK_DEVICE_RESTORED on recovery with correct duration', async () => {
    const id = await createDevice(`10.31.${seq++}.1`, `EV Restore ${RUN}`);
    const t0 = new Date();
    const tOffline = new Date(t0.getTime() + 240_000);
    const tRecover = new Date(tOffline.getTime() + 360_000);

    await svc.monitorDeviceById(id, fakeProvider([{ success: true, checkedAt: t0 }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false, checkedAt: new Date(t0.getTime() + 120_000) }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false, checkedAt: tOffline }]));
    captured = [];

    await svc.monitorDeviceById(id, fakeProvider([{ success: true, checkedAt: tRecover }]));
    expect(captured).toHaveLength(1);
    const event = captured[0];
    expect(event.type).toBe('NETWORK_DEVICE_RESTORED');
    if (event.type === 'NETWORK_DEVICE_RESTORED') {
      expect(event.status).toBe('ONLINE');
      expect(event.eventType).toBe('RESTORED');
      expect(event.durationSeconds).toBe(360);
      expect(event.startedAt).toBe(tOffline.toISOString());
      expect(event.resolvedAt).toBe(tRecover.toISOString());
    }
  });

  it('does NOT publish while repeatedly OFFLINE (OFFLINE + FAIL)', async () => {
    const id = await createDevice(`10.32.${seq++}.1`, `EV Repeat ${RUN}`);
    await svc.monitorDeviceById(id, fakeProvider([{ success: true }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));
    expect(captured.filter((e) => e.type === 'NETWORK_DEVICE_OFFLINE')).toHaveLength(1);

    captured = [];
    await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));
    expect(captured).toHaveLength(0);
  });

  it('does NOT publish on ONLINE -> ONLINE', async () => {
    const id = await createDevice(`10.33.${seq++}.1`, `EV Stay ${RUN}`);
    await svc.monitorDeviceById(id, fakeProvider([{ success: true }]));
    captured = [];
    await svc.monitorDeviceById(id, fakeProvider([{ success: true }]));
    expect(captured).toHaveLength(0);
  });

  it('serializes all payload timestamps as UTC ISO 8601 (Z suffix)', async () => {
    const id = await createDevice(`10.34.${seq++}.1`, `EV Utc ${RUN}`);
    await svc.monitorDeviceById(id, fakeProvider([{ success: true }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));
    const offline = captured.find((e) => e.type === 'NETWORK_DEVICE_OFFLINE');
    expect(offline).toBeTruthy();
    expect(offline!.timestamp).toMatch(/Z$/);
    expect(new Date(offline!.timestamp).toISOString()).toBe(offline!.timestamp);
    expect(offline!.startedAt).toMatch(/Z$/);
  });
});

describe('Event ordering: database commits before event', () => {
  it('device is already persisted OFFLINE when the event listener runs', async () => {
    const id = await createDevice(`10.35.${seq++}.1`, `EV Order ${RUN}`);
    await svc.monitorDeviceById(id, fakeProvider([{ success: true }]));
    await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));
    captured = [];

    let observedStatus: string | null = null;
    const checkPromise = new Promise<void>((resolve) => {
      const unsub = eventBus.subscribe(async (event) => {
        if (event.type === 'NETWORK_DEVICE_OFFLINE') {
          const rows = await sql`SELECT status FROM network_devices WHERE id = ${id}`;
          observedStatus = rows[0].status as string;
          unsub();
          resolve();
        }
      });
    });

    await svc.monitorDeviceById(id, fakeProvider([{ success: false }]));
    await Promise.race([checkPromise, new Promise((r) => setTimeout(r, 1000))]);

    // The committed row already shows OFFLINE before/at the moment of publish.
    expect(observedStatus).toBe('OFFLINE');
    expect((await readDevice(id)).status).toBe('OFFLINE');
  });
});