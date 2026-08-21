import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as assetSvc from '@/modules/assets/asset.service';
import * as maintenanceSvc from '@/modules/maintenance/maintenance.service';
import * as ticketSvc from '@/modules/tickets/ticket.service';
import * as dashboardSvc from '@/modules/dashboard/dashboard.service';
import * as userSvc from '@/modules/users/user.service';
import type { AssetScope } from '@/middleware/scope';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36).toUpperCase();

let adminId: string;
let adminRoleId: string;
let techRoleId: string;
let catAId: string | null = null;
let catBId: string | null = null;
let subAId: string | null = null;
let subBId: string | null = null;
let assetA1Id: string | null = null;
let assetA2Id: string | null = null;
let assetB1Id: string | null = null;
const userIds: string[] = [];

const superUser = () => ({ id: adminId, username: 'admin', name: 'Admin', roles: ['SUPER_ADMIN'], permissions: [] });

beforeAll(async () => {
  const admin = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = admin[0].id as string;
  const roles = await sql`SELECT id, name FROM roles WHERE name IN ('ADMIN', 'TECHNICIAN')`;
  adminRoleId = (roles.find((r) => r.name === 'ADMIN') as { id: string }).id;
  techRoleId = (roles.find((r) => r.name === 'TECHNICIAN') as { id: string }).id;

  const catA = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${'QA_DSH_A' + RUN}, 'QA Dash A', true, now(), now()) RETURNING id`;
  catAId = catA[0].id;
  const catB = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${'QA_DSH_B' + RUN}, 'QA Dash B', true, now(), now()) RETURNING id`;
  catBId = catB[0].id;
  const subA = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catAId}, ${'QA_DSH_SA' + RUN}, 'QA Dash Sub A', true, now(), now()) RETURNING id`;
  subAId = subA[0].id;
  const subB = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catBId}, ${'QA_DSH_SB' + RUN}, 'QA Dash Sub B', true, now(), now()) RETURNING id`;
  subBId = subB[0].id;

  const a1 = await assetSvc.create({ assetName: 'QA Dash A1', categoryId: catAId, subcategoryId: subAId, condition: 'GOOD', status: 'AVAILABLE', serialNumber: 'QA-DSH-A1-' + RUN }, adminId);
  assetA1Id = a1.id as string;
  const a2 = await assetSvc.create({ assetName: 'QA Dash A2', categoryId: catAId, subcategoryId: subAId, condition: 'BROKEN', status: 'IN_MAINTENANCE', serialNumber: 'QA-DSH-A2-' + RUN }, adminId);
  assetA2Id = a2.id as string;
  const b1 = await assetSvc.create({ assetName: 'QA Dash B1', categoryId: catBId, subcategoryId: subBId, condition: 'GOOD', status: 'AVAILABLE', serialNumber: 'QA-DSH-B1-' + RUN }, adminId);
  assetB1Id = b1.id as string;

  // One maintenance on an A asset and one on a B asset.
  await maintenanceSvc.create({ assetId: assetA1Id, maintenanceCategory: 'CORRECTIVE', problem: 'QA A', priority: 'MEDIUM' }, adminId);
  await maintenanceSvc.create({ assetId: assetB1Id, maintenanceCategory: 'PREVENTIVE', problem: 'QA B', priority: 'LOW' }, adminId);

  // One open ticket on an A asset.
  await ticketSvc.create({ title: 'QA Dash ticket', assetId: assetA1Id, priority: 'MEDIUM' }, superUser());

  // Users: an ADMIN and a TECHNICIAN per category.
  const suffix = RUN.toLowerCase();
  userIds.push((await userSvc.create({ employeeCode: 'QA_ADA' + RUN, name: 'QA Admin A', username: `qaada${suffix}`, password: 'password123', roleId: adminRoleId, categoryId: catAId })).id);
  userIds.push((await userSvc.create({ employeeCode: 'QA_ADB' + RUN, name: 'QA Admin B', username: `qaadb${suffix}`, password: 'password123', roleId: adminRoleId, categoryId: catBId })).id);
  userIds.push((await userSvc.create({ employeeCode: 'QA_TEA' + RUN, name: 'QA Tech A', username: `qatea${suffix}`, password: 'password123', roleId: techRoleId, categoryId: catAId })).id);
  userIds.push((await userSvc.create({ employeeCode: 'QA_TEB' + RUN, name: 'QA Tech B', username: `qateb${suffix}`, password: 'password123', roleId: techRoleId, categoryId: catBId })).id);
});

afterAll(async () => {
  for (const id of [assetA1Id, assetA2Id, assetB1Id]) {
    if (id) {
      await sql`DELETE FROM ticket_comments WHERE ticket_id IN (SELECT id FROM tickets WHERE asset_id = ${id})`;
      await sql`DELETE FROM ticket_documents WHERE ticket_id IN (SELECT id FROM tickets WHERE asset_id = ${id})`;
      await sql`DELETE FROM ticket_assignments WHERE ticket_id IN (SELECT id FROM tickets WHERE asset_id = ${id})`;
      await sql`DELETE FROM tickets WHERE asset_id = ${id}`;
      await sql`DELETE FROM maintenance_parts WHERE maintenance_id IN (SELECT id FROM maintenance_records WHERE asset_id = ${id})`;
      await sql`DELETE FROM maintenance_documents WHERE maintenance_id IN (SELECT id FROM maintenance_records WHERE asset_id = ${id})`;
      await sql`DELETE FROM maintenance_reminders WHERE schedule_id IN (SELECT id FROM maintenance_schedules WHERE asset_id = ${id}) OR maintenance_id IN (SELECT id FROM maintenance_records WHERE asset_id = ${id})`;
      await sql`DELETE FROM maintenance_schedule_logs WHERE schedule_id IN (SELECT id FROM maintenance_schedules WHERE asset_id = ${id}) OR maintenance_id IN (SELECT id FROM maintenance_records WHERE asset_id = ${id})`;
      await sql`DELETE FROM maintenance_records WHERE asset_id = ${id}`;
      await sql`DELETE FROM maintenance_schedules WHERE asset_id = ${id}`;
      await sql`DELETE FROM asset_assignments WHERE asset_id = ${id}`;
      await sql`DELETE FROM asset_condition_history WHERE asset_id = ${id}`;
      await sql`DELETE FROM asset_documents WHERE asset_id = ${id}`;
      await sql`DELETE FROM asset_movements WHERE asset_id = ${id}`;
      await sql`DELETE FROM analytics_events WHERE asset_id = ${id}`;
      await sql`DELETE FROM assets WHERE id = ${id}`;
    }
  }
  for (const id of userIds) {
    await sql`DELETE FROM user_roles WHERE user_id = ${id}`;
    await sql`DELETE FROM user_categories WHERE user_id = ${id}`;
    await sql`DELETE FROM users WHERE id = ${id}`;
  }
  for (const id of [catAId, catBId]) if (id) await sql`DELETE FROM asset_code_counters WHERE category_id = ${id}`;
  for (const id of [subAId, subBId]) if (id) await sql`DELETE FROM asset_subcategories WHERE id = ${id}`;
  for (const id of [catAId, catBId]) if (id) await sql`DELETE FROM asset_categories WHERE id = ${id}`;
  await sql.end();
});

describe('Dashboard category scope', () => {
  const scopeA = (): AssetScope => ({ categoryIds: [catAId!] });
  const scopeB = (): AssetScope => ({ categoryIds: [catBId!] });

  it('SUPER_ADMIN / ADMIN-IT / ADMIN-GA / TECHNICIAN-IT / TECHNICIAN-GA see different totals', async () => {
    const sAdmin = await dashboardSvc.getSummary(adminId, {});
    const sAdminA = await dashboardSvc.getSummary(userIds[0], scopeA());
    const sAdminB = await dashboardSvc.getSummary(userIds[1], scopeB());
    const sTechA = await dashboardSvc.getSummary(userIds[2], scopeA());
    const sTechB = await dashboardSvc.getSummary(userIds[3], scopeB());

    // Total assets: 2 in category A, 1 in category B.
    expect(sAdminA.assets.total).toBe(2);
    expect(sAdminB.assets.total).toBe(1);
    expect(sTechA.assets.total).toBe(2);
    expect(sTechB.assets.total).toBe(1);

    // SUPER_ADMIN sees everything (including pre-existing data), always more
    // than any single category.
    expect(sAdmin.assets.total).toBeGreaterThanOrEqual(3);
    expect(sAdmin.assets.total).toBeGreaterThan(sAdminA.assets.total);
    expect(sAdmin.assets.total).toBeGreaterThan(sAdminB.assets.total);

    // ADMIN and TECHNICIAN in the same category agree; different categories differ.
    expect(sAdminA.assets.total).toBe(sTechA.assets.total);
    expect(sAdminB.assets.total).toBe(sTechB.assets.total);
    expect(sAdminA.assets.total).not.toBe(sAdminB.assets.total);
    expect(sTechA.assets.total).not.toBe(sTechB.assets.total);

    // Condition breakdown follows the same scope.
    expect(sAdminA.assets.broken).toBe(1);
    expect(sAdminB.assets.broken).toBe(0);
    expect(sAdminA.assets.inMaintenance).toBe(1);
    expect(sAdminB.assets.inMaintenance).toBe(0);
  });

  it('dashboard totals are consistent with the Inventory list', async () => {
    const invAdmin = await assetSvc.list({ page: 1, limit: 100 }, {});
    const invA = await assetSvc.list({ page: 1, limit: 100 }, scopeA());
    const invB = await assetSvc.list({ page: 1, limit: 100 }, scopeB());

    expect(invAdmin.meta.total).toBe((await dashboardSvc.getSummary(adminId, {})).assets.total);
    expect(invA.meta.total).toBe((await dashboardSvc.getSummary(userIds[0], scopeA())).assets.total);
    expect(invB.meta.total).toBe((await dashboardSvc.getSummary(userIds[1], scopeB())).assets.total);
  });

  it('Asset by Category only shows accessible categories', async () => {
    const statsA = await dashboardSvc.getAssetStats(scopeA());
    expect(statsA.byCategory).toEqual([{ category: 'QA Dash A', value: 2 }]);
    const statsB = await dashboardSvc.getAssetStats(scopeB());
    expect(statsB.byCategory).toEqual([{ category: 'QA Dash B', value: 1 }]);
    // SUPER_ADMIN sees every category that has assets (test + pre-existing).
    const statsAdmin = await dashboardSvc.getAssetStats({});
    expect(statsAdmin.byCategory.some((c) => c.category === 'QA Dash A' && c.value === 2)).toBe(true);
    expect(statsAdmin.byCategory.some((c) => c.category === 'QA Dash B' && c.value === 1)).toBe(true);
    expect(statsAdmin.byCategory.length).toBeGreaterThanOrEqual(2);
  });

  it('Condition Distribution counts only the accessible category', async () => {
    const condA = await dashboardSvc.getConditionAnalytics(scopeA());
    expect(condA.byCondition.reduce((s, c) => s + c.value, 0)).toBe(2);
    const condB = await dashboardSvc.getConditionAnalytics(scopeB());
    expect(condB.byCondition.reduce((s, c) => s + c.value, 0)).toBe(1);
  });

  it('Maintenance Status only includes maintenance of the accessible category', async () => {
    const mtnA = await dashboardSvc.getMaintenanceStats(scopeA());
    const mtnB = await dashboardSvc.getMaintenanceStats(scopeB());
    const sum = (rows: { value: number }[]) => rows.reduce((s, r) => s + r.value, 0);
    expect(sum(mtnA.byStatus)).toBe(1); // only the maintenance on the A asset
    expect(sum(mtnB.byStatus)).toBe(1); // only the maintenance on the B asset
  });

  it('Ticket summary follows the category filter via asset_id', async () => {
    const tA = await dashboardSvc.getTicketStats(scopeA());
    const tB = await dashboardSvc.getTicketStats(scopeB());
    const tAdmin = await dashboardSvc.getTicketStats({});
    expect(tA.open).toBe(1); // the ticket on asset A1
    expect(tB.open).toBe(0);
    expect(tAdmin.open).toBe(1);
  });
});
