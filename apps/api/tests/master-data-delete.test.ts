import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as mdSvc from '@/modules/master-data/master-data.service';
import * as mdRepo from '@/modules/master-data/master-data.repository';
import { deactivate } from '@/modules/master-data/master-data.controller';
import * as assetSvc from '@/modules/assets/asset.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });

let adminId: string;
let refCatId: string;
let refSubId: string;
let assetId: string;
let freeCatId: string;
let brandId: string;

async function waitForAudit(entityId: string): Promise<boolean> {
  for (let i = 0; i < 60; i += 1) {
    const rows = await sql`
      SELECT id FROM audit_logs
      WHERE module = 'MASTER_DATA' AND action = 'DELETE' AND entity_type = 'asset_category' AND entity_id = ${entityId}
      LIMIT 1
    `;
    if (rows.length > 0) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

beforeAll(async () => {
  const admin = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = admin[0].id as string;
});

afterAll(async () => {
  if (assetId) {
    await sql`DELETE FROM asset_condition_history WHERE asset_id = ${assetId}`;
    await sql`DELETE FROM assets WHERE id = ${assetId}`;
  }
  if (refSubId) await sql`DELETE FROM asset_subcategories WHERE id = ${refSubId}`;
  if (refCatId) {
    await sql`DELETE FROM asset_code_counters WHERE category_id = ${refCatId}`;
    await sql`DELETE FROM asset_categories WHERE id = ${refCatId}`;
  }
  if (brandId) await sql`DELETE FROM brands WHERE id = ${brandId}`;
  await sql`DELETE FROM audit_logs WHERE entity_id IN (${refCatId}, ${freeCatId})`;
  await sql.end();
});

describe('Master data: category cleanup', () => {
  it('deletes a category even when it has a real asset with child records', async () => {
    const cat = await mdRepo.create('categories', { code: 'QA_REF', name: 'QA Referenced Category' });
    refCatId = cat.id as string;
    const sub = await mdRepo.create('subcategories', { categoryId: refCatId, code: 'QA_REF_SUB', name: 'QA Ref Sub' });
    refSubId = sub.id as string;

    // A real asset (via the service) always has an asset_condition_history row.
    const asset = await assetSvc.create(
      { assetName: 'QA Ref Asset', categoryId: refCatId, subcategoryId: refSubId, condition: 'GOOD', status: 'AVAILABLE', serialNumber: 'QA-REF-001' },
      adminId,
    );
    assetId = asset.id as string;

    // Asset child records are cleaned up first, then PostgreSQL CASCADE removes
    // the subcategory and the asset. No FK error, no 500.
    await mdSvc.deactivate('categories', refCatId);

    expect((await sql`SELECT id FROM asset_categories WHERE id = ${refCatId}`).length).toBe(0);
    expect((await sql`SELECT id FROM asset_subcategories WHERE id = ${refSubId}`).length).toBe(0);
    expect((await sql`SELECT id FROM assets WHERE id = ${assetId}`).length).toBe(0);
    expect(Number((await sql`SELECT count(*) AS n FROM asset_condition_history WHERE asset_id = ${assetId}`)[0].n)).toBe(0);
  });

  it('deletes an unreferenced category and records an audit log', async () => {
    const cat = await mdRepo.create('categories', { code: 'QA_FREE', name: 'QA Unreferenced Category' });
    freeCatId = cat.id as string;

    const handler = deactivate('categories');
    let result: { success: boolean } | undefined;
    const req = {
      params: { id: freeCatId },
      user: { id: adminId, username: 'admin', name: 'Admin', roles: ['SUPER_ADMIN'], permissions: [] },
      ip: '127.0.0.1',
      headers: {},
    } as any;
    const res = { json: (body: { success: boolean }) => { result = body; } } as any;

    await handler(req, res, () => {});

    expect(result?.success).toBe(true);
    const rows = await sql`SELECT id FROM asset_categories WHERE id = ${freeCatId}`;
    expect(rows.length).toBe(0);
    expect(await waitForAudit(freeCatId)).toBe(true);
  });

  it('keeps soft-deactivation for other resources', async () => {
    const brand = await mdRepo.create('brands', { name: 'QA Soft Delete Brand' });
    brandId = brand.id as string;
    await mdSvc.deactivate('brands', brandId);
    const rows = await sql`SELECT is_active FROM brands WHERE id = ${brandId}`;
    expect(rows[0].is_active).toBe(false);
  });

  it('subcategory list and getById return the owning category name', async () => {
    const RUN = Date.now().toString(36).toUpperCase();
    const cat = await mdRepo.create('categories', { code: 'QA_CATN' + RUN, name: 'QA Category Name' });
    const sub = await mdRepo.create('subcategories', { categoryId: cat.id, code: 'QA_SUBN' + RUN, name: 'QA Sub Name' });

    const list = await mdRepo.list('subcategories', { search: 'QA_SUBN' + RUN, limit: 10 });
    const listed = list.data.find((r) => r.id === sub.id);
    expect(listed?.category).toBe('QA Category Name');
    expect(listed?.categoryId).toBe(cat.id);

    const byId = await mdRepo.getById('subcategories', sub.id as string);
    expect(byId?.category).toBe('QA Category Name');

    await sql`DELETE FROM asset_subcategories WHERE id = ${sub.id}`;
    await sql`DELETE FROM asset_categories WHERE id = ${cat.id}`;
  });
});
