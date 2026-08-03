import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as assetSvc from '@/modules/assets/asset.service';
import * as maintSvc from '@/modules/maintenance/maintenance.service';
import { repo as maintRepo } from '@/modules/maintenance/maintenance.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
let adminId: string;
let assetId: string;
let catId: string;
let subId: string;
const maintIds: string[] = [];

beforeAll(async () => {
  const rows = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = rows[0].id as string;
  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'QA_MC', 'QA Maint Cat', true, now(), now()) RETURNING id`;
  catId = cat[0].id;
  const sub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, 'QA_MS', 'QA Maint Sub', true, now(), now()) RETURNING id`;
  subId = sub[0].id;
  const asset = await assetSvc.create({ assetName: 'QA Maint Asset', categoryId: catId, subcategoryId: subId, condition: 'GOOD', status: 'AVAILABLE' }, adminId);
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

async function createMaintenance(): Promise<string> {
  const rec = await maintSvc.create({ assetId, maintenanceCategory: 'CORRECTIVE', problem: 'QA problem', priority: 'HIGH' }, adminId);
  const id = rec.id as string;
  maintIds.push(id);
  return id;
}

describe('Maintenance workflow', () => {
  it('creates a maintenance record in OPEN state', async () => {
    const id = await createMaintenance();
    const rec = await maintRepo.findById(id);
    expect(rec.status).toBe('OPEN');
  });

  it('rejects completing from OPEN (invalid transition)', async () => {
    const id = await createMaintenance();
    await expect(maintSvc.complete(id, { result: 'x', condition: 'GOOD' }, adminId)).rejects.toThrow('Cannot transition from OPEN to COMPLETED');
  });

  it('runs the full happy-path workflow', async () => {
    const id = await createMaintenance();
    await maintSvc.assign(id, { technicianId: adminId }, adminId);
    expect((await maintRepo.findById(id)).status).toBe('ASSIGNED');

    await maintSvc.start(id);
    expect((await maintRepo.findById(id)).status).toBe('IN_PROGRESS');

    await maintSvc.waitingPart(id, { reason: 'No stock' });
    expect((await maintRepo.findById(id)).status).toBe('WAITING_PART');

    await maintSvc.start(id);
    expect((await maintRepo.findById(id)).status).toBe('IN_PROGRESS');

    await maintSvc.testing(id);
    expect((await maintRepo.findById(id)).status).toBe('TESTING');

    const completed = await maintSvc.complete(id, { result: 'Fixed', condition: 'GOOD', diagnosis: 'Battery', actionTaken: 'Replaced' }, adminId);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.finishDate).toBeTruthy();
  });

  it('updates the asset condition on completion', async () => {
    const id = await createMaintenance();
    await maintSvc.assign(id, { technicianId: adminId }, adminId);
    await maintSvc.start(id);
    await maintSvc.testing(id);
    await maintSvc.complete(id, { condition: 'GOOD', result: 'ok' }, adminId);
    const asset = await assetSvc.getById(assetId);
    expect(asset.condition).toBe('GOOD');
    const history = await assetSvc.getConditionHistory(assetId);
    expect(history.some((h) => h.reason?.includes('completed'))).toBe(true);
  });

  it('supports cancellation', async () => {
    const id = await createMaintenance();
    const cancelled = await maintSvc.cancel(id, { reason: 'Duplicate' });
    expect(cancelled.status).toBe('CANCELLED');
  });

  it('rejects starting a completed maintenance', async () => {
    const id = await createMaintenance();
    await maintSvc.assign(id, { technicianId: adminId }, adminId);
    await maintSvc.start(id);
    await maintSvc.testing(id);
    await maintSvc.complete(id, { result: 'ok', condition: 'GOOD' }, adminId);
    await expect(maintSvc.start(id)).rejects.toThrow('Cannot transition from COMPLETED to IN_PROGRESS');
  });
});
