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
  maintenanceRecords,
} from '@/database/schema';
import { eq, and, sql, desc, asc, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export interface BrokenAssetFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  categoryId?: string;
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

export interface BrokenAssetSummary {
  total: number;
  broken: number;
  critical: number;
  needAttention: number;
  totalRepairCost: number;
  averageRepairCost: number;
  totalDowntimeHours: number;
}

export interface BrokenAssetBucket {
  name: string;
  value: number;
}

function buildWhere(filters: BrokenAssetFilters): SQL[] {
  const conditions: SQL[] = [
    sql`${assets.deletedAt} IS NULL`,
    sql`${assets.condition} IN ('BROKEN', 'CRITICAL', 'NEED_ATTENTION')`,
  ];

  if (filters.keyword) {
    const p = `%${filters.keyword}%`;
    conditions.push(sql`(${assets.assetCode} ILIKE ${p} OR ${assets.assetName} ILIKE ${p} OR ${assets.serialNumber} ILIKE ${p})`);
  }
  if (filters.categoryId) conditions.push(eq(assets.categoryId, sql`${filters.categoryId}::uuid`));
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

function recommendation(condition: string, maintenanceCount: number): string {
  if (condition === 'CRITICAL') return 'Replace';
  if (condition === 'BROKEN' && maintenanceCount >= 3) return 'Replace';
  if (condition === 'NEED_ATTENTION' && maintenanceCount >= 5) return 'Replace';
  return maintenanceCount > 0 ? 'Repair' : 'Monitor';
}

export async function brokenAssetReport(filters: BrokenAssetFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const where = and(...buildWhere(filters));

  const rows = await db
    .select({
      id: assets.id,
      assetCode: assets.assetCode,
      assetName: assets.assetName,
      serialNumber: assets.serialNumber,
      condition: assets.condition,
      status: assets.status,
      category: assetCategories.name,
      brand: brands.name,
      department: departments.name,
      site: sites.name,
      building: buildings.name,
      floor: floors.name,
      room: rooms.name,
      pic: users.name,
      createdAt: assets.createdAt,
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
    .orderBy(asc(assets.condition), asc(assets.assetCode))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(assets).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  const assetIds = rows.map((r) => r.id);
  const maintenanceMap = assetIds.length > 0 ? await maintenanceStats(assetIds) : new Map<string, { count: number; totalCost: number; downtimeHours: number; lastMaintenance: string | null; lastCode: string | null }>();

  const items = rows.map((row) => {
    const stats = maintenanceMap.get(row.id) ?? { count: 0, totalCost: 0, downtimeHours: 0, lastMaintenance: null, lastCode: null };
    return {
      id: row.id,
      assetCode: row.assetCode,
      assetName: row.assetName,
      serialNumber: row.serialNumber,
      condition: row.condition,
      status: row.status,
      category: row.category,
      brand: row.brand,
      department: row.department,
      location: [row.site, row.building, row.floor, row.room].filter(Boolean).join(' / ') || null,
      pic: row.pic,
      maintenanceCount: stats.count,
      lastMaintenanceCode: stats.lastCode,
      lastMaintenanceDate: stats.lastMaintenance,
      repairCost: stats.totalCost,
      downtimeHours: stats.downtimeHours,
      recommendation: recommendation(row.condition, stats.count),
      createdAt: row.createdAt,
    } as any;
  });

  const summary = await buildSummary(where);
  const byCategory = await db
    .select({ name: assetCategories.name, value: count() })
    .from(assets)
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .where(where)
    .groupBy(assetCategories.name)
    .orderBy(sql`count(*) DESC`);

  return {
    items,
    summary,
    analytics: { byCategory: byCategory.map((r) => ({ name: r.name ?? 'Unassigned', value: Number(r.value) })) as BrokenAssetBucket[] },
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
  };
}

async function maintenanceStats(assetIds: string[]) {
  const db = getDb();
  const rows = await db
    .select({
      assetId: maintenanceRecords.assetId,
      maintenanceCode: maintenanceRecords.maintenanceCode,
      totalCost: maintenanceRecords.totalCost,
      downtimeMinutes: maintenanceRecords.downtimeMinutes,
      finishDate: maintenanceRecords.finishDate,
    })
    .from(maintenanceRecords)
    .where(inArrayCond(assetIds))
    .orderBy(desc(maintenanceRecords.finishDate));

  const map = new Map<string, { count: number; totalCost: number; downtimeHours: number; lastMaintenance: string | null; lastCode: string | null }>();
  for (const r of rows) {
    const entry = map.get(r.assetId) ?? { count: 0, totalCost: 0, downtimeHours: 0, lastMaintenance: null as string | null, lastCode: null as string | null };
    entry.count += 1;
    entry.totalCost += Number(r.totalCost ?? 0);
    entry.downtimeHours += Math.round(((Number(r.downtimeMinutes) || 0) / 60) * 10) / 10;
    if (!entry.lastMaintenance && r.finishDate) {
      entry.lastMaintenance = r.finishDate instanceof Date ? r.finishDate.toISOString() : String(r.finishDate);
      entry.lastCode = r.maintenanceCode;
    }
    map.set(r.assetId, entry);
  }
  return map;
}

function inArrayCond(assetIds: string[]): SQL {
  const params = assetIds.map((id) => sql`${id}::uuid`);
  return sql`${maintenanceRecords.assetId} IN (${sql.join(params, sql`, `)})`;
}

async function buildSummary(where: SQL | undefined): Promise<BrokenAssetSummary> {
  const db = getDb();
  const [rows, costs] = await Promise.all([
    db.select({ condition: assets.condition, value: count() }).from(assets).where(where).groupBy(assets.condition),
    db
      .select({
        totalRepairCost: sql<number>`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)`,
        totalDowntimeMinutes: sql<number>`COALESCE(SUM(${maintenanceRecords.downtimeMinutes}), 0)`,
      })
      .from(maintenanceRecords)
      .rightJoin(assets, eq(maintenanceRecords.assetId, assets.id))
      .where(where),
  ]);

  const map = new Map(rows.map((r) => [r.condition, Number(r.value)]));
  const total = Array.from(map.values()).reduce((acc, n) => acc + n, 0);
  const totalRepairCost = Number(costs[0]?.totalRepairCost ?? 0);
  const totalDowntimeMinutes = Number(costs[0]?.totalDowntimeMinutes ?? 0);

  return {
    total,
    broken: map.get('BROKEN') ?? 0,
    critical: map.get('CRITICAL') ?? 0,
    needAttention: map.get('NEED_ATTENTION') ?? 0,
    totalRepairCost,
    averageRepairCost: total > 0 ? Math.round((totalRepairCost / total) * 100) / 100 : 0,
    totalDowntimeHours: Math.round((totalDowntimeMinutes / 60) * 10) / 10,
  };
}
