import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as svc from '@/modules/network-monitoring/monitoring.service';
import type { ICMPProvider } from '@/modules/network-monitoring/icmp/ping-provider';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let siteId: string;
let buildingId: string;
let floorId: string;
let roomId: string;
let deviceId: string;

function fakeProvider(script: { success: boolean; checkedAt: Date }[]): ICMPProvider {
  let i = 0;
  return {
    async ping() {
      const entry = script[Math.min(i, script.length - 1)];
      i += 1;
      return { success: entry.success, checkedAt: entry.checkedAt };
    },
  };
}

beforeAll(async () => {
  const site = await sql`INSERT INTO sites (id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${`HX_SITE_${RUN}`}, 'HX Site', now(), now()) RETURNING id`;
  siteId = site[0].id as string;
  const building = await sql`INSERT INTO buildings (id, site_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${siteId}, ${`HX_BLD_${RUN}`}, 'HX Building', now(), now()) RETURNING id`;
  buildingId = building[0].id as string;
  const floor = await sql`INSERT INTO floors (id, building_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${buildingId}, ${`HX_FLR_${RUN}`}, 'HX Floor', now(), now()) RETURNING id`;
  floorId = floor[0].id as string;
  const room = await sql`INSERT INTO rooms (id, floor_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${floorId}, ${`HX_ROOM_${RUN}`}, 'HX Room', now(), now()) RETURNING id`;
  roomId = room[0].id as string;

  const device = await sql`
    INSERT INTO network_devices (id, name, device_type, ip_address, room_id, status, consecutive_failures, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${`Hist Device ${RUN}`}, 'COMPUTER', '10.201.0.1', ${roomId}, 'ONLINE', 0, true, now(), now())
    RETURNING id`;
  deviceId = device[0].id as string;
});

afterAll(async () => {
  await sql`DELETE FROM network_connection_events WHERE network_device_id = ${deviceId}`;
  await sql`DELETE FROM network_devices WHERE id = ${deviceId}`;
  await sql`DELETE FROM rooms WHERE id = ${roomId}`;
  await sql`DELETE FROM floors WHERE id = ${floorId}`;
  await sql`DELETE FROM buildings WHERE id = ${buildingId}`;
  await sql`DELETE FROM sites WHERE id = ${siteId}`;
  await sql.end();
});

describe('Network monitoring history service', () => {
  it('returns status with room/location metadata', async () => {
    const status = await svc.getStatus();
    const row = status.find((d) => d.id === deviceId);
    expect(row).toBeDefined();
    expect(row?.roomName).toBe('HX Room');
    expect(row?.roomCode).toBe(`HX_ROOM_${RUN}`);
    expect(row?.location).toContain('HX Room');
    expect(row?.status).toBe('ONLINE');
  });

  it('projects one incident into CONNECTION_LOST and RESTORED, with UTC durations', async () => {
    const t0 = new Date('2026-09-09T03:04:00.000Z');
    const t1 = new Date('2026-09-09T03:10:00.000Z');

    // ONLINE -> FAIL -> FAIL becomes OFFLINE, then SUCCESS recovers.
    await svc.monitorDeviceById(deviceId, fakeProvider([{ success: false, checkedAt: t0 }]));
    await svc.monitorDeviceById(deviceId, fakeProvider([{ success: false, checkedAt: t0 }]));
    await svc.monitorDeviceById(deviceId, fakeProvider([{ success: true, checkedAt: t1 }]));

    const events = await svc.getEvents({ deviceId, limit: 10 });
    expect(events.data).toHaveLength(1);
    const incident = events.data[0];
    expect(incident.eventType).toBe('CONNECTION_LOST');
    expect(incident.startedAt).toBe(t0.toISOString());
    expect(incident.resolvedAt).toBe(t1.toISOString());
    expect(incident.durationSeconds).toBe(360);
    expect(incident.roomName).toBe('HX Room');

    // No active incidents remain after recovery.
    const active = await svc.getActiveIncidents();
    expect(active.find((e) => e.networkDeviceId === deviceId)).toBeUndefined();

    // Filters narrow the result set as expected.
    const filtered = await svc.getEvents({ roomId, status: 'ONLINE', limit: 10 });
    expect(filtered.data.some((e) => e.id === incident.id)).toBe(true);

    const noMatch = await svc.getEvents({ search: 'does-not-exist-xyz', limit: 10 });
    expect(noMatch.data).toHaveLength(0);
  });
});
