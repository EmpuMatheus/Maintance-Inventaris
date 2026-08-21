import { getDb } from '@/database/client';
import {
  assets,
  assetCategories,
  brands,
  departments,
  sites,
  buildings,
  floors,
  rooms,
  users,
  assetConditionHistory,
} from '@/database/schema';
import { eq, and, sql, desc, asc, count, inArray } from 'drizzle-orm';
import type { SQL, SQLWrapper } from 'drizzle-orm';

export interface AssetConditionFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  categoryId?: string;
  categoryIds?: string[];
  departmentId?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  condition?: string;
  status?: string;
  assignedTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AssetConditionSummary {
  total: number;
  good: number;
  fair: number;
  needAttention: number;
  broken: number;
  critical: number;
  retired: number;
}

export interface ConditionBucket {
  name: string;
  value: number;
}

export interface ConditionChange {
  assetCode: string | null;
  assetName: string | null;
  previousCondition: string | null;
  newCondition: string | null;
  changedBy: string | null;
  createdAt: string;
}

export interface AssetConditionAnalytics {
  byCategory: ConditionBucket[];
  byDepartment: ConditionBucket[];
  recentChanges: ConditionChange[];
}

const SORT_COLUMNS: Record<string, SQLWrapper> = {
  asset_code: assets.assetCode,
  asset_name: assets.assetName,
  condition: assets.condition,
  status: assets.status,
  created_at: assets.createdAt,
  updated_at: assets.updatedAt,
};

function buildWhere(filters: AssetConditionFilters): SQL[] {
  const conditions: SQL[] = [sql`${assets.deletedAt} IS NULL`];

  if (filters.keyword) {
    const p = `%${filters.keyword}%`;
    conditions.push(
      sql`(${assets.assetCode} ILIKE ${p} OR ${assets.assetName} ILIKE ${p} OR ${assets.serialNumber} ILIKE ${p} OR ${assets.model} ILIKE ${p})`,
    );
  }
  if (filters.categoryId) conditions.push(eq(assets.categoryId, sql`${filters.categoryId}::uuid`));
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    conditions.push(inArray(assets.categoryId, filters.categoryIds));
  }
  if (filters.departmentId) conditions.push(eq(assets.departmentId, sql`${filters.departmentId}::uuid`));
  if (filters.siteId) conditions.push(eq(assets.siteId, sql`${filters.siteId}::uuid`));
  if (filters.buildingId) conditions.push(eq(assets.buildingId, sql`${filters.buildingId}::uuid`));
  if (filters.floorId) conditions.push(eq(assets.floorId, sql`${filters.floorId}::uuid`));
  if (filters.roomId) conditions.push(eq(assets.roomId, sql`${filters.roomId}::uuid`));
  if (filters.condition) conditions.push(eq(assets.condition, sql`${filters.condition}::varchar`));
  if (filters.status) conditions.push(eq(assets.status, sql`${filters.status}::varchar`));
  if (filters.assignedTo) conditions.push(eq(assets.currentPicId, sql`${filters.assignedTo}::uuid`));

  return conditions;
}

export async function assetConditionReport(filters: AssetConditionFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const where = and(...buildWhere(filters));

  const sortCol = SORT_COLUMNS[filters.sortBy ?? ''] ?? SORT_COLUMNS.created_at;
  const orderFn = filters.sortOrder === 'asc' ? asc : desc;

  const rows = await db
    .select({
      id: assets.id,
      assetCode: assets.assetCode,
      assetName: assets.assetName,
      model: assets.model,
      serialNumber: assets.serialNumber,
      condition: assets.condition,
      status: assets.status,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
      category: assetCategories.name,
      brand: brands.name,
      department: departments.name,
      site: sites.name,
      building: buildings.name,
      floor: floors.name,
      room: rooms.name,
      pic: users.name,
    })
    .from(assets)
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(brands, eq(assets.brandId, brands.id))
    .leftJoin(departments, eq(assets.departmentId, departments.id))
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .leftJoin(buildings, eq(assets.buildingId, buildings.id))
    .leftJoin(floors, eq(assets.floorId, floors.id))
    .leftJoin(rooms, eq(assets.roomId, rooms.id))
    .leftJoin(users, eq(assets.currentPicId, users.id))
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(assets).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  const assetIds = rows.map((r) => r.id);
  const historyByAsset = assetIds.length > 0 ? await latestConditionHistory(assetIds) : new Map<string, { previousCondition: string | null; newCondition: string | null; changedBy: string | null; createdAt: string }>();

  const items = rows.map((row) => {
    const hist = historyByAsset.get(row.id);
    const location = [row.site, row.building, row.floor, row.room].filter(Boolean).join(' / ') || null;
    return {
      id: row.id,
      assetCode: row.assetCode,
      assetName: row.assetName,
      model: row.model,
      serialNumber: row.serialNumber,
      condition: row.condition,
      status: row.status,
      category: row.category,
      brand: row.brand,
      department: row.department,
      location,
      pic: row.pic,
      lastConditionChange: hist?.createdAt ?? null,
      previousCondition: hist?.previousCondition ?? null,
      lastChangedBy: hist?.changedBy ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    } as any;
  });

  const summary = await buildSummary(where);
  const analytics = await buildAnalytics(where);

  return {
    items,
    summary,
    analytics,
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

async function latestConditionHistory(
  assetIds: string[],
): Promise<Map<string, { previousCondition: string | null; newCondition: string | null; changedBy: string | null; createdAt: string }>> {
  const db = getDb();
  const rows = await db
    .select({
      assetId: assetConditionHistory.assetId,
      previousCondition: assetConditionHistory.previousCondition,
      newCondition: assetConditionHistory.newCondition,
      changedBy: users.name,
      createdAt: assetConditionHistory.createdAt,
    })
    .from(assetConditionHistory)
    .leftJoin(users, eq(assetConditionHistory.changedBy, users.id))
    .where(inArray(assetConditionHistory.assetId, assetIds))
    .orderBy(desc(assetConditionHistory.createdAt));

  const map = new Map<string, { previousCondition: string | null; newCondition: string | null; changedBy: string | null; createdAt: string }>();
  for (const r of rows) {
    if (map.has(r.assetId)) continue;
    map.set(r.assetId, {
      previousCondition: r.previousCondition,
      newCondition: r.newCondition,
      changedBy: r.changedBy,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    });
  }
  return map;
}

async function buildSummary(where: SQL | undefined): Promise<AssetConditionSummary> {
  const db = getDb();
  const rows = await db.select({ condition: assets.condition, value: count() }).from(assets).where(where).groupBy(assets.condition);
  const map = new Map(rows.map((r) => [r.condition, Number(r.value)]));
  const countOf = (key: string) => map.get(key) ?? 0;
  return {
    total: Array.from(map.values()).reduce((acc, n) => acc + n, 0),
    good: countOf('GOOD'),
    fair: countOf('FAIR'),
    needAttention: countOf('NEED_ATTENTION'),
    broken: countOf('BROKEN'),
    critical: countOf('CRITICAL'),
    retired: countOf('RETIRED'),
  };
}

async function buildAnalytics(where: SQL | undefined): Promise<AssetConditionAnalytics> {
  const db = getDb();

  const [byCategory, byDepartment, recentChanges] = await Promise.all([
    db
      .select({ name: assetCategories.name, value: count() })
      .from(assets)
      .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
      .where(where)
      .groupBy(assetCategories.name)
      .orderBy(sql`count(*) DESC`),
    db
      .select({ name: departments.name, value: count() })
      .from(assets)
      .leftJoin(departments, eq(assets.departmentId, departments.id))
      .where(where)
      .groupBy(departments.name)
      .orderBy(sql`count(*) DESC`),
    db
      .select({
        assetCode: assets.assetCode,
        assetName: assets.assetName,
        previousCondition: assetConditionHistory.previousCondition,
        newCondition: assetConditionHistory.newCondition,
        changedBy: users.name,
        createdAt: assetConditionHistory.createdAt,
      })
      .from(assetConditionHistory)
      .leftJoin(assets, eq(assetConditionHistory.assetId, assets.id))
      .leftJoin(users, eq(assetConditionHistory.changedBy, users.id))
      .where(where)
      .orderBy(desc(assetConditionHistory.createdAt))
      .limit(10),
  ]);

  return {
    byCategory: byCategory.map((r) => ({ name: r.name ?? 'Unassigned', value: Number(r.value) })),
    byDepartment: byDepartment.map((r) => ({ name: r.name ?? 'Unassigned', value: Number(r.value) })),
    recentChanges: recentChanges.map((r) => ({
      assetCode: r.assetCode,
      assetName: r.assetName,
      previousCondition: r.previousCondition,
      newCondition: r.newCondition,
      changedBy: r.changedBy,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    })),
  };
}
