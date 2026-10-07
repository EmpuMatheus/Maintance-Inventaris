import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as assetSvc from '@/modules/assets/asset.service';
import * as maintSvc from '@/modules/maintenance/maintenance.service';
import * as mdSvc from '@/modules/master-data/master-data.service';

const sql = postgres(env.DATABASE_URL, { max: 1 });
let adminId: string;
let assetId: string;
let catId: string;
let subId: string;
let typeId: string;
const maintIds: string[] = [];

beforeAll(async () => {
  const rows = await sql`SELECT id FROM users WHERE username = 'admin' LIMIT 1`;
  adminId = rows[0].id as string;
  const cat = await sql`INSERT INTO asset_categories (id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), 'QA_TT', 'QA Task Type Cat', true, now(), now()) RETURNING id`;
  catId = cat[0].id;
  const sub = await sql`INSERT INTO asset_subcategories (id, category_id, code, name, is_active, created_at, updated_at) VALUES (gen_random_uuid(), ${catId}, 'QA_TTS', 'QA Task Type Sub', true, now(), now()) RETURNING id`;
  subId = sub[0].id;
  const asset = await assetSvc.create(
    { assetName: 'QA Task Type Asset', categoryId: catId, subcategoryId: subId, condition: 'GOOD', status: 'AVAILABLE' },
    adminId,
  );
  assetId = asset.id as string;
});

afterAll(async () => {
  for (const id of maintIds) {
    await sql`DELETE FROM maintenance_records WHERE id = ${id}`;
  }
  if (typeId) await sql`DELETE FROM maintenance_types WHERE id = ${typeId}`;
  await sql`DELETE FROM asset_condition_history WHERE asset_id = ${assetId}`;
  await sql`DELETE FROM assets WHERE id = ${assetId}`;
  await sql`DELETE FROM asset_code_counters WHERE category_id = ${catId} AND subcategory_id = ${subId}`;
  await sql`DELETE FROM asset_subcategories WHERE id = ${subId}`;
  await sql`DELETE FROM asset_categories WHERE id = ${catId}`;
  await sql.end();
});

describe('Maintenance Type task list', () => {
  it('creates a type with ordered tasks and drops empty ones', async () => {
    const created = (await mdSvc.create('maintenance-types', {
      code: 'QA_TT_1',
      name: 'QA Task Type 1',
      maintenanceCategory: 'PREVENTIVE',
      tasks: [{ task: 'Check device' }, { task: '   ' }, { task: 'Clean device' }],
    })) as any;
    typeId = created.id as string;

    expect(created.tasks.map((t: any) => t.task)).toEqual(['Check device', 'Clean device']);
    expect(created.tasks.map((t: any) => t.sortOrder)).toEqual([0, 1]);
  });

  it('returns tasks on getById and list', async () => {
    const row = (await mdSvc.getById('maintenance-types', typeId)) as any;
    expect(row.tasks.map((t: any) => t.task)).toEqual(['Check device', 'Clean device']);

    const list = await mdSvc.list('maintenance-types', { search: 'QA_TT_1', limit: 100 });
    const found = list.data.find((r) => r.id === typeId) as any;
    expect(found.tasks.length).toBe(2);
  });

  it('updates, removes and adds tasks preserving order', async () => {
    const before = (await mdSvc.getById('maintenance-types', typeId)) as any;
    const first = before.tasks[0];
    const second = before.tasks[1];

    const updated = (await mdSvc.update('maintenance-types', typeId, {
      tasks: [{ id: first.id, task: 'Check device (edited)' }, { task: 'Test device' }],
    })) as any;

    expect(updated.tasks.map((t: any) => t.task)).toEqual(['Check device (edited)', 'Test device']);
    expect(updated.tasks.map((t: any) => t.id)).not.toContain(second.id);
    expect(updated.tasks[0].id).toBe(first.id);
  });
});

describe('Maintenance task snapshot', () => {
  it('snapshots the type tasks onto a new maintenance', async () => {
    const rec = await maintSvc.create(
      { assetId, maintenanceTypeId: typeId, maintenanceCategory: 'PREVENTIVE', problem: 'QA snapshot', priority: 'MEDIUM' },
      adminId,
    );
    const id = rec.id as string;
    maintIds.push(id);

    const detail = (await maintSvc.getById(id)) as any;
    expect(detail.tasks.map((t: any) => t.task)).toEqual(['Check device (edited)', 'Test device']);
    expect(detail.tasks.every((t: any) => t.isCompleted === false)).toBe(true);
    expect(detail.taskProgress).toEqual({ completed: 0, total: 2 });
  });

  it('keeps the snapshot when the type changes and supports checklist toggling', async () => {
    const rec = await maintSvc.create(
      { assetId, maintenanceTypeId: typeId, maintenanceCategory: 'PREVENTIVE', problem: 'QA snapshot 2', priority: 'MEDIUM' },
      adminId,
    );
    const id = rec.id as string;
    maintIds.push(id);

    const detail1 = (await maintSvc.getById(id)) as any;
    const taskId = detail1.tasks[0].id;
    await maintSvc.setTaskCompleted(id, taskId, true);

    const detail2 = (await maintSvc.getById(id)) as any;
    expect(detail2.tasks.find((t: any) => t.id === taskId).isCompleted).toBe(true);
    expect(detail2.taskProgress).toEqual({ completed: 1, total: 2 });

    // Mutate the Maintenance Type task list.
    await mdSvc.update('maintenance-types', typeId, { tasks: [{ task: 'Brand new task' }] });

    const typeAfter = (await mdSvc.getById('maintenance-types', typeId)) as any;
    expect(typeAfter.tasks.map((t: any) => t.task)).toEqual(['Brand new task']);

    // The maintenance created earlier keeps its own snapshot.
    const detail3 = (await maintSvc.getById(id)) as any;
    expect(detail3.tasks.map((t: any) => t.task)).toEqual(['Check device (edited)', 'Test device']);
    expect(detail3.taskProgress).toEqual({ completed: 1, total: 2 });
  });

  it('rejects toggling a task that belongs to another maintenance', async () => {
    const rec = await maintSvc.create(
      { assetId, maintenanceTypeId: typeId, maintenanceCategory: 'PREVENTIVE', problem: 'QA snapshot 3', priority: 'MEDIUM' },
      adminId,
    );
    const id = rec.id as string;
    maintIds.push(id);
    await expect(
      maintSvc.setTaskCompleted(id, '00000000-0000-0000-0000-000000000000', true),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
