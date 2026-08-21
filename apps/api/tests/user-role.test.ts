import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as assetSvc from '@/modules/assets/asset.service';
import * as assignmentSvc from '@/modules/assets/assignment.service';
import * as ticketSvc from '@/modules/tickets/ticket.service';
import * as maintenanceSvc from '@/modules/maintenance/maintenance.service';
import * as userSvc from '@/modules/users/user.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });

function scopeUser(id: string, permissions: string[] = []) {
  return { id, username: id, name: id, roles: ['USER'], permissions };
}

const OWN_PERMS = ['asset.read.own', 'maintenance.read.own', 'ticket.create', 'ticket.read.own', 'ticket.comment.own', 'notification.read', 'profile.update'];

let adminId: string;
let userRoleId: string;
let userAId: string;
let userBId: string;
let categoryId: string;
let subcategoryId: string;
let assetAId: string;
let ticketAId: string;
let maintenanceAId: string;
let maintenanceCode: string;

beforeAll(async () => {
  const admin = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = admin[0].id as string;
  const role = await sql`SELECT id FROM roles WHERE name = 'USER' LIMIT 1`;
  userRoleId = role[0].id as string;

  const a = await userSvc.create({ employeeCode: 'QA_USER_A', name: 'QA User A', username: `qausera${Date.now().toString(36)}`, password: 'password123', roleId: userRoleId });
  userAId = a.id;
  const b = await userSvc.create({ employeeCode: 'QA_USER_B', name: 'QA User B', username: `qauserb${Date.now().toString(36)}`, password: 'password123', roleId: userRoleId });
  userBId = b.id;

  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'QA_UR_CAT', 'QA UR Category', true, now(), now()) RETURNING id`;
  categoryId = cat[0].id;
  const sub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${categoryId}, 'QA_UR_SUB', 'QA UR Sub', true, now(), now()) RETURNING id`;
  subcategoryId = sub[0].id;
});

afterAll(async () => {
  if (maintenanceAId) await sql`DELETE FROM maintenance_records WHERE id = ${maintenanceAId}`;
  if (ticketAId) {
    await sql`DELETE FROM ticket_comments WHERE ticket_id = ${ticketAId}`;
    await sql`DELETE FROM ticket_assignments WHERE ticket_id = ${ticketAId}`;
    await sql`DELETE FROM tickets WHERE id = ${ticketAId}`;
  }
  if (assetAId) {
    await sql`DELETE FROM asset_condition_history WHERE asset_id = ${assetAId}`;
    await sql`DELETE FROM asset_assignments WHERE asset_id = ${assetAId}`;
    await sql`DELETE FROM asset_movements WHERE asset_id = ${assetAId}`;
    await sql`DELETE FROM assets WHERE id = ${assetAId}`;
    await sql`DELETE FROM asset_code_counters WHERE category_id = ${categoryId} AND subcategory_id = ${subcategoryId}`;
  }
  for (const id of [userAId, userBId]) {
    if (id) {
      await sql`DELETE FROM user_roles WHERE user_id = ${id}`;
      await sql`DELETE FROM users WHERE id = ${id}`;
    }
  }
  await sql`DELETE FROM asset_subcategories WHERE id = ${subcategoryId}`;
  await sql`DELETE FROM asset_categories WHERE id = ${categoryId}`;
  await sql.end();
});

describe('USER role data isolation', () => {
  it('creates an asset assigned to user A', async () => {
    const asset = await assetSvc.create({ assetName: 'QA User A Laptop', categoryId, subcategoryId, condition: 'GOOD', status: 'AVAILABLE', serialNumber: 'QA-UR-001' }, adminId);
    assetAId = asset.id as string;
    await assignmentSvc.assign(assetAId, { userId: userAId }, adminId, 'Admin');
    const detail = await assetSvc.getById(assetAId, { ownUserId: userAId });
    expect(detail.currentPicId).toBe(userAId);
  });

  it('user B cannot see or open user A asset', async () => {
    const list = await assetSvc.list({ page: 1, limit: 100 }, { ownUserId: userBId });
    expect(list.data.some((a) => a.id === assetAId)).toBe(false);
    await expect(assetSvc.getById(assetAId, { ownUserId: userBId })).rejects.toThrow('You do not have permission to view this asset.');
    await expect(assetSvc.getByCode((await assetSvc.getById(assetAId)).assetCode as string, { ownUserId: userBId })).rejects.toThrow('You do not have permission to view this asset.');
  });

  it('full-read users can view every asset', async () => {
    const list = await assetSvc.list({ page: 1, limit: 100 }, {});
    expect(list.data.some((a) => a.id === assetAId)).toBe(true);
    const detail = await assetSvc.getById(assetAId, {});
    expect(detail.id).toBe(assetAId);
  });

  it('user A creates a ticket for their own asset', async () => {
    const ticket = await ticketSvc.create({ title: 'QA User A issue', assetId: assetAId, priority: 'MEDIUM' }, scopeUser(userAId, OWN_PERMS));
    ticketAId = ticket.id as string;
    expect(ticket.reporterId).toBe(userAId);
  });

  it('user B cannot create a ticket for user A asset', async () => {
    await expect(
      ticketSvc.create({ title: 'QA cross-asset', assetId: assetAId, priority: 'MEDIUM' }, scopeUser(userBId, OWN_PERMS)),
    ).rejects.toThrow('You can only create tickets for assets you have access to.');
  });

  it('user B cannot see or open user A ticket', async () => {
    const list = await ticketSvc.list({ page: 1, limit: 100 }, { userId: userBId });
    expect(list.data.some((t) => t.id === ticketAId)).toBe(false);
    await expect(ticketSvc.getById(ticketAId, scopeUser(userBId, OWN_PERMS))).rejects.toThrow('Ticket not found.');
  });

  it('user A can read their own ticket', async () => {
    const ticket = await ticketSvc.getById(ticketAId, scopeUser(userAId, OWN_PERMS));
    expect(ticket.id).toBe(ticketAId);
  });

  it('creates maintenance for user A asset', async () => {
    const record = await maintenanceSvc.create({ assetId: assetAId, maintenanceCategory: 'CORRECTIVE', problem: 'QA issue', priority: 'MEDIUM' }, adminId);
    maintenanceAId = record.id as string;
    maintenanceCode = record.maintenanceCode as string;
    expect(maintenanceAId).toBeTruthy();
  });

  it('user B cannot see or open user A maintenance', async () => {
    const list = await maintenanceSvc.list({ page: 1, limit: 100 }, { ownUserId: userBId });
    expect(list.data.some((m) => m.id === maintenanceAId)).toBe(false);
    await expect(maintenanceSvc.getById(maintenanceAId, { ownUserId: userBId })).rejects.toThrow('Maintenance record not found.');
  });

  it('user A can read maintenance for their own asset', async () => {
    const detail = await maintenanceSvc.getById(maintenanceAId, { ownUserId: userAId });
    expect(detail.maintenanceCode).toBe(maintenanceCode);
  });
});
