import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as svc from '@/modules/cctv/cctv.service';
import * as assetSvc from '@/modules/assets/asset.service';
import * as assetRepo from '@/modules/assets/asset.repository';

/**
 * CCTV devices are now created from an Asset Inventory item: the Asset is the
 * source of truth for name, brand, model, subcategory and integration protocol.
 * Only CCTV / DVR / NVR assets are eligible, and an asset can back only one
 * device. This suite exercises that contract end to end against the DB.
 */
const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let adminId: string;
let catId: string;
let cctvSubId: string;
let dvrSubId: string;
let nvrSubId: string;
let laptopSubId: string;
let brandId: string;

let dvrAssetId: string;
let cctvAssetId: string;
let nvrAssetId: string;
let spareDvrAssetId: string;
let freshCctvAssetId: string;
let laptopAssetId: string;

let dvrDeviceId: string;

function ip(host: number): string {
  return `10.77.${Math.floor(Math.random() * 250)}.${host}`;
}

async function createAsset(
  name: string,
  subId: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const asset = await assetSvc.create(
    {
      assetName: name,
      categoryId: catId,
      subcategoryId: subId,
      condition: 'GOOD',
      status: 'AVAILABLE',
      serialNumber: `${name}-${RUN}-${Math.random()}`,
      ...extra,
    },
    adminId,
  );
  return asset.id as string;
}

beforeAll(async () => {
  const admin = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = admin[0].id as string;

  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${`QAC${RUN}`}, 'QA CCTV Asset Cat', true, now(), now()) RETURNING id`;
  catId = cat[0].id as string;

  const cctvSub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, ${`CV${RUN}`}, 'CCTV', true, now(), now()) RETURNING id`;
  cctvSubId = cctvSub[0].id as string;
  const dvrSub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, ${`DV${RUN}`}, 'DVR', true, now(), now()) RETURNING id`;
  dvrSubId = dvrSub[0].id as string;
  const nvrSub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, ${`NV${RUN}`}, 'NVR', true, now(), now()) RETURNING id`;
  nvrSubId = nvrSub[0].id as string;
  const laptopSub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, ${`LP${RUN}`}, 'Laptop', true, now(), now()) RETURNING id`;
  laptopSubId = laptopSub[0].id as string;

  const brand = await sql`INSERT INTO brands (id, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${`Hikvision ${RUN}`}, true, now(), now()) RETURNING id`;
  brandId = brand[0].id as string;

  dvrAssetId = await createAsset(`Embedded Net DVR ${RUN}`, dvrSubId, {
    brandId,
    model: 'DS-7216HGHI-K1',
  });
  cctvAssetId = await createAsset(`CCTV TIMUR ${RUN}`, cctvSubId);
  nvrAssetId = await createAsset(`NVR XMEYE ${RUN}`, nvrSubId);
  spareDvrAssetId = await createAsset(`Spare DVR ${RUN}`, dvrSubId);
  freshCctvAssetId = await createAsset(`Fresh CCTV ${RUN}`, cctvSubId);
  laptopAssetId = await createAsset(`Laptop ${RUN}`, laptopSubId);
});

afterAll(async () => {
  await sql`DELETE FROM cctv_devices WHERE asset_id IN (${dvrAssetId}, ${cctvAssetId}, ${nvrAssetId}, ${spareDvrAssetId}, ${freshCctvAssetId}, ${laptopAssetId})`;
  for (const asset of [dvrAssetId, cctvAssetId, nvrAssetId, spareDvrAssetId, freshCctvAssetId, laptopAssetId]) {
    if (!asset) continue;
    await sql`DELETE FROM asset_condition_history WHERE asset_id = ${asset}`;
    await sql`DELETE FROM assets WHERE id = ${asset}`;
  }
  await sql`DELETE FROM asset_code_counters WHERE subcategory_id IN (${cctvSubId}, ${dvrSubId}, ${nvrSubId}, ${laptopSubId})`;
  await sql`DELETE FROM asset_subcategories WHERE id IN (${cctvSubId}, ${dvrSubId}, ${nvrSubId}, ${laptopSubId})`;
  await sql`DELETE FROM brands WHERE id = ${brandId}`;
  await sql`DELETE FROM asset_categories WHERE id = ${catId}`;
  await sql.end();
});

describe('cctv device created from an Asset', () => {
  it('derives name, brand, model, subcategory and ISAPI protocol from a DVR asset', async () => {
    const created = await svc.create({
      assetId: dvrAssetId,
      ipAddress: ip(1),
      port: 80,
      location: 'Ruang QA',
    });
    dvrDeviceId = created!.id as string;

    expect(created!.assetId).toBe(dvrAssetId);
    expect(created!.name).toBe(`Embedded Net DVR ${RUN}`);
    expect(created!.brand).toBe(`Hikvision ${RUN}`);
    expect(created!.model).toBe('DS-7216HGHI-K1');
    expect(created!.subcategoryName).toBe('DVR');
    expect(created!.integrationProtocol).toBe('ISAPI');
    expect(created!.location).toBe('Ruang QA');
  });

  it('maps a CCTV asset to ONVIF', async () => {
    const created = await svc.create({ assetId: cctvAssetId, ipAddress: ip(2) });
    expect(created!.subcategoryName).toBe('CCTV');
    expect(created!.integrationProtocol).toBe('ONVIF');
    expect(created!.name).toBe(`CCTV TIMUR ${RUN}`);
  });

  it('maps an NVR asset to ONVIF', async () => {
    const created = await svc.create({ assetId: nvrAssetId, ipAddress: ip(3) });
    expect(created!.integrationProtocol).toBe('ONVIF');
  });

  it('rejects an asset whose subcategory is not CCTV/DVR/NVR', async () => {
    await expect(svc.create({ assetId: laptopAssetId, ipAddress: ip(4) })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('rejects an asset already linked to another device', async () => {
    await expect(svc.create({ assetId: dvrAssetId, ipAddress: ip(5) })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('returns a derived preview for an eligible asset', async () => {
    const preview = await svc.getAssetPreview(spareDvrAssetId);
    expect(preview.deviceName).toBe(`Spare DVR ${RUN}`);
    expect(preview.subcategoryName).toBe('DVR');
    expect(preview.integrationProtocol).toBe('ISAPI');
  });

  it('re-derives the device fields when the asset changes', async () => {
    const updated = await svc.update(dvrDeviceId, { assetId: spareDvrAssetId });
    expect(updated!.assetId).toBe(spareDvrAssetId);
    expect(updated!.name).toBe(`Spare DVR ${RUN}`);
  });

  it('only returns CCTV-eligible, unused assets from the asset list filter', async () => {
    const eligible = await assetRepo.findAssets({ cctvEligible: true, limit: 100 });
    const ids = eligible.data.map((a) => a.id);
    expect(ids).toContain(freshCctvAssetId);
    expect(ids).not.toContain(laptopAssetId);
    expect(ids).not.toContain(spareDvrAssetId); // linked to dvrDeviceId
  });
});
