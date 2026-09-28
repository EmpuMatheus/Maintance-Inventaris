import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as mdSvc from '@/modules/master-data/master-data.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });

const RUN = `QA_ST_${Date.now().toString(36).toUpperCase()}`;

let brandId: string;
let deptId: string;
let maintTypeId: string;
let siteId: string;
let buildingId: string;
let floorId: string;
let roomId: string;

beforeAll(async () => {
  const brand = await mdSvc.create('brands', { name: `${RUN} Brand` });
  brandId = brand.id as string;
  const dept = await mdSvc.create('departments', { code: `${RUN}_D`, name: `${RUN} Dept` });
  deptId = dept.id as string;
  const mt = await mdSvc.create('maintenance-types', {
    code: `${RUN}_MT`,
    name: `${RUN} Type`,
    maintenanceCategory: 'PREVENTIVE',
  });
  maintTypeId = mt.id as string;

  const site = await mdSvc.create('sites', { code: `${RUN}_S`, name: `${RUN} Site` });
  siteId = site.id as string;
  const building = await mdSvc.create('buildings', { siteId, code: `${RUN}_B`, name: `${RUN} Building` });
  buildingId = building.id as string;
  const floor = await mdSvc.create('floors', { buildingId, code: `${RUN}_F`, name: `${RUN} Floor` });
  floorId = floor.id as string;
  const room = await mdSvc.create('rooms', { floorId, code: `${RUN}_R`, name: `${RUN} Room` });
  roomId = room.id as string;
});

afterAll(async () => {
  if (roomId) await sql`DELETE FROM rooms WHERE id = ${roomId}`;
  if (floorId) await sql`DELETE FROM floors WHERE id = ${floorId}`;
  if (buildingId) await sql`DELETE FROM buildings WHERE id = ${buildingId}`;
  if (siteId) await sql`DELETE FROM sites WHERE id = ${siteId}`;
  if (brandId) await sql`DELETE FROM brands WHERE id = ${brandId}`;
  if (deptId) await sql`DELETE FROM departments WHERE id = ${deptId}`;
  if (maintTypeId) await sql`DELETE FROM maintenance_types WHERE id = ${maintTypeId}`;
  await sql.end();
});

describe('Master data: activate / deactivate', () => {
  it('deactivates and re-activates without deleting the row', async () => {
    const off = await mdSvc.setActive('brands', brandId, false);
    expect(off.isActive).toBe(false);
    expect((await sql`SELECT is_active FROM brands WHERE id = ${brandId}`)[0].is_active).toBe(false);

    const on = await mdSvc.setActive('brands', brandId, true);
    expect(on.isActive).toBe(true);
    expect((await sql`SELECT is_active FROM brands WHERE id = ${brandId}`)[0].is_active).toBe(true);
  });

  it('keeps deactivated records readable via getById', async () => {
    await mdSvc.setActive('departments', deptId, false);
    const row = await mdSvc.getById('departments', deptId);
    expect(row.id).toBe(deptId);
    expect(row.isActive).toBe(false);
    await mdSvc.setActive('departments', deptId, true);
  });

  it('filters list by isActive for the admin management page', async () => {
    await mdSvc.setActive('maintenance-types', maintTypeId, false);

    // Default list (no filter) still exposes inactive records for the admin.
    const all = await mdSvc.list('maintenance-types', { search: RUN, limit: 100 });
    expect(all.data.some((r) => r.id === maintTypeId)).toBe(true);

    const active = await mdSvc.list('maintenance-types', { search: RUN, limit: 100, isActive: true });
    expect(active.data.some((r) => r.id === maintTypeId)).toBe(false);

    const inactive = await mdSvc.list('maintenance-types', { search: RUN, limit: 100, isActive: false });
    expect(inactive.data.some((r) => r.id === maintTypeId)).toBe(true);

    await mdSvc.setActive('maintenance-types', maintTypeId, true);
  });

  it('deactivate() keeps soft-deactivation for non-category resources', async () => {
    await mdSvc.deactivate('brands', brandId);
    expect((await sql`SELECT is_active FROM brands WHERE id = ${brandId}`)[0].is_active).toBe(false);
    await mdSvc.setActive('brands', brandId, true);
  });

  it('soft deactivates and re-activates categories without deleting the row', async () => {
    const cat = await mdSvc.create('categories', { code: `${RUN}_C`, name: `${RUN} Category` });
    const catId = cat.id as string;

    const off = await mdSvc.setActive('categories', catId, false);
    expect(off.isActive).toBe(false);
    const offRow = await sql`SELECT is_active FROM asset_categories WHERE id = ${catId}`;
    expect(offRow[0].is_active).toBe(false);

    // deactivate() must now be a soft-status change for categories too.
    await mdSvc.setActive('categories', catId, true);
    await mdSvc.deactivate('categories', catId);
    const softRow = await sql`SELECT is_active FROM asset_categories WHERE id = ${catId}`;
    expect(softRow[0].is_active).toBe(false);

    const on = await mdSvc.setActive('categories', catId, true);
    expect(on.isActive).toBe(true);

    await sql`DELETE FROM asset_categories WHERE id = ${catId}`;
  });

  it('throws 404 when activating an unknown record', async () => {
    await expect(
      mdSvc.setActive('rooms', '00000000-0000-0000-0000-000000000000', true),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('permanently deletes a category and its code counters', async () => {
    const cat = await mdSvc.create('categories', { code: `${RUN}_PD`, name: `${RUN} Permanently Deleted` });
    const catId = cat.id as string;
    const sub = await mdSvc.create('subcategories', {
      categoryId: catId,
      code: `${RUN}_PDS`,
      name: `${RUN} PD Sub`,
    });
    const subId = sub.id as string;

    // asset_code_counters has no FK, so seed one to verify it is cleaned up.
    await sql`
      INSERT INTO asset_code_counters (id, category_id, subcategory_id, last_sequence)
      VALUES (gen_random_uuid(), ${catId}, ${subId}, 1)
    `;

    const removed = await mdSvc.deletePermanently('categories', catId);
    expect(removed.id).toBe(catId);
    expect((await sql`SELECT id FROM asset_categories WHERE id = ${catId}`).length).toBe(0);
    expect((await sql`SELECT id FROM asset_subcategories WHERE id = ${subId}`).length).toBe(0);
    expect(
      Number((await sql`SELECT count(*) AS n FROM asset_code_counters WHERE category_id = ${catId}`)[0].n),
    ).toBe(0);
  });

  it('rejects permanent delete for non-category resources', async () => {
    await expect(mdSvc.deletePermanently('brands', brandId)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 404 when permanently deleting an unknown category', async () => {
    await expect(
      mdSvc.deletePermanently('categories', '00000000-0000-0000-0000-000000000000'),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('does not break the location hierarchy when a parent is deactivated', async () => {
    await mdSvc.setActive('sites', siteId, false);
    // Existing building/room remain readable even though the parent site is inactive.
    const building = await mdSvc.getById('buildings', buildingId);
    expect(building.isActive).toBe(true);
    const rooms = await mdSvc.list('rooms', { floorId, isActive: true });
    expect(rooms.data.some((r) => r.id === roomId)).toBe(true);
    await mdSvc.setActive('sites', siteId, true);
  });
});
