import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as assetSvc from '@/modules/assets/asset.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
let adminId: string;
let catId: string;
let subId: string;
const assetIds: string[] = [];

beforeAll(async () => {
  const rows = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = rows[0].id as string;
  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'QA_QR', 'QA QR Cat', true, now(), now()) RETURNING id`;
  catId = cat[0].id;
  const sub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, 'QA_QR_S', 'QA QR Sub', true, now(), now()) RETURNING id`;
  subId = sub[0].id;
});

afterAll(async () => {
  for (const id of assetIds) {
    await sql`DELETE FROM asset_condition_history WHERE asset_id = ${id}`;
    await sql`DELETE FROM assets WHERE id = ${id}`;
  }
  await sql`DELETE FROM asset_code_counters WHERE category_id = ${catId} AND subcategory_id = ${subId}`;
  await sql`DELETE FROM asset_subcategories WHERE id = ${subId}`;
  await sql`DELETE FROM asset_categories WHERE id = ${catId}`;
  await sql.end();
});

async function makeAsset(name: string) {
  const asset = await assetSvc.create({ assetName: name, categoryId: catId, subcategoryId: subId, condition: 'GOOD', status: 'AVAILABLE' }, adminId);
  assetIds.push(asset.id as string);
  return asset;
}

describe('QR system', () => {
  it('exposes the asset code as the QR value', async () => {
    const a = await makeAsset('QA QR One');
    expect(a.assetCode).toMatch(/^AST-QA_QR-QA_QR_S-\d{4}$/);
    // manual lookup by code
    const found = await assetSvc.getByCode(a.assetCode as string);
    expect(found.id).toBe(a.id);
  });

  it('generates unique codes for distinct assets', async () => {
    const a = await makeAsset('QA QR Two');
    const b = await makeAsset('QA QR Three');
    expect(a.assetCode).not.toBe(b.assetCode);
  });

  it('rejects an invalid QR lookup', async () => {
    await expect(assetSvc.getByCode('AST-NOPE-000000')).rejects.toThrow('Asset not found.');
  });
});
