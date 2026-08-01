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
} from '@/database/schema';
import { eq, like, and, sql, asc, desc, count } from 'drizzle-orm';
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
    conditions.push(sql`(${and(...searchConditions)})`);
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

  const rows = await db
    .select()
    .from(cfg.table)
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset(offset);

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
  const rows = await db
    .select()
    .from(cfg.table)
    .where(eq(cfg.table['id' as keyof typeof cfg.table] as unknown as SQL, sql`${id}::uuid`))
    .limit(1);

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

export async function deactivate(
  resource: string,
  id: string,
): Promise<Row | undefined> {
  return update(resource, id, { isActive: false } as Record<string, unknown>);
}
