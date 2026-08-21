import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as assetSvc from '@/modules/assets/asset.service';
import * as maintenanceSvc from '@/modules/maintenance/maintenance.service';
import * as ticketSvc from '@/modules/tickets/ticket.service';
import * as userSvc from '@/modules/users/user.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36).toUpperCase();

let adminId: string;
let adminRoleId: string;
let techRoleId: string;
let catAId: string | null = null;
let catBId: string | null = null;
let subAId: string | null = null;
let subBId: string | null = null;
let assetAId: string | null = null;
let assetBId: string | null = null;
let adminUserId: string | null = null;
let techUserId: string | null = null;

function scopeUser(id: string, roles: string[], categoryIds: string[] = [], permissions: string[] = []) {
  return { id, username: id, name: id, roles, permissions, categoryIds };
}

beforeAll(async () => {
  const admin = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = admin[0].id as string;
  const r = await sql`SELECT id, name FROM roles WHERE name IN ('ADMIN', 'TECHNICIAN')`;
  adminRoleId = (r.find((x) => x.name === 'ADMIN') as { id: string }).id;
  techRoleId = (r.find((x) => x.name === 'TECHNICIAN') as { id: string }).id;

  const catA = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${'QA_SCP_A' + RUN}, ${'QA Scope A ' + RUN}, true, now(), now()) RETURNING id`;
  catAId = catA[0].id;
  const catB = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${'QA_SCP_B' + RUN}, ${'QA Scope B ' + RUN}, true, now(), now()) RETURNING id`;
  catBId = catB[0].id;
  const subA = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catAId}, ${'QA_SCP_SA' + RUN}, ${'QA Scope SA ' + RUN}, true, now(), now()) RETURNING id`;
  subAId = subA[0].id;
  const subB = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catBId}, ${'QA_SCP_SB' + RUN}, ${'QA Scope SB ' + RUN}, true, now(), now()) RETURNING id`;
  subBId = subB[0].id;

  const adminUser = await userSvc.create({ employeeCode: `QA_ADM${RUN}`, name: 'QA Admin A', username: `qadm${RUN.toLowerCase()}`, password: 'password123', roleId: adminRoleId, categoryId: catAId });
  adminUserId = adminUser.id;
  const techUser = await userSvc.create({ employeeCode: `QA_TEC${RUN}`, name: 'QA Tech B', username: `qtec${RUN.toLowerCase()}`, password: 'password123', roleId: techRoleId, categoryId: catBId });
  techUserId = techUser.id;

  const assetA = await assetSvc.create({ assetName: 'QA Scope Asset A', categoryId: catAId, subcategoryId: subAId, condition: 'GOOD', status: 'AVAILABLE', serialNumber: `QA-SCP-A-${RUN}` }, adminId);
  assetAId = assetA.id as string;
  const assetB = await assetSvc.create({ assetName: 'QA Scope Asset B', categoryId: catBId, subcategoryId: subBId, condition: 'GOOD', status: 'AVAILABLE', serialNumber: `QA-SCP-B-${RUN}` }, adminId);
  assetBId = assetB.id as string;
});

afterAll(async () => {
  for (const id of [assetAId, assetBId]) {
    if (id) {
      await sql`DELETE FROM ticket_comments WHERE ticket_id IN (SELECT id FROM tickets WHERE asset_id = ${id})`;
      await sql`DELETE FROM ticket_assignments WHERE ticket_id IN (SELECT id FROM tickets WHERE asset_id = ${id})`;
      await sql`DELETE FROM tickets WHERE asset_id = ${id}`;
      await sql`DELETE FROM maintenance_records WHERE asset_id = ${id}`;
      await sql`DELETE FROM asset_condition_history WHERE asset_id = ${id}`;
      await sql`DELETE FROM asset_assignments WHERE asset_id = ${id}`;
      await sql`DELETE FROM asset_movements WHERE asset_id = ${id}`;
      await sql`DELETE FROM assets WHERE id = ${id}`;
    }
  }
  if (catAId && catBId) await sql`DELETE FROM asset_code_counters WHERE category_id IN (${catAId}, ${catBId})`;
  for (const id of [adminUserId, techUserId]) {
    if (id) {
      await sql`DELETE FROM user_roles WHERE user_id = ${id}`;
      await sql`DELETE FROM user_categories WHERE user_id = ${id}`;
      await sql`DELETE FROM users WHERE id = ${id}`;
    }
  }
  for (const id of [subAId, subBId]) if (id) await sql`DELETE FROM asset_subcategories WHERE id = ${id}`;
  for (const id of [catAId, catBId]) if (id) await sql`DELETE FROM asset_categories WHERE id = ${id}`;
  await sql.end();
});

describe('RBAC category scope', () => {
  it('ADMIN sees only assets in their category', async () => {
    const scope = { categoryIds: [catAId!] };
    const list = await assetSvc.list({ page: 1, limit: 100 }, scope);
    expect(list.data.some((a) => a.id === assetAId)).toBe(true);
    expect(list.data.some((a) => a.id === assetBId)).toBe(false);
    await expect(assetSvc.getById(assetBId!, scope)).rejects.toThrow('You do not have permission to view this asset.');
  });

  it('TECHNICIAN sees only assets in their category', async () => {
    const scope = { categoryIds: [catBId!] };
    const list = await assetSvc.list({ page: 1, limit: 100 }, scope);
    expect(list.data.some((a) => a.id === assetBId)).toBe(true);
    expect(list.data.some((a) => a.id === assetAId)).toBe(false);
    await expect(assetSvc.getById(assetAId!, scope)).rejects.toThrow('You do not have permission to view this asset.');
  });

  it('SUPER_ADMIN sees all assets', async () => {
    const list = await assetSvc.list({ page: 1, limit: 100 }, {});
    expect(list.data.some((a) => a.id === assetAId)).toBe(true);
    expect(list.data.some((a) => a.id === assetBId)).toBe(true);
  });

  it('ADMIN cannot create maintenance for an out-of-scope asset', async () => {
    await expect(
      maintenanceSvc.create({ assetId: assetBId!, maintenanceCategory: 'CORRECTIVE', problem: 'QA', priority: 'MEDIUM' }, adminUserId!, { categoryIds: [catAId!] }),
    ).rejects.toThrow('Asset not found.');
  });

  it('ADMIN cannot create a ticket for an out-of-scope asset', async () => {
    const user = scopeUser(adminUserId!, ['ADMIN'], [catAId!], ['ticket.create']);
    await expect(
      ticketSvc.create({ title: 'QA out of scope', assetId: assetBId!, priority: 'MEDIUM' }, user),
    ).rejects.toThrow('You can only create tickets for assets you have access to.');
  });

  it('ADMIN ticket list only contains in-scope tickets', async () => {
    const inScope = await ticketSvc.create({ title: 'QA in scope ticket', assetId: assetAId!, priority: 'MEDIUM' }, scopeUser(adminUserId!, ['ADMIN'], [catAId!], ['ticket.create', 'ticket.read']));
    const list = await ticketSvc.list({ page: 1, limit: 100 }, { categoryIds: [catAId!] });
    expect(list.data.some((t) => t.id === inScope.id)).toBe(true);
    expect(list.data.some((t) => t.assetId === assetBId)).toBe(false);
  });
});
