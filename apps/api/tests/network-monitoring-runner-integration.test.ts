import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import {
  startNetworkMonitoringRunner,
  setMonitorCycleRunner,
  resetNetworkMonitoringRunner,
} from '@/lib/network-monitoring/runner';
import * as monitoringService from '@/modules/network-monitoring/monitoring.service';
import type { ICMPProvider } from '@/modules/network-monitoring/icmp/ping-provider';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let roomId: string;
let siteId: string;
let buildingId: string;
let floorId: string;
let activeId: string;
let inactiveId: string;

/** Provider that records probed IPs, succeeds for one target, and isolates everything else. */
function recordingProvider(probed: string[], targetIp: string): ICMPProvider {
  return {
    async ping(ip: string) {
      probed.push(ip);
      if (ip === targetIp) return { success: true, checkedAt: new Date() };
      // Throw for any other device so concurrent test fixtures are never mutated.
      throw new Error(`not our target: ${ip}`);
    },
  };
}

beforeAll(async () => {
  const site = await sql`INSERT INTO sites (id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${`QR_SITE_${RUN}`}, 'QR Site', now(), now()) RETURNING id`;
  siteId = site[0].id as string;
  const building = await sql`INSERT INTO buildings (id, site_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${siteId}, ${`QR_BLD_${RUN}`}, 'QR Building', now(), now()) RETURNING id`;
  buildingId = building[0].id as string;
  const floor = await sql`INSERT INTO floors (id, building_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${buildingId}, ${`QR_FLR_${RUN}`}, 'QR Floor', now(), now()) RETURNING id`;
  floorId = floor[0].id as string;
  const room = await sql`INSERT INTO rooms (id, floor_id, code, name, created_at, updated_at) VALUES (gen_random_uuid(), ${floorId}, ${`QR_ROOM_${RUN}`}, 'QR Room', now(), now()) RETURNING id`;
  roomId = room[0].id as string;

  const active = await sql`
    INSERT INTO network_devices (id, name, device_type, ip_address, room_id, status, consecutive_failures, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${`QR Active ${RUN}`}, 'COMPUTER', '10.200.0.1', ${roomId}, 'UNKNOWN', 0, true, now(), now())
    RETURNING id`;
  activeId = active[0].id as string;

  const inactive = await sql`
    INSERT INTO network_devices (id, name, device_type, ip_address, room_id, status, consecutive_failures, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), ${`QR Inactive ${RUN}`}, 'COMPUTER', '10.200.0.2', ${roomId}, 'UNKNOWN', 0, false, now(), now())
    RETURNING id`;
  inactiveId = inactive[0].id as string;
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

describe('Network monitoring runner integration', () => {
  it('monitors only active devices (inactive devices are skipped)', async () => {
    const probed: string[] = [];
    // Use the real cycle so DB read filtering (is_active) is exercised.
    const original = monitoringService.getIcmpProvider();
    monitoringService.setIcmpProvider(recordingProvider(probed, '10.200.0.1'));
    try {
      setMonitorCycleRunner(() => monitoringService.runMonitoringCycle());
      startNetworkMonitoringRunner();
      // Wait for the immediate startup cycle to finish.
      await waitFor(() => probed.length > 0);
      await waitFor(async () => {
        const rows = await sql`SELECT status FROM network_devices WHERE id = ${activeId}`;
        return rows[0].status === 'ONLINE';
      });

      expect(probed).toContain('10.200.0.1');
      expect(probed).not.toContain('10.200.0.2');

      const active = await sql`SELECT status FROM network_devices WHERE id = ${activeId}`;
      expect(active[0].status).toBe('ONLINE');

      const inactive = await sql`SELECT status FROM network_devices WHERE id = ${inactiveId}`;
      expect(inactive[0].status).toBe('UNKNOWN');
    } finally {
      resetNetworkMonitoringRunner();
      monitoringService.setIcmpProvider(original);
    }
  });
});

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await check()) return;
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, 25));
  }
}