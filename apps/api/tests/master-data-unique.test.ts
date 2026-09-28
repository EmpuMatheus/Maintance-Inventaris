import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as mdSvc from '@/modules/master-data/master-data.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = `QA_UQ_${Date.now().toString(36).toUpperCase()}`;

let catAId: string;
let catBId: string;
let siteAId: string;
let siteBId: string;
let buildingAId: string;
let buildingBId: string;
let floorAId: string;
let floorBId: string;

const DUPLICATE_CODE_MESSAGE = 'Code sudah digunakan pada parent yang dipilih.';

beforeAll(async () => {
  const catA = await mdSvc.create('categories', { code: `${RUN}_CA`, name: `${RUN} Cat A` });
  catAId = catA.id as string;
  const catB = await mdSvc.create('categories', { code: `${RUN}_CB`, name: `${RUN} Cat B` });
  catBId = catB.id as string;

  const siteA = await mdSvc.create('sites', { code: `${RUN}_SA`, name: `${RUN} Site A` });
  siteAId = siteA.id as string;
  const siteB = await mdSvc.create('sites', { code: `${RUN}_SB`, name: `${RUN} Site B` });
  siteBId = siteB.id as string;

  const bldA = await mdSvc.create('buildings', { siteId: siteAId, code: `${RUN}_BA`, name: `${RUN} Bld A` });
  buildingAId = bldA.id as string;
  const bldB = await mdSvc.create('buildings', { siteId: siteBId, code: `${RUN}_BB`, name: `${RUN} Bld B` });
  buildingBId = bldB.id as string;

  const flrA = await mdSvc.create('floors', { buildingId: buildingAId, code: `${RUN}_FA`, name: `${RUN} Flr A` });
  floorAId = flrA.id as string;
  const flrB = await mdSvc.create('floors', { buildingId: buildingBId, code: `${RUN}_FB`, name: `${RUN} Flr B` });
  floorBId = flrB.id as string;
});

afterAll(async () => {
  for (const siteId of [siteAId, siteBId]) {
    if (!siteId) continue;
    await sql`DELETE FROM rooms WHERE floor_id IN (SELECT id FROM floors WHERE building_id IN (SELECT id FROM buildings WHERE site_id = ${siteId}))`;
    await sql`DELETE FROM floors WHERE building_id IN (SELECT id FROM buildings WHERE site_id = ${siteId})`;
    await sql`DELETE FROM buildings WHERE site_id = ${siteId}`;
    await sql`DELETE FROM sites WHERE id = ${siteId}`;
  }
  for (const catId of [catAId, catBId]) {
    if (!catId) continue;
    await sql`DELETE FROM asset_subcategories WHERE category_id = ${catId}`;
    await sql`DELETE FROM asset_categories WHERE id = ${catId}`;
  }
  await sql.end();
});

describe('Master data: unique code by parent', () => {
  it('allows the same subcategory code in different categories', async () => {
    const a = await mdSvc.create('subcategories', { categoryId: catAId, code: 'SUBX', name: 'A' });
    const b = await mdSvc.create('subcategories', { categoryId: catBId, code: 'SUBX', name: 'B' });
    expect(a.code).toBe('SUBX');
    expect(b.code).toBe('SUBX');
  });

  it('rejects a duplicate subcategory code within the same category', async () => {
    await mdSvc.create('subcategories', { categoryId: catAId, code: 'SUBDUP', name: 'First' });
    await expect(
      mdSvc.create('subcategories', { categoryId: catAId, code: 'SUBDUP', name: 'Second' }),
    ).rejects.toMatchObject({ statusCode: 409, message: DUPLICATE_CODE_MESSAGE });
  });

  it('keeps the same subcategory code valid when editing itself', async () => {
    const sub = await mdSvc.create('subcategories', { categoryId: catAId, code: 'SUBSELF', name: 'Self' });
    const updated = await mdSvc.update('subcategories', sub.id as string, { code: 'SUBSELF', name: 'Self Renamed' });
    expect(updated.code).toBe('SUBSELF');
    expect(updated.name).toBe('Self Renamed');
  });

  it('rejects editing a subcategory to another record code in the same parent', async () => {
    const a = await mdSvc.create('subcategories', { categoryId: catAId, code: 'SUBE1', name: 'A' });
    await mdSvc.create('subcategories', { categoryId: catAId, code: 'SUBE2', name: 'B' });
    await expect(
      mdSvc.update('subcategories', a.id as string, { code: 'SUBE2' }),
    ).rejects.toMatchObject({ statusCode: 409, message: DUPLICATE_CODE_MESSAGE });
  });

  it('does not let an inactive record free up its code', async () => {
    const a = await mdSvc.create('subcategories', { categoryId: catAId, code: 'SUBINACT', name: 'A' });
    await mdSvc.setActive('subcategories', a.id as string, false);
    await expect(
      mdSvc.create('subcategories', { categoryId: catAId, code: 'SUBINACT', name: 'B' }),
    ).rejects.toMatchObject({ statusCode: 409, message: DUPLICATE_CODE_MESSAGE });
    // The inactive holder is still readable and can be reactivated.
    await mdSvc.setActive('subcategories', a.id as string, true);
  });

  it('enforces site_id + code for buildings', async () => {
    const dup = await mdSvc.create('buildings', { siteId: siteAId, code: 'BLDX', name: 'One' });
    expect(dup.code).toBe('BLDX');
    // Different site is fine.
    const other = await mdSvc.create('buildings', { siteId: siteBId, code: 'BLDX', name: 'Two' });
    expect(other.code).toBe('BLDX');
    await expect(
      mdSvc.create('buildings', { siteId: siteAId, code: 'BLDX', name: 'Dup' }),
    ).rejects.toMatchObject({ statusCode: 409, message: DUPLICATE_CODE_MESSAGE });
  });

  it('enforces building_id + code for floors', async () => {
    await mdSvc.create('floors', { buildingId: buildingAId, code: 'FLRX', name: 'One' });
    const other = await mdSvc.create('floors', { buildingId: buildingBId, code: 'FLRX', name: 'Two' });
    expect(other.code).toBe('FLRX');
    await expect(
      mdSvc.create('floors', { buildingId: buildingAId, code: 'FLRX', name: 'Dup' }),
    ).rejects.toMatchObject({ statusCode: 409, message: DUPLICATE_CODE_MESSAGE });
  });

  it('enforces floor_id + code for rooms', async () => {
    await mdSvc.create('rooms', { floorId: floorAId, code: 'RMX', name: 'One' });
    const other = await mdSvc.create('rooms', { floorId: floorBId, code: 'RMX', name: 'Two' });
    expect(other.code).toBe('RMX');
    await expect(
      mdSvc.create('rooms', { floorId: floorAId, code: 'RMX', name: 'Dup' }),
    ).rejects.toMatchObject({ statusCode: 409, message: DUPLICATE_CODE_MESSAGE });
  });

  it('has composite unique constraints in the database as a final guard', async () => {
    const rows = await sql`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN (
        'asset_subcategories_category_id_code_unique',
        'buildings_site_id_code_unique',
        'floors_building_id_code_unique',
        'rooms_floor_id_code_unique'
      )
    `;
    expect(rows.length).toBe(4);
  });
});

describe('Master data: is_network_device on subcategories', () => {
  it('defaults to false when not provided', async () => {
    const sub = await mdSvc.create('subcategories', { categoryId: catAId, code: 'NETDEF', name: 'Default' });
    expect(sub.isNetworkDevice).toBe(false);
    const row = await sql`SELECT is_network_device FROM asset_subcategories WHERE id = ${sub.id}`;
    expect(row[0].is_network_device).toBe(false);
  });

  it('can be created as true', async () => {
    const sub = await mdSvc.create('subcategories', {
      categoryId: catAId,
      code: 'NETYES',
      name: 'Switch',
      isNetworkDevice: true,
    });
    expect(sub.isNetworkDevice).toBe(true);
    const row = await sql`SELECT is_network_device FROM asset_subcategories WHERE id = ${sub.id}`;
    expect(row[0].is_network_device).toBe(true);
  });

  it('can be edited false -> true and true -> false', async () => {
    const sub = await mdSvc.create('subcategories', {
      categoryId: catAId,
      code: 'NETTOG',
      name: 'Toggle',
      isNetworkDevice: false,
    });
    const on = await mdSvc.update('subcategories', sub.id as string, { isNetworkDevice: true });
    expect(on.isNetworkDevice).toBe(true);
    expect((await sql`SELECT is_network_device FROM asset_subcategories WHERE id = ${sub.id}`)[0].is_network_device).toBe(true);

    const off = await mdSvc.update('subcategories', sub.id as string, { isNetworkDevice: false });
    expect(off.isNetworkDevice).toBe(false);
    expect((await sql`SELECT is_network_device FROM asset_subcategories WHERE id = ${sub.id}`)[0].is_network_device).toBe(false);
  });

  it('returns the flag on the list API', async () => {
    await mdSvc.create('subcategories', { categoryId: catAId, code: 'NETLIST', name: 'Listed', isNetworkDevice: true });
    const list = await mdSvc.list('subcategories', { categoryId: catAId, search: 'NETLIST', limit: 10 });
    expect(list.data[0]?.isNetworkDevice).toBe(true);
  });
});
