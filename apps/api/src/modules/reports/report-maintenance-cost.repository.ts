import { getDb } from '@/database/client';
import {
  maintenanceRecords,
  assets,
  assetCategories,
  departments,
  vendors,
  maintenanceTypes,
  users,
} from '@/database/schema';
import { alias } from 'drizzle-orm/pg-core';
import { eq, and, sql, desc, asc, count } from 'drizzle-orm';
import type { SQL, SQLWrapper } from 'drizzle-orm';

const technicianUsers = alias(users, 'technician_users');

export interface MaintenanceCostFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  assetId?: string;
  categoryId?: string;
  departmentId?: string;
  vendorId?: string;
  maintenanceTypeId?: string;
  technicianId?: string;
  priority?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MaintenanceCostSummary {
  totalMaintenance: number;
  totalCost: number;
  averageCost: number;
  highestCost: number;
  totalLabor: number;
  totalParts: number;
  totalOther: number;
  preventiveCost: number;
  correctiveCost: number;
}

export interface CostBucket {
  name: string;
  value: number;
  count: number;
}

export interface CostAnalytics {
  topAssets: CostBucket[];
  topCategories: CostBucket[];
  topVendors: CostBucket[];
  topDepartments: CostBucket[];
  monthlyTrend: { month: string; label: string; value: number }[];
}

const SORT_COLUMNS: Record<string, SQLWrapper> = {
  total_cost: maintenanceRecords.totalCost,
  maintenance_code: maintenanceRecords.maintenanceCode,
  completed_at: maintenanceRecords.finishDate,
  asset_name: assets.assetName,
  vendor: vendors.name,
  category: assetCategories.name,
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function buildWhere(filters: MaintenanceCostFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.keyword) {
    const p = `%${filters.keyword}%`;
    conditions.push(
      sql`(${maintenanceRecords.maintenanceCode} ILIKE ${p} OR ${assets.assetCode} ILIKE ${p} OR ${assets.assetName} ILIKE ${p})`,
    );
  }
  if (filters.assetId) conditions.push(eq(maintenanceRecords.assetId, sql`${filters.assetId}::uuid`));
  if (filters.categoryId) conditions.push(eq(assets.categoryId, sql`${filters.categoryId}::uuid`));
  if (filters.departmentId) conditions.push(eq(assets.departmentId, sql`${filters.departmentId}::uuid`));
  if (filters.vendorId) conditions.push(eq(maintenanceRecords.vendorId, sql`${filters.vendorId}::uuid`));
  if (filters.maintenanceTypeId) conditions.push(eq(maintenanceRecords.maintenanceTypeId, sql`${filters.maintenanceTypeId}::uuid`));
  if (filters.technicianId) conditions.push(eq(maintenanceRecords.technicianId, sql`${filters.technicianId}::uuid`));
  if (filters.priority) conditions.push(eq(maintenanceRecords.priority, sql`${filters.priority}::varchar`));
  if (filters.status) conditions.push(eq(maintenanceRecords.status, sql`${filters.status}::varchar`));
  if (filters.startDate) conditions.push(sql`${maintenanceRecords.createdAt} >= ${filters.startDate}::date`);
  if (filters.endDate) conditions.push(sql`${maintenanceRecords.createdAt} <= ${filters.endDate}::date + interval '1 day'`);
  if (filters.siteId) conditions.push(eq(assets.siteId, sql`${filters.siteId}::uuid`));
  if (filters.buildingId) conditions.push(eq(assets.buildingId, sql`${filters.buildingId}::uuid`));
  if (filters.floorId) conditions.push(eq(assets.floorId, sql`${filters.floorId}::uuid`));
  if (filters.roomId) conditions.push(eq(assets.roomId, sql`${filters.roomId}::uuid`));

  return conditions;
}

export async function maintenanceCostReport(filters: MaintenanceCostFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const where = and(...buildWhere(filters));

  const sortCol = SORT_COLUMNS[filters.sortBy ?? ''] ?? SORT_COLUMNS.completed_at;
  const orderFn = filters.sortOrder === 'asc' ? asc : desc;

  const rows = await db
    .select({
      id: maintenanceRecords.id,
      maintenanceCode: maintenanceRecords.maintenanceCode,
      priority: maintenanceRecords.priority,
      status: maintenanceRecords.status,
      laborCost: maintenanceRecords.laborCost,
      partsCost: maintenanceRecords.partsCost,
      otherCost: maintenanceRecords.otherCost,
      totalCost: maintenanceRecords.totalCost,
      finishDate: maintenanceRecords.finishDate,
      startDate: maintenanceRecords.startDate,
      assetCode: assets.assetCode,
      assetName: assets.assetName,
      categoryName: assetCategories.name,
      departmentName: departments.name,
      vendorName: vendors.name,
      maintenanceTypeName: maintenanceTypes.name,
      technicianName: technicianUsers.name,
    })
    .from(maintenanceRecords)
    .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(departments, eq(assets.departmentId, departments.id))
    .leftJoin(vendors, eq(maintenanceRecords.vendorId, vendors.id))
    .leftJoin(maintenanceTypes, eq(maintenanceRecords.maintenanceTypeId, maintenanceTypes.id))
    .leftJoin(technicianUsers, eq(maintenanceRecords.technicianId, technicianUsers.id))
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(maintenanceRecords).leftJoin(assets, eq(maintenanceRecords.assetId, assets.id)).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  const items = rows.map((row) => {
    const start = row.startDate ? new Date(row.startDate).getTime() : null;
    const finish = row.finishDate ? new Date(row.finishDate).getTime() : null;
    const durationHours = start && finish ? Math.round(((finish - start) / 3600000) * 10) / 10 : null;
    return {
      id: row.id,
      maintenanceCode: row.maintenanceCode,
      asset: { assetCode: row.assetCode, assetName: row.assetName, category: row.categoryName },
      department: row.departmentName,
      vendor: row.vendorName,
      maintenanceType: row.maintenanceTypeName,
      technician: row.technicianName,
      priority: row.priority,
      status: row.status,
      laborCost: num(row.laborCost),
      partsCost: num(row.partsCost),
      otherCost: num(row.otherCost),
      totalCost: num(row.totalCost),
      completedDate: row.finishDate,
      durationHours,
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

async function buildSummary(where: SQL | undefined): Promise<MaintenanceCostSummary> {
  const db = getDb();

  const [costs, preventive, corrective] = await Promise.all([
    db
      .select({
        totalCost: sql<number>`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)`,
        laborCost: sql<number>`COALESCE(SUM(${maintenanceRecords.laborCost}), 0)`,
        partsCost: sql<number>`COALESCE(SUM(${maintenanceRecords.partsCost}), 0)`,
        otherCost: sql<number>`COALESCE(SUM(${maintenanceRecords.otherCost}), 0)`,
        averageCost: sql<number>`COALESCE(AVG(${maintenanceRecords.totalCost}), 0)`,
        highestCost: sql<number>`COALESCE(MAX(${maintenanceRecords.totalCost}), 0)`,
        totalCount: count(),
      })
      .from(maintenanceRecords)
      .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
      .where(where),
    db
      .select({ value: sql<number>`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)` })
      .from(maintenanceRecords)
      .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
      .where(and(where, eq(maintenanceRecords.maintenanceCategory, 'PREVENTIVE'))),
    db
      .select({ value: sql<number>`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)` })
      .from(maintenanceRecords)
      .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
      .where(and(where, eq(maintenanceRecords.maintenanceCategory, 'CORRECTIVE'))),
  ]);

  const row = costs[0];
  return {
    totalMaintenance: num(row?.totalCount),
    totalCost: num(row?.totalCost),
    averageCost: Math.round(num(row?.averageCost) * 100) / 100,
    highestCost: num(row?.highestCost),
    totalLabor: num(row?.laborCost),
    totalParts: num(row?.partsCost),
    totalOther: num(row?.otherCost),
    preventiveCost: num(preventive[0]?.value),
    correctiveCost: num(corrective[0]?.value),
  };
}

async function buildAnalytics(where: SQL | undefined): Promise<CostAnalytics> {
  const db = getDb();

  const [topAssets, topCategories, topVendors, topDepartments, trendRows] = await Promise.all([
    db
      .select({
        name: sql<string>`${assets.assetName} || ' (' || ${assets.assetCode} || ')'`,
        value: sql<number>`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)`,
        count: count(),
      })
      .from(maintenanceRecords)
      .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
      .where(where)
      .groupBy(assets.assetName, assets.assetCode)
      .orderBy(desc(sql`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)`))
      .limit(10),
    db
      .select({
        name: assetCategories.name,
        value: sql<number>`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)`,
        count: count(),
      })
      .from(maintenanceRecords)
      .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
      .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
      .where(where)
      .groupBy(assetCategories.name)
      .orderBy(desc(sql`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)`))
      .limit(10),
    db
      .select({
        name: vendors.name,
        value: sql<number>`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)`,
        count: count(),
      })
      .from(maintenanceRecords)
      .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
      .leftJoin(vendors, eq(maintenanceRecords.vendorId, vendors.id))
      .where(where)
      .groupBy(vendors.name)
      .orderBy(desc(sql`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)`))
      .limit(10),
    db
      .select({
        name: departments.name,
        value: sql<number>`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)`,
        count: count(),
      })
      .from(maintenanceRecords)
      .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
      .leftJoin(departments, eq(assets.departmentId, departments.id))
      .where(where)
      .groupBy(departments.name)
      .orderBy(desc(sql`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)`))
      .limit(10),
    db
      .select({
        month: sql<string>`to_char(${maintenanceRecords.createdAt}, 'YYYY-MM')`,
        value: sql<number>`COALESCE(SUM(${maintenanceRecords.totalCost}), 0)`,
      })
      .from(maintenanceRecords)
      .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
      .where(where)
      .groupBy(sql`to_char(${maintenanceRecords.createdAt}, 'YYYY-MM')`),
  ]);

  const bucket = (rows: { name: string | null; value: unknown; count: number }[]): CostBucket[] =>
    rows.map((r) => ({ name: r.name ?? 'Unassigned', value: num(r.value), count: num(r.count) }));

  const map = new Map(trendRows.map((r) => [r.month, num(r.value)]));
  const monthlyTrend: CostAnalytics['monthlyTrend'] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    monthlyTrend.push({
      month: key,
      label: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
      value: map.get(key) ?? 0,
    });
  }

  return {
    topAssets: bucket(topAssets as any),
    topCategories: bucket(topCategories as any),
    topVendors: bucket(topVendors as any),
    topDepartments: bucket(topDepartments as any),
    monthlyTrend,
  };
}
