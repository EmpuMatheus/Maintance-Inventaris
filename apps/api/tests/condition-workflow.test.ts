import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as assetSvc from '@/modules/assets/asset.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
let adminId: string;
let assetId: string;
let catId: string;
let subId: string;

beforeAll(async () => {
  const rows = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = rows[0].id as string;
  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'QA_CC', 'QA Cond Cat', true, now(), now()) RETURNING id`;
  catId = cat[0].id;
  const sub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, 'QA_CS', 'QA Cond Sub', true, now(), now()) RETURNING id`;
  subId = sub[0].id;
  const asset = await assetSvc.create({ assetName: 'QA Cond Asset', categoryId: catId, subcategoryId: subId, condition: 'GOOD', status: 'AVAILABLE' }, adminId);
  assetId = asset.id as string;
});

afterAll(async () => {
  await sql`DELETE FROM asset_condition_history WHERE asset_id = ${assetId}`;
  await sql`DELETE FROM assets WHERE id = ${assetId}`;
  await sql`DELETE FROM asset_code_counters WHERE category_id = ${catId} AND subcategory_id = ${subId}`;
  await sql`DELETE FROM asset_subcategories WHERE id = ${subId}`;
  await sql`DELETE FROM asset_categories WHERE id = ${catId}`;
  await sql.end();
});

describe('Condition workflow', () => {
  it('rejects an identical condition', async () => {
    await expect(assetSvc.updateCondition(assetId, { condition: 'GOOD', reason: 'same' }, adminId)).rejects.toThrow('already has this condition');
  });

  it('transitions GOOD -> FAIR -> NEED_ATTENTION -> BROKEN -> CRITICAL', async () => {
    for (const cond of ['FAIR', 'NEED_ATTENTION', 'BROKEN', 'CRITICAL']) {
      const r = await assetSvc.updateCondition(assetId, { condition: cond, reason: `to ${cond}` }, adminId, 'Admin');
      expect(r.newCondition).toBe(cond);
    }
  });

  it('records full history', async () => {
    const history = await assetSvc.getConditionHistory(assetId);
    const seq = history.map((h) => h.newCondition);
    expect(seq).toEqual(expect.arrayContaining(['FAIR', 'NEED_ATTENTION', 'BROKEN', 'CRITICAL']));
  });

  it('rejects the RETIRED condition via generic update', async () => {
    await expect(assetSvc.updateCondition(assetId, { condition: 'RETIRED', reason: 'x' }, adminId)).rejects.toThrow('dedicated retirement workflow');
  });
});
