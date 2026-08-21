import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as assetSvc from '@/modules/assets/asset.service';
import * as assignmentSvc from '@/modules/assets/assignment.service';
import * as maintenanceSvc from '@/modules/maintenance/maintenance.service';
import * as userSvc from '@/modules/users/user.service';
import * as dashboardSvc from '@/modules/dashboard/dashboard.service';
import type { AssetScope } from '@/middleware/scope';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36).toUpperCase();

let adminId: string;
let userRoleId: string;
let catAId: string | null = null;
let catBId: string | null = null;
let catCId: string | null = null;
let subAId: string | null = null;
let subBId: string | null = null;
let subCId: string | null = null;
let assetA1Id: string | null = null;
let assetA2Id: string | null = null;
let assetB1Id: string | null = null;
let assetC1Id: string | null = null;
let userAId: string;
let userBId: string;

const maintenance: { id: string; code: string; assetId: string; problem: string }[] = [];
const assetIds: (string | null)[] = [];

beforeAll(async () => {
  const admin = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = admin[0].id as string;
  const roles = await sql`SELECT id, name FROM roles WHERE name IN ('ADMIN', 'USER')`;
  userRoleId = (roles.find((r) => r.name === 'USER') as { id: string }).id;

  const suffix = RUN.toLowerCase();

  const mkCat = async (code: string, name: string) =>
    (await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${code + RUN}, ${name}, true, now(), now()) RETURNING id`)[0].id as string;
  const mkSub = async (categoryId: string, code: string, name: string) =>
    (await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${categoryId}, ${code + RUN}, ${name}, true, now(), now()) RETURNING id`)[0].id as string;

  catAId = await mkCat('QA_RA_A', 'QA RA Category A');
  catBId = await mkCat('QA_RA_B', 'QA RA Category B');
  catCId = await mkCat('QA_RA_C', 'QA RA Category C');
  subAId = await mkSub(catAId, 'QA_RA_SA', 'QA RA Sub A');
  subBId = await mkSub(catBId, 'QA_RA_SB', 'QA RA Sub B');
  subCId = await mkSub(catCId, 'QA_RA_SC', 'QA RA Sub C');

  const mkAsset = async (name: string, cat: string, sub: string, sn: string) => {
    const a = await assetSvc.create({ assetName: name, categoryId: cat, subcategoryId: sub, condition: 'GOOD', status: 'AVAILABLE', serialNumber: sn }, adminId);
    assetIds.push(a.id as string);
    return a.id as string;
  };

  assetA1Id = await mkAsset('QA RA A1', catAId, subAId, 'QA-RA-A1-' + RUN);
  assetA2Id = await mkAsset('QA RA A2', catAId, subAId, 'QA-RA-A2-' + RUN);
  assetB1Id = await mkAsset('QA RA B1', catBId, subBId, 'QA-RA-B1-' + RUN);
  assetC1Id = await mkAsset('QA RA C1', catCId, subCId, 'QA-RA-C1-' + RUN);

  // Regular users: A is assigned to assetA1, B is assigned to assetC1.
  const a = await userSvc.create({ employeeCode: 'QA_RAA' + RUN, name: 'QA RA User A', username: `qaraa${suffix}`, password: 'password123', roleId: userRoleId });
  userAId = a.id;
  const b = await userSvc.create({ employeeCode: 'QA_RAB' + RUN, name: 'QA RA User B', username: `qarab${suffix}`, password: 'password123', roleId: userRoleId });
  userBId = b.id;
  await assignmentSvc.assign(assetA1Id, { userId: userAId }, adminId, 'Admin');
  await assignmentSvc.assign(assetC1Id, { userId: userBId }, adminId, 'Admin');

  // 5 maintenance records with deterministic creation times.
  const mkMaint = async (assetId: string, problem: string, createdAt: string) => {
    const r = await maintenanceSvc.create({ assetId, maintenanceCategory: 'CORRECTIVE', problem, priority: 'MEDIUM' }, adminId);
    await sql`UPDATE maintenance_records SET created_at = ${createdAt}::timestamptz WHERE id = ${r.id}`;
    maintenance.push({ id: r.id as string, code: r.maintenanceCode as string, assetId, problem });
    return r;
  };

  // base timestamps, M1 newest ... M5 oldest
  const base = Date.parse('2026-05-01T00:00:00Z');
  const ts = (h: number) => new Date(base + h * 3600_000).toISOString();

  await mkMaint(assetB1Id!, 'RA M5', ts(1));
  await mkMaint(assetA1Id!, 'RA M4', ts(2));
  await mkMaint(assetA2Id!, 'RA M3', ts(3));
  await mkMaint(assetA2Id!, 'RA M2', ts(4));
  await mkMaint(assetA1Id!, 'RA M1', ts(5));

  // Sanity: newest-first order within category A.
  expect(maintenance).toHaveLength(5);
});

afterAll(async () => {
  for (const id of assetIds) {
    if (!id) continue;
    await sql`DELETE FROM ticket_documents WHERE ticket_id IN (SELECT id FROM tickets WHERE asset_id = ${id})`;
    await sql`DELETE FROM ticket_comments WHERE ticket_id IN (SELECT id FROM tickets WHERE asset_id = ${id})`;
    await sql`DELETE FROM ticket_assignments WHERE ticket_id IN (SELECT id FROM tickets WHERE asset_id = ${id})`;
    await sql`DELETE FROM tickets WHERE asset_id = ${id}`;
    await sql`DELETE FROM maintenance_documents WHERE maintenance_id IN (SELECT id FROM maintenance_records WHERE asset_id = ${id})`;
    await sql`DELETE FROM maintenance_parts WHERE maintenance_id IN (SELECT id FROM maintenance_records WHERE asset_id = ${id})`;
    await sql`DELETE FROM maintenance_reminders WHERE maintenance_id IN (SELECT id FROM maintenance_records WHERE asset_id = ${id})`;
    await sql`DELETE FROM maintenance_schedule_logs WHERE maintenance_id IN (SELECT id FROM maintenance_records WHERE asset_id = ${id})`;
    await sql`DELETE FROM maintenance_records WHERE asset_id = ${id}`;
    await sql`DELETE FROM maintenance_schedules WHERE asset_id = ${id}`;
    await sql`DELETE FROM asset_assignments WHERE asset_id = ${id}`;
    await sql`DELETE FROM asset_condition_history WHERE asset_id = ${id}`;
    await sql`DELETE FROM asset_movements WHERE asset_id = ${id}`;
    await sql`DELETE FROM asset_documents WHERE asset_id = ${id}`;
    await sql`DELETE FROM analytics_events WHERE asset_id = ${id}`;
    await sql`DELETE FROM assets WHERE id = ${id}`;
  }
  for (const id of [userAId, userBId]) {
    await sql`DELETE FROM user_roles WHERE user_id = ${id}`;
    await sql`DELETE FROM user_categories WHERE user_id = ${id}`;
    await sql`DELETE FROM users WHERE id = ${id}`;
  }
  for (const id of [catAId, catBId, catCId]) if (id) await sql`DELETE FROM asset_code_counters WHERE category_id = ${id}`;
  for (const id of [subAId, subBId, subCId]) if (id) await sql`DELETE FROM asset_subcategories WHERE id = ${id}`;
  for (const id of [catAId, catBId, catCId]) if (id) await sql`DELETE FROM asset_categories WHERE id = ${id}`;
  await sql.end();
});

describe('Dashboard Recent Activities (maintenance only)', () => {
  it('returns only MAINTENANCE_CREATED activities, newest first', async () => {
    const items = await dashboardSvc.getRecentActivity(3, {});
    expect(items).toHaveLength(3);
    for (const it of items) {
      expect(it.type).toBe('MAINTENANCE_CREATED');
      expect(it.title).toBe('Maintenance created');
      expect(it.description).toMatch(/^MNT-/);
      expect(it.reference).toBeTruthy();
    }
    const times = items.map((i) => Date.parse(i.createdAt));
    expect([...times].sort((x, y) => y - x)).toEqual(times);
  });

  it('admin scope (unrestricted) is capped at 3 even when more records exist', async () => {
    const total = await sql`SELECT count(*)::int AS n FROM maintenance_records`;
    expect(Number(total[0].n)).toBeGreaterThanOrEqual(3);
    const items = await dashboardSvc.getRecentActivity(3, {});
    expect(items).toHaveLength(3);
  });

  it('category-scoped user sees only their own categories and is capped at 3', async () => {
    // Category A has 4 maintenance records -> only the 3 newest are returned.
    const scopeA: AssetScope = { categoryIds: [catAId!] };
    const items = await dashboardSvc.getRecentActivity(3, scopeA);
    const codes = items.map((i) => i.description);
    const m1 = maintenance.find((x) => x.assetId === assetA1Id && x.problem === 'RA M1')!;
    const m2 = maintenance.find((x) => x.assetId === assetA2Id && x.problem === 'RA M2')!;
    const m3 = maintenance.find((x) => x.assetId === assetA2Id && x.problem === 'RA M3')!;
    expect(codes).toEqual([m1.code, m2.code, m3.code]);
  });

  it('category-scoped user cannot see maintenance outside their scope', async () => {
    const scopeB: AssetScope = { categoryIds: [catBId!] };
    const items = await dashboardSvc.getRecentActivity(3, scopeB);
    const m5 = maintenance.find((x) => x.assetId === assetB1Id && x.problem === 'RA M5')!;
    expect(items.map((i) => i.description)).toEqual([m5.code]);
    // None of the category-A maintenance leaks through.
    for (const x of maintenance.filter((r) => r.assetId === assetA1Id || r.assetId === assetA2Id)) {
      expect(items.some((i) => i.description === x.code)).toBe(false);
    }
  });

  it('own-scoped regular user sees only maintenance on their assigned assets (fewer than 3)', async () => {
    const scopeOwnA: AssetScope = { ownUserId: userAId };
    const items = await dashboardSvc.getRecentActivity(3, scopeOwnA);
    const m1 = maintenance.find((x) => x.assetId === assetA1Id && x.problem === 'RA M1')!;
    const m4 = maintenance.find((x) => x.assetId === assetA1Id && x.problem === 'RA M4')!;
    expect(items.map((i) => i.description)).toEqual([m1.code, m4.code]);
  });

  it('own-scoped regular user with no maintenance gets an empty list', async () => {
    const scopeOwnB: AssetScope = { ownUserId: userBId };
    const items = await dashboardSvc.getRecentActivity(3, scopeOwnB);
    expect(items).toEqual([]);
  });

  it('category with no maintenance gets an empty list', async () => {
    const scopeC: AssetScope = { categoryIds: [catCId!] };
    const items = await dashboardSvc.getRecentActivity(3, scopeC);
    expect(items).toEqual([]);
  });
});
