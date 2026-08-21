import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as assetSvc from '@/modules/assets/asset.service';
import * as assignmentSvc from '@/modules/assets/assignment.service';
import * as maintenanceSvc from '@/modules/maintenance/maintenance.service';
import * as ticketSvc from '@/modules/tickets/ticket.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36).toUpperCase();

let adminId: string;
let categoryId: string;
let subcategoryId: string;
let assetId: string;
let assetCode: string;
let secondAssetId: string;

beforeAll(async () => {
  const admin = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = admin[0].id as string;

  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${'QA_RT_CAT' + RUN}, ${'QA Retire Category ' + RUN}, true, now(), now()) RETURNING id`;
  categoryId = cat[0].id;
  const sub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${categoryId}, ${'QA_RT_SUB' + RUN}, ${'QA Retire Sub ' + RUN}, true, now(), now()) RETURNING id`;
  subcategoryId = sub[0].id;
});

afterAll(async () => {
  for (const id of [assetId, secondAssetId]) {
    if (id) {
      await sql`DELETE FROM asset_condition_history WHERE asset_id = ${id}`;
      await sql`DELETE FROM asset_assignments WHERE asset_id = ${id}`;
      await sql`DELETE FROM asset_movements WHERE asset_id = ${id}`;
      await sql`DELETE FROM assets WHERE id = ${id}`;
    }
  }
  await sql`DELETE FROM asset_code_counters WHERE category_id = ${categoryId} AND subcategory_id = ${subcategoryId}`;
  await sql`DELETE FROM asset_subcategories WHERE id = ${subcategoryId}`;
  await sql`DELETE FROM asset_categories WHERE id = ${categoryId}`;
  await sql.end();
});

describe('Asset Retire', () => {
  it('retires an asset with a reason and note', async () => {
    const asset = await assetSvc.create({ assetName: 'QA Retire Laptop', categoryId, subcategoryId, condition: 'GOOD', status: 'AVAILABLE', serialNumber: 'QA-RT-001' }, adminId);
    assetId = asset.id as string;
    assetCode = asset.assetCode as string;

    const result = await assetSvc.retire(assetId, { reason: 'BROKEN', notes: 'Screen shattered' }, adminId, 'Admin');
    expect(result.status).toBe('RETIRED');
    expect(result.retireReason).toBe('BROKEN');
    expect(result.retireNote).toBe('Screen shattered');
    expect(result.retiredBy).toBe(adminId);
    expect(result.retiredAt).toBeTruthy();
    expect(result.retiredByName).toBe('Admin');
  });

  it('requires a valid reason', async () => {
    const asset = await assetSvc.create({ assetName: 'QA Retire Bad Reason', categoryId, subcategoryId, condition: 'GOOD', status: 'AVAILABLE', serialNumber: 'QA-RT-003' }, adminId);
    await expect(assetSvc.retire(asset.id as string, { reason: 'BOGUS' }, adminId)).rejects.toThrow('Invalid retire reason');
    await expect(assetSvc.retire(asset.id as string, { notes: 'no reason' }, adminId)).rejects.toThrow('Retire reason is required.');
    await sql`DELETE FROM asset_condition_history WHERE asset_id = ${asset.id as string}`;
    await sql`DELETE FROM assets WHERE id = ${asset.id as string}`;
  });

  it('rejects retiring an already-retired asset', async () => {
    await expect(assetSvc.retire(assetId, { reason: 'SOLD' }, adminId)).rejects.toThrow('Asset is already retired.');
  });

  it('hides retired assets from the inventory list by default', async () => {
    const list = await assetSvc.list({ page: 1, limit: 100, search: 'QA Retire Laptop' });
    expect(list.data.some((a) => a.id === assetId)).toBe(false);
  });

  it('still exposes retired assets when explicitly filtered by status', async () => {
    const list = await assetSvc.list({ page: 1, limit: 100, status: 'RETIRED', search: 'QA Retire Laptop' });
    expect(list.data.some((a) => a.id === assetId)).toBe(true);
  });

  it('rejects maintenance creation for a retired asset with 409', async () => {
    await expect(
      maintenanceSvc.create({ assetId, maintenanceCategory: 'CORRECTIVE', problem: 'QA', priority: 'MEDIUM' }, adminId),
    ).rejects.toThrow('Cannot create maintenance for a retired asset.');
  });

  it('rejects ticket creation for a retired asset with 409', async () => {
    await expect(
      ticketSvc.create({ title: 'QA retired ticket', assetId, priority: 'MEDIUM' }, { id: adminId, username: 'admin', name: 'Admin', roles: ['SUPER_ADMIN'], permissions: ['asset.read', 'ticket.create'] }),
    ).rejects.toThrow('Cannot create a ticket for a retired asset.');
  });

  it('rejects assignment for a retired asset with 409', async () => {
    const { assign } = await import('@/modules/assets/assignment.service');
    await expect(assign(assetId, { userId: adminId }, adminId, 'Admin')).rejects.toThrow('Cannot assign a retired asset.');
  });

  it('non-retired assets remain assignable', async () => {
    const { assign } = await import('@/modules/assets/assignment.service');
    const asset = await assetSvc.create({ assetName: 'QA Active Laptop', categoryId, subcategoryId, condition: 'GOOD', status: 'AVAILABLE', serialNumber: 'QA-RT-002' }, adminId);
    secondAssetId = asset.id as string;
    const result = await assign(secondAssetId, { userId: adminId }, adminId, 'Admin');
    expect(result.status).toBe('ACTIVE');
  });
});

describe('Asset permanent delete', () => {
  let delAssetId: string;
  let delCategoryId: string;
  let delSubcategoryId: string;

  beforeAll(async () => {
    const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${'QA_RTD_CAT' + RUN}, ${'QA Retire Del Category ' + RUN}, true, now(), now()) RETURNING id`;
    delCategoryId = cat[0].id;
    const sub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${delCategoryId}, ${'QA_RTD_SUB' + RUN}, ${'QA Retire Del Sub ' + RUN}, true, now(), now()) RETURNING id`;
    delSubcategoryId = sub[0].id;
  });

  afterAll(async () => {
    if (delAssetId) {
      await sql`DELETE FROM asset_code_counters WHERE category_id = ${delCategoryId} AND subcategory_id = ${delSubcategoryId}`;
    }
  });

  it('permanently deletes an asset and its child records', async () => {
    const asset = await assetSvc.create({ assetName: 'QA Delete Me', categoryId: delCategoryId, subcategoryId: delSubcategoryId, condition: 'GOOD', status: 'AVAILABLE', serialNumber: 'QA-RT-DEL-001' }, adminId);
    delAssetId = asset.id as string;

    await assignmentSvc.assign(delAssetId, { userId: adminId }, adminId, 'Admin');
    await assetSvc.updateCondition(delAssetId, { condition: 'FAIR', reason: 'QA' }, adminId, 'Admin');

    const result = await assetSvc.deletePermanently(delAssetId, adminId, 'Admin');
    expect(result.success).toBe(true);
    expect(result.assetCode).toBe(asset.assetCode as string);

    const rows = await sql`SELECT id FROM assets WHERE id = ${delAssetId}`;
    expect(rows.length).toBe(0);
    const children = await sql`SELECT (SELECT count(*) FROM asset_assignments WHERE asset_id = ${delAssetId}) + (SELECT count(*) FROM asset_condition_history WHERE asset_id = ${delAssetId}) + (SELECT count(*) FROM asset_movements WHERE asset_id = ${delAssetId}) + (SELECT count(*) FROM asset_documents WHERE asset_id = ${delAssetId}) AS n`;
    expect(Number(children[0].n)).toBe(0);
  });

  it('a deleted asset no longer blocks category deletion', async () => {
    // After permanent delete, no live asset references the category anymore.
    const refs = await sql`SELECT count(*) AS n FROM assets WHERE category_id = ${delCategoryId} AND deleted_at IS NULL`;
    expect(Number(refs[0].n)).toBe(0);
    // The category (and its subcategory) can now be removed.
    await sql`DELETE FROM asset_subcategories WHERE id = ${delSubcategoryId}`;
    await sql`DELETE FROM asset_categories WHERE id = ${delCategoryId}`;
    const after = await sql`SELECT id FROM asset_categories WHERE id = ${delCategoryId}`;
    expect(after.length).toBe(0);
  });
});
