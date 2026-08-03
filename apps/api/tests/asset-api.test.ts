import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as assetSvc from '@/modules/assets/asset.service';
import * as assignmentSvc from '@/modules/assets/assignment.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });

let adminId: string;
let categoryId: string;
let subcategoryId: string;
let siteId: string;
let buildingId: string;
let floorId: string;
let roomId: string;
let assetId: string;
let assetCode: string;

beforeAll(async () => {
  const rows = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = rows[0].id as string;

  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'QA_CAT', 'QA Category', true, now(), now()) RETURNING id`;
  categoryId = cat[0].id;
  const sub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${categoryId}, 'QA_SUB', 'QA Sub', true, now(), now()) RETURNING id`;
  subcategoryId = sub[0].id;
  const site = await sql`INSERT INTO sites (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'QA_SITE', 'QA Site', true, now(), now()) RETURNING id`;
  siteId = site[0].id;
  const bldg = await sql`INSERT INTO buildings (id, site_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${siteId}, 'QA_B', 'QA Building', true, now(), now()) RETURNING id`;
  buildingId = bldg[0].id;
  const flr = await sql`INSERT INTO floors (id, building_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${buildingId}, 'QA_F', 'QA Floor', true, now(), now()) RETURNING id`;
  floorId = flr[0].id;
  const room = await sql`INSERT INTO rooms (id, floor_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${floorId}, 'QA_R', 'QA Room', true, now(), now()) RETURNING id`;
  roomId = room[0].id;
});

afterAll(async () => {
  await sql`DELETE FROM asset_condition_history WHERE asset_id = ${assetId}`;
  await sql`DELETE FROM asset_assignments WHERE asset_id = ${assetId}`;
  await sql`DELETE FROM asset_movements WHERE asset_id = ${assetId}`;
  await sql`DELETE FROM assets WHERE id = ${assetId}`;
  await sql`DELETE FROM asset_code_counters WHERE category_id = ${categoryId} AND subcategory_id = ${subcategoryId}`;
  await sql`DELETE FROM rooms WHERE id = ${roomId}`;
  await sql`DELETE FROM floors WHERE id = ${floorId}`;
  await sql`DELETE FROM buildings WHERE id = ${buildingId}`;
  await sql`DELETE FROM sites WHERE id = ${siteId}`;
  await sql`DELETE FROM asset_subcategories WHERE id = ${subcategoryId}`;
  await sql`DELETE FROM asset_categories WHERE id = ${categoryId}`;
  await sql.end();
});

describe('Asset API', () => {
  it('creates an asset with a generated code', async () => {
    const asset = await assetSvc.create(
      { assetName: 'QA Laptop', categoryId, subcategoryId, condition: 'GOOD', status: 'AVAILABLE', serialNumber: 'QA-001' },
      adminId,
    );
    assetId = asset.id as string;
    assetCode = asset.assetCode as string;
    expect(assetCode).toMatch(/^AST-QA_CAT-QA_SUB-\d{4}$/);
  });

  it('gets the asset by id', async () => {
    const asset = await assetSvc.getById(assetId);
    expect(asset.assetCode).toBe(assetCode);
    expect(asset.assetName).toBe('QA Laptop');
  });

  it('looks up the asset by code (QR value)', async () => {
    const asset = await assetSvc.getByCode(assetCode);
    expect(asset.id).toBe(assetId);
  });

  it('searches and paginates the asset list', async () => {
    const page = await assetSvc.list({ search: 'QA Laptop', page: 1, limit: 10 });
    expect(page.data.some((a) => a.id === assetId)).toBe(true);
    const filtered = await assetSvc.list({ search: 'nonexistent-asset-xyz', page: 1, limit: 10 });
    expect(filtered.data.some((a) => a.id === assetId)).toBe(false);
  });

  it('updates the asset', async () => {
    const updated = await assetSvc.update(assetId, { assetName: 'QA Laptop Pro', notes: 'updated' });
    expect(updated.assetName).toBe('QA Laptop Pro');
  });

  it('updates the condition and records history', async () => {
    const result = await assetSvc.updateCondition(assetId, { condition: 'FAIR', reason: 'QA test' }, adminId, 'Admin');
    expect(result.newCondition).toBe('FAIR');
    const history = await assetSvc.getConditionHistory(assetId);
    expect(history.some((h) => h.previousCondition === 'GOOD' && h.newCondition === 'FAIR')).toBe(true);
  });

  it('assigns the asset to a user', async () => {
    const result = await assignmentSvc.assign(assetId, { userId: adminId }, adminId, 'Admin');
    expect(result.status).toBe('ACTIVE');
    const history = await assignmentSvc.getAssignmentHistory(assetId);
    expect(history.length).toBeGreaterThan(0);
  });

  it('transfers the asset to a new location', async () => {
    const result = await assignmentSvc.transfer(assetId, { siteId, buildingId, floorId, roomId }, adminId, 'Admin');
    expect(result).toBeTruthy();
    const movements = await assignmentSvc.getMovementHistory(assetId);
    expect(movements.length).toBeGreaterThan(0);
  });

  it('returns 404 for an unknown asset', async () => {
    await expect(assetSvc.getById('00000000-0000-0000-0000-000000000000')).rejects.toThrow('Asset not found.');
  });
});
