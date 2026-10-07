import { getDb } from '@/database/client';
import {
  assetCategories,
  assetSubcategories,
  brands,
  departments,
  vendors,
  sites,
  buildings,
  floors,
  rooms,
  maintenanceTypes,
  maintenanceTypeTasks,
} from '@/database/schema';
import { eq, ne, like, and, or, sql, asc, desc, count, inArray } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

type TableConfig = {
  table: PgTable;
  searchColumns: string[];
  parentFilter?: string;
};

const TABLES: Record<string, TableConfig> = {
  categories: { table: assetCategories, searchColumns: ['code', 'name'] },
  subcategories: { table: assetSubcategories, searchColumns: ['code', 'name'], parentFilter: 'categoryId' },
  brands: { table: brands, searchColumns: ['name'] },
  departments: { table: departments, searchColumns: ['code', 'name'] },
  vendors: { table: vendors, searchColumns: ['code', 'name'] },
  sites: { table: sites, searchColumns: ['code', 'name'] },
  buildings: { table: buildings, searchColumns: ['code', 'name'], parentFilter: 'siteId' },
  floors: { table: floors, searchColumns: ['code', 'name'], parentFilter: 'buildingId' },
  rooms: { table: rooms, searchColumns: ['code', 'name'], parentFilter: 'floorId' },
  'maintenance-types': { table: maintenanceTypes, searchColumns: ['code', 'name'] },
};

type Row = Record<string, unknown>;

export async function list(
  resource: string,
  options: {
    page?: number;
    limit?: number;
    search?: string;
    sort?: string;
    order?: string;
    parentId?: string;
    isActive?: boolean;
  },
) {
  const cfg = TABLES[resource];
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);

  const db = getDb();
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 25));
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [];

  if (options.search) {
    const searchPattern = `%${options.search}%`;
    const searchConditions = cfg.searchColumns.map((col) =>
      like(cfg.table[col as keyof typeof cfg.table] as unknown as SQL, searchPattern),
    );
    // OR semantics: match any of the searchable columns (e.g. code OR name).
    conditions.push(sql`(${or(...searchConditions)})`);
  }

  if (cfg.parentFilter && options.parentId) {
    const col = cfg.table[cfg.parentFilter as keyof typeof cfg.table] as unknown as SQL;
    conditions.push(eq(col, sql`${options.parentId}::uuid`));
  }

  if (options.isActive !== undefined) {
    const col = cfg.table['isActive' as keyof typeof cfg.table] as unknown as SQL;
    conditions.push(eq(col, options.isActive));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortCol = options.sort
    ? (cfg.table[options.sort as keyof typeof cfg.table] as unknown as SQL)
    : (cfg.table['createdAt' as keyof typeof cfg.table] as unknown as SQL);

  const orderFn = options.order === 'asc' ? asc : desc;

  let rows: Row[];
  if (resource === 'subcategories') {
    rows = (await db
      .select({
        id: assetSubcategories.id,
        categoryId: assetSubcategories.categoryId,
        code: assetSubcategories.code,
        name: assetSubcategories.name,
        description: assetSubcategories.description,
        isNetworkDevice: assetSubcategories.isNetworkDevice,
        isActive: assetSubcategories.isActive,
        createdAt: assetSubcategories.createdAt,
        updatedAt: assetSubcategories.updatedAt,
        category: assetCategories.name,
      })
      .from(assetSubcategories)
      .leftJoin(assetCategories, eq(assetSubcategories.categoryId, assetCategories.id))
      .where(where)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset)) as Row[];
  } else if (resource === 'floors') {
    rows = (await db
      .select({
        id: floors.id,
        buildingId: floors.buildingId,
        code: floors.code,
        name: floors.name,
        description: floors.description,
        isActive: floors.isActive,
        createdAt: floors.createdAt,
        updatedAt: floors.updatedAt,
        building: buildings.name,
      })
      .from(floors)
      .leftJoin(buildings, eq(floors.buildingId, buildings.id))
      .where(where)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset)) as Row[];
  } else {
    rows = (await db
      .select()
      .from(cfg.table)
      .where(where)
      .orderBy(orderFn(sortCol))
      .limit(limit)
      .offset(offset)) as Row[];
  }

  const totalResult = await db
    .select({ value: count() })
    .from(cfg.table)
    .where(where);

  const total = Number(totalResult[0]?.value ?? 0);

  return {
    data: rows as Row[],
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getById(resource: string, id: string): Promise<Row | undefined> {
  const cfg = TABLES[resource];
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);

  const db = getDb();
  let rows: Row[];
  if (resource === 'subcategories') {
    rows = (await db
      .select({
        id: assetSubcategories.id,
        categoryId: assetSubcategories.categoryId,
        code: assetSubcategories.code,
        name: assetSubcategories.name,
        description: assetSubcategories.description,
        isNetworkDevice: assetSubcategories.isNetworkDevice,
        isActive: assetSubcategories.isActive,
        createdAt: assetSubcategories.createdAt,
        updatedAt: assetSubcategories.updatedAt,
        category: assetCategories.name,
      })
      .from(assetSubcategories)
      .leftJoin(assetCategories, eq(assetSubcategories.categoryId, assetCategories.id))
      .where(eq(assetSubcategories.id, sql`${id}::uuid`))
      .limit(1)) as Row[];
  } else {
    rows = (await db
      .select()
      .from(cfg.table)
      .where(eq(cfg.table['id' as keyof typeof cfg.table] as unknown as SQL, sql`${id}::uuid`))
      .limit(1)) as Row[];
  }

  return rows[0] as Row | undefined;
}

/** Tasks attached to a Maintenance Type, ordered for display. */
export async function getTasksForType(typeId: string): Promise<Row[]> {
  const db = getDb();
  return (await db
    .select()
    .from(maintenanceTypeTasks)
    .where(eq(maintenanceTypeTasks.maintenanceTypeId, sql`${typeId}::uuid`))
    .orderBy(asc(maintenanceTypeTasks.sortOrder), asc(maintenanceTypeTasks.createdAt))) as Row[];
}

/** Tasks for several Maintenance Types at once (avoids N+1 on list pages). */
export async function getTasksForTypes(typeIds: string[]): Promise<Map<string, Row[]>> {
  const map = new Map<string, Row[]>();
  if (typeIds.length === 0) return map;

  const db = getDb();
  const rows = (await db
    .select()
    .from(maintenanceTypeTasks)
    .where(inArray(maintenanceTypeTasks.maintenanceTypeId, typeIds))
    .orderBy(asc(maintenanceTypeTasks.sortOrder), asc(maintenanceTypeTasks.createdAt))) as Row[];

  for (const row of rows) {
    const key = row.maintenanceTypeId as string;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

export interface TaskInput {
  id?: string;
  task: string;
  order: number;
}

/**
 * Reconciles a Maintenance Type's task list with the submitted payload.
 *
 * Tasks that keep an `id` are updated in place, tasks missing from the payload
 * are deleted, new tasks are inserted, and `sort_order` is rewritten so the
 * submitted order is preserved. Deleting a type task never touches maintenance
 * records because their checklists are independent snapshots.
 */
export async function setMaintenanceTypeTasks(typeId: string, tasks: TaskInput[]): Promise<void> {
  const db = getDb();
  await db.transaction(async (tx) => {
    const existing = (await tx
      .select()
      .from(maintenanceTypeTasks)
      .where(eq(maintenanceTypeTasks.maintenanceTypeId, sql`${typeId}::uuid`))) as Row[];
    const existingIds = new Set(existing.map((r) => r.id as string));
    const incomingIds = new Set(tasks.map((t) => t.id).filter((v): v is string => Boolean(v)));

    const toDelete = existing.filter((r) => !incomingIds.has(r.id as string));
    if (toDelete.length > 0) {
      await tx
        .delete(maintenanceTypeTasks)
        .where(inArray(maintenanceTypeTasks.id, toDelete.map((r) => r.id as string)));
    }

    for (const item of tasks) {
      if (item.id && existingIds.has(item.id)) {
        await tx
          .update(maintenanceTypeTasks)
          .set({ task: item.task, sortOrder: item.order, updatedAt: sql`now()` })
          .where(and(
            eq(maintenanceTypeTasks.id, sql`${item.id}::uuid`),
            eq(maintenanceTypeTasks.maintenanceTypeId, sql`${typeId}::uuid`),
          ));
      } else {
        await tx.insert(maintenanceTypeTasks).values({
          maintenanceTypeId: sql`${typeId}::uuid`,
          task: item.task,
          sortOrder: item.order,
        });
      }
    }
  });
}

/**
 * Finds a record that shares the same `code` within the same parent.
 *
 * Used to enforce `parent_id + code` uniqueness for subcategories, buildings,
 * floors and rooms. `excludeId` skips the record currently being edited so it
 * is not treated as a duplicate of itself. Inactive records are included on
 * purpose: a code stays reserved inside its parent regardless of status.
 */
export async function findByParentAndCode(
  resource: string,
  parentField: string,
  parentId: string,
  code: string,
  excludeId?: string,
): Promise<Row | undefined> {
  const cfg = TABLES[resource];
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);

  const db = getDb();
  const conditions: SQL[] = [
    eq(cfg.table[parentField as keyof typeof cfg.table] as unknown as SQL, sql`${parentId}::uuid`),
    eq(cfg.table['code' as keyof typeof cfg.table] as unknown as SQL, code),
  ];
  if (excludeId) {
    const idCol = cfg.table['id' as keyof typeof cfg.table] as unknown as SQL;
    conditions.push(ne(idCol, sql`${excludeId}::uuid`));
  }

  const rows = (await db
    .select()
    .from(cfg.table)
    .where(and(...conditions))
    .limit(1)) as Row[];

  return rows[0] as Row | undefined;
}

export async function create(resource: string, data: Record<string, unknown>): Promise<Row> {
  const cfg = TABLES[resource];
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);

  const db = getDb();
  const rows = await db
    .insert(cfg.table)
    .values({ ...data, id: sql`gen_random_uuid()` })
    .returning();

  return rows[0] as Row;
}

export async function update(
  resource: string,
  id: string,
  data: Record<string, unknown>,
): Promise<Row | undefined> {
  const cfg = TABLES[resource];
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);

  const db = getDb();
  const rows = await db
    .update(cfg.table)
    .set({ ...data, updatedAt: sql`now()` })
    .where(eq(cfg.table['id' as keyof typeof cfg.table] as unknown as SQL, sql`${id}::uuid`))
    .returning();

  return rows[0] as Row | undefined;
}

export async function setActive(
  resource: string,
  id: string,
  isActive: boolean,
): Promise<Row | undefined> {
  return update(resource, id, { isActive } as Record<string, unknown>);
}

export async function deactivate(
  resource: string,
  id: string,
): Promise<Row | undefined> {
  return setActive(resource, id, false);
}

/** Hard-deletes a master data row (used for category cleanup). */
export async function remove(
  resource: string,
  id: string,
): Promise<Row | undefined> {
  const cfg = TABLES[resource];
  if (!cfg) throw new Error(`Unknown resource: ${resource}`);

  const db = getDb();
  const rows = await db
    .delete(cfg.table)
    .where(eq(cfg.table['id' as keyof typeof cfg.table] as unknown as SQL, sql`${id}::uuid`))
    .returning();

  return rows[0] as Row | undefined;
}

/**
 * Hard-deletes a category and every record that depends on it.
 *
 * `asset_code_counters` has no foreign key to categories/subcategories, so it
 * is cleaned up explicitly inside the same transaction to avoid orphan rows.
 * All other dependent tables (subcategories, assets, user_categories and the
 * asset child records) are removed by PostgreSQL through ON DELETE CASCADE.
 */
export async function removeCategory(id: string): Promise<Row | undefined> {
  const db = getDb();

  return db.transaction(async (tx) => {
    await tx.execute(sql`
      DELETE FROM asset_code_counters
      WHERE category_id = ${id}::uuid
         OR subcategory_id IN (
           SELECT id FROM asset_subcategories WHERE category_id = ${id}::uuid
         )
    `);

    const rows = await tx
      .delete(assetCategories)
      .where(eq(assetCategories.id, sql`${id}::uuid`))
      .returning();

    return rows[0] as Row | undefined;
  });
}
