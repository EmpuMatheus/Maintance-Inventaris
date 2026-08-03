import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as assetSvc from '@/modules/assets/asset.service';
import * as maintSvc from '@/modules/maintenance/maintenance.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const maintIds: string[] = [];
let adminId: string;
let assetId: string;
let catId: string;
let subId: string;

async function runToTesting(): Promise<string> {
  const rec = await maintSvc.create({ assetId, maintenanceCategory: 'CORRECTIVE', problem: 'tx', priority: 'MEDIUM' }, adminId);
  const id = rec.id as string;
  maintIds.push(id);
  await maintSvc.assign(id, { technicianId: adminId }, adminId);
  await maintSvc.start(id);
  await maintSvc.testing(id);
  return id;
}

beforeAll(async () => {
  const rows = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = rows[0].id as string;
  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'QA_TX', 'QA Tx Cat', true, now(), now()) RETURNING id`;
  catId = cat[0].id;
  const sub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, 'QA_TS', 'QA Tx Sub', true, now(), now()) RETURNING id`;
  subId = sub[0].id;
  const asset = await assetSvc.create({ assetName: 'QA Tx Asset', categoryId: catId, subcategoryId: subId, condition: 'FAIR', status: 'AVAILABLE' }, adminId);
  assetId = asset.id as string;
});

afterAll(async () => {
  for (const id of maintIds) {
    await sql`DELETE FROM maintenance_parts WHERE maintenance_id = ${id}`;
    await sql`DELETE FROM maintenance_documents WHERE maintenance_id = ${id}`;
    await sql`DELETE FROM maintenance_schedule_logs WHERE maintenance_id = ${id}`;
    await sql`DELETE FROM maintenance_reminders WHERE maintenance_id = ${id}`;
    await sql`DELETE FROM maintenance_records WHERE id = ${id}`;
  }
  await sql`DELETE FROM asset_condition_history WHERE asset_id = ${assetId}`;
  await sql`DELETE FROM assets WHERE id = ${assetId}`;
  await sql`DELETE FROM asset_code_counters WHERE category_id = ${catId} AND subcategory_id = ${subId}`;
  await sql`DELETE FROM asset_subcategories WHERE id = ${subId}`;
  await sql`DELETE FROM asset_categories WHERE id = ${catId}`;
  await sql.end();
});

describe('Maintenance transaction', () => {
  it('completing maintenance atomically updates the asset and creates history', async () => {
    const id = await runToTesting();
    const completed = await maintSvc.complete(id, { diagnosis: 'D', actionTaken: 'A', result: 'R', condition: 'GOOD' }, adminId);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.diagnosis).toBe('D');
    expect(completed.actionTaken).toBe('A');
    expect(completed.finishDate).toBeTruthy();

    const asset = await assetSvc.getById(assetId);
    expect(asset.condition).toBe('GOOD');
    const history = await assetSvc.getConditionHistory(assetId);
    const last = history[0];
    expect(last.previousCondition).toBe('FAIR');
    expect(last.newCondition).toBe('GOOD');
  });

  it('rejects completing the same maintenance twice', async () => {
    const id = await runToTesting();
    await maintSvc.complete(id, { result: 'ok', condition: 'GOOD' }, adminId);
    await expect(maintSvc.complete(id, { result: 'again', condition: 'GOOD' }, adminId)).rejects.toThrow('Cannot transition from COMPLETED to COMPLETED');
  });
});
