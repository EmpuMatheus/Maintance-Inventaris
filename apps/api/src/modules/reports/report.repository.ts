import { getDb } from '@/database/client';
import {
  assets,
  assetCategories,
  assetSubcategories,
  brands,
  departments,
  sites,
  buildings,
  floors,
  rooms,
  users,
  vendors,
} from '@/database/schema';
import { eq, and, sql, desc, asc, count } from 'drizzle-orm';
import type { SQL, SQLWrapper } from 'drizzle-orm';

export interface InventoryReportFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  categoryId?: string;
  subcategoryId?: string;
  brandId?: string;
  departmentId?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  condition?: string;
  status?: string;
  assignedTo?: string;
  purchaseDateFrom?: string;
  purchaseDateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InventorySummary {
  totalAssets: number;
  available: number;
  assigned: number;
  maintenance: number;
  retired: number;
  good: number;
  fair: number;
  poor: number;
  critical: number;
}

const SORT_COLUMNS: Record<string, SQLWrapper> = {
  asset_code: assets.assetCode,
  asset_name: assets.assetName,
  created_at: assets.createdAt,
  updated_at: assets.updatedAt,
};

function buildWhere(filters: InventoryReportFilters): SQL[] {
  const conditions: SQL[] = [sql`${assets.deletedAt} IS NULL`];

  if (filters.keyword) {
    const p = `%${filters.keyword}%`;
    conditions.push(
      sql`(${assets.assetCode} ILIKE ${p} OR ${assets.assetName} ILIKE ${p} OR ${assets.serialNumber} ILIKE ${p} OR ${assets.model} ILIKE ${p})`,
    );
  }
  if (filters.categoryId) conditions.push(eq(assets.categoryId, sql`${filters.categoryId}::uuid`));
  if (filters.subcategoryId) conditions.push(eq(assets.subcategoryId, sql`${filters.subcategoryId}::uuid`));
  if (filters.brandId) conditions.push(eq(assets.brandId, sql`${filters.brandId}::uuid`));
  if (filters.departmentId) conditions.push(eq(assets.departmentId, sql`${filters.departmentId}::uuid`));
  if (filters.siteId) conditions.push(eq(assets.siteId, sql`${filters.siteId}::uuid`));
  if (filters.buildingId) conditions.push(eq(assets.buildingId, sql`${filters.buildingId}::uuid`));
  if (filters.floorId) conditions.push(eq(assets.floorId, sql`${filters.floorId}::uuid`));
  if (filters.roomId) conditions.push(eq(assets.roomId, sql`${filters.roomId}::uuid`));
  if (filters.condition) conditions.push(eq(assets.condition, sql`${filters.condition}::varchar`));
  if (filters.status) conditions.push(eq(assets.status, sql`${filters.status}::varchar`));
  if (filters.assignedTo) conditions.push(eq(assets.currentPicId, sql`${filters.assignedTo}::uuid`));
  if (filters.purchaseDateFrom) conditions.push(sql`${assets.purchaseDate} >= ${filters.purchaseDateFrom}::date`);
  if (filters.purchaseDateTo) conditions.push(sql`${assets.purchaseDate} <= ${filters.purchaseDateTo}::date`);

  return conditions;
}

export async function inventoryReport(filters: InventoryReportFilters) {
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
      manufacturer: assets.manufacturer,
      condition: assets.condition,
      status: assets.status,
      purchaseDate: assets.purchaseDate,
      createdAt: assets.createdAt,
      updatedAt: assets.updatedAt,
      category: assetCategories.name,
      subcategory: assetSubcategories.name,
      brand: brands.name,
      department: departments.name,
      site: sites.name,
      building: buildings.name,
      floor: floors.name,
      room: rooms.name,
      pic: users.name,
      vendor: vendors.name,
    })
    .from(assets)
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(assetSubcategories, eq(assets.subcategoryId, assetSubcategories.id))
    .leftJoin(brands, eq(assets.brandId, brands.id))
    .leftJoin(departments, eq(assets.departmentId, departments.id))
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .leftJoin(buildings, eq(assets.buildingId, buildings.id))
    .leftJoin(floors, eq(assets.floorId, floors.id))
    .leftJoin(rooms, eq(assets.roomId, rooms.id))
    .leftJoin(users, eq(assets.currentPicId, users.id))
    .leftJoin(vendors, eq(assets.vendorId, vendors.id))
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(assets).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  const summary = await buildSummary(where);

  return {
    items: rows as any[],
    summary,
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

async function buildSummary(where: SQL | undefined): Promise<InventorySummary> {
  const db = getDb();

  const [statusRows, conditionRows] = await Promise.all([
    db.select({ status: assets.status, value: count() }).from(assets).where(where).groupBy(assets.status),
    db.select({ condition: assets.condition, value: count() }).from(assets).where(where).groupBy(assets.condition),
  ]);

  const statusMap = new Map(statusRows.map((r) => [r.status, Number(r.value)]));
  const conditionMap = new Map(conditionRows.map((r) => [r.condition, Number(r.value)]));

  const totalAssets = Array.from(statusMap.values()).reduce((acc, n) => acc + n, 0);
  const countOf = (map: Map<string, number>, key: string) => map.get(key) ?? 0;

  return {
    totalAssets,
    available: countOf(statusMap, 'AVAILABLE'),
    assigned: countOf(statusMap, 'ASSIGNED') + countOf(statusMap, 'IN_USE'),
    maintenance: countOf(statusMap, 'IN_MAINTENANCE'),
    retired: countOf(statusMap, 'RETIRED'),
    good: countOf(conditionMap, 'GOOD'),
    fair: countOf(conditionMap, 'FAIR'),
    poor: countOf(conditionMap, 'NEED_ATTENTION') + countOf(conditionMap, 'BROKEN'),
    critical: countOf(conditionMap, 'CRITICAL'),
  };
}
