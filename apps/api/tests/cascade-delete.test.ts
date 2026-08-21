import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as mdRepo from '@/modules/master-data/master-data.repository';
import * as mdSvc from '@/modules/master-data/master-data.service';
import * as assetSvc from '@/modules/assets/asset.service';
import * as assignmentSvc from '@/modules/assets/assignment.service';
import * as maintenanceSvc from '@/modules/maintenance/maintenance.service';
import * as scheduleSvc from '@/modules/maintenance-schedules/schedule.service';
import * as ticketSvc from '@/modules/tickets/ticket.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36).toUpperCase();

let adminId: string;

interface Tree {
  catId: string;
  subId: string;
  assetId: string;
  maintId: string;
  schId: string;
  ticketId: string;
}

const adminUser = () => ({ id: adminId, username: 'admin', name: 'Admin', roles: ['SUPER_ADMIN'], permissions: [] });

async function countById(table: string, column: string, id: string): Promise<number> {
  const q = { asset_categories: 'id', asset_subcategories: 'id', assets: 'id', asset_condition_history: 'asset_id', asset_assignments: 'asset_id', asset_documents: 'asset_id', asset_movements: 'asset_id', maintenance_records: 'asset_id', maintenance_schedules: 'asset_id', maintenance_parts: 'maintenance_id', maintenance_documents: 'maintenance_id', maintenance_schedule_logs: 'schedule_id', maintenance_reminders: 'schedule_id', tickets: 'asset_id', ticket_comments: 'ticket_id', ticket_documents: 'ticket_id', ticket_assignments: 'ticket_id' };
  const col = q[table as keyof typeof q] ?? column;
  const rows = await sql`SELECT count(*)::int AS n FROM ${sql(table)} WHERE ${sql(col)} = ${id}`;
  return rows[0].n as number;
}

/** Creates a category -> subcategory -> asset with a full child subtree. */
async function createFullTree(code: string): Promise<Tree> {
  const cat = await mdRepo.create('categories', { code: code + RUN, name: 'Cascade Cat' });
  const sub = await mdRepo.create('subcategories', { categoryId: cat.id, code: 'CSC' + RUN, name: 'Cascade Sub' });
  const asset = await assetSvc.create(
    { assetName: 'Cascade Asset', categoryId: cat.id, subcategoryId: sub.id, condition: 'GOOD', status: 'AVAILABLE', serialNumber: 'CSC-' + RUN },
    adminId,
  );
  const assetId = asset.id as string;

  // Asset children
  await assignmentSvc.assign(assetId, { userId: adminId }, adminId, 'Admin');
  await sql`INSERT INTO asset_documents (id, asset_id, document_type, file_name, file_url, created_at) VALUES (gen_random_uuid(), ${assetId}, 'OTHER', 'a.txt', '/uploads/a', now())`;
  await sql`INSERT INTO asset_movements (id, asset_id, movement_date, created_at) VALUES (gen_random_uuid(), ${assetId}, ${'2026-01-01'}, now())`;

  // Maintenance + its children
  const maint = await maintenanceSvc.create({ assetId, maintenanceCategory: 'CORRECTIVE', problem: 'QA', priority: 'MEDIUM' }, adminId);
  const maintId = maint.id as string;
  await sql`INSERT INTO maintenance_parts (id, maintenance_id, part_name, quantity, unit_price, total_price, created_at) VALUES (gen_random_uuid(), ${maintId}, 'Part', 1, '1', '1', now())`;
  await sql`INSERT INTO maintenance_documents (id, maintenance_id, document_type, file_name, file_url, created_at) VALUES (gen_random_uuid(), ${maintId}, 'OTHER', 'm.txt', '/uploads/m', now())`;

  // Schedule + logs + reminders
  const sch = await scheduleSvc.create({ assetId, frequencyType: 'MONTHLY', frequencyValue: 1 }, adminUser());
  const schId = sch.id as string;
  await sql`INSERT INTO maintenance_schedule_logs (id, schedule_id, due_date, status, created_at) VALUES (gen_random_uuid(), ${schId}, ${'2026-01-01'}, 'GENERATED', now())`;
  await sql`INSERT INTO maintenance_reminders (id, schedule_id, reminder_type, offset_days, title, created_at) VALUES (gen_random_uuid(), ${schId}, 'DUE', 0, 'Reminder', now())`;

  // Ticket + its children
  const ticket = await ticketSvc.create({ title: 'QA ticket', assetId, priority: 'MEDIUM' }, adminUser());
  const ticketId = ticket.id as string;
  await sql`INSERT INTO ticket_comments (id, ticket_id, user_id, type, comment, created_at, updated_at) VALUES (gen_random_uuid(), ${ticketId}, ${adminId}, 'COMMENT', 'hello', now(), now())`;

  return { catId: cat.id, subId: sub.id, assetId, maintId, schId, ticketId };
}

beforeAll(async () => {
  const admin = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = admin[0].id as string;
});

afterAll(async () => {
  await sql.end();
});

describe('Database-driven cascade delete', () => {
  it('deleting a category removes the whole subtree (no orphans, no 23503)', async () => {
    const t = await createFullTree('QA_CAT');

    await mdSvc.deactivate('categories', t.catId);

    expect(await countById('asset_categories', 'id', t.catId)).toBe(0);
    expect(await countById('asset_subcategories', 'id', t.subId)).toBe(0);
    expect(await countById('assets', 'id', t.assetId)).toBe(0);
    expect(await countById('asset_condition_history', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('asset_assignments', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('asset_documents', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('asset_movements', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('maintenance_records', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('maintenance_parts', 'maintenance_id', t.maintId)).toBe(0);
    expect(await countById('maintenance_documents', 'maintenance_id', t.maintId)).toBe(0);
    expect(await countById('maintenance_schedules', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('maintenance_schedule_logs', 'schedule_id', t.schId)).toBe(0);
    expect(await countById('maintenance_reminders', 'schedule_id', t.schId)).toBe(0);
    expect(await countById('tickets', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('ticket_comments', 'ticket_id', t.ticketId)).toBe(0);

    // The asset_code_counter for the deleted category has no FK and remains; clean it up.
    await sql`DELETE FROM asset_code_counters WHERE category_id = ${t.catId}`;
  });

  it('deleting an asset removes its whole subtree (no orphans, no 23503)', async () => {
    const t = await createFullTree('QA_ASC');

    await assetSvc.deletePermanently(t.assetId, adminId, 'Admin');

    expect(await countById('assets', 'id', t.assetId)).toBe(0);
    expect(await countById('asset_condition_history', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('asset_assignments', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('asset_documents', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('asset_movements', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('maintenance_records', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('maintenance_parts', 'maintenance_id', t.maintId)).toBe(0);
    expect(await countById('maintenance_documents', 'maintenance_id', t.maintId)).toBe(0);
    expect(await countById('maintenance_schedules', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('maintenance_schedule_logs', 'schedule_id', t.schId)).toBe(0);
    expect(await countById('maintenance_reminders', 'schedule_id', t.schId)).toBe(0);
    expect(await countById('tickets', 'asset_id', t.assetId)).toBe(0);
    expect(await countById('ticket_comments', 'ticket_id', t.ticketId)).toBe(0);

    // The category/subcategory themselves must remain (asset delete is scoped to the asset).
    expect(await countById('asset_categories', 'id', t.catId)).toBe(1);
    expect(await countById('asset_subcategories', 'id', t.subId)).toBe(1);

    // Cleanup the category used by this test (its asset is already gone).
    await sql`DELETE FROM asset_code_counters WHERE category_id = ${t.catId}`;
    await sql`DELETE FROM asset_subcategories WHERE id = ${t.subId}`;
    await sql`DELETE FROM asset_categories WHERE id = ${t.catId}`;
  });
});
