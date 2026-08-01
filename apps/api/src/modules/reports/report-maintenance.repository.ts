import { getDb } from '@/database/client';
import {
  maintenanceRecords,
  assets,
  assetCategories,
  maintenanceTypes,
  vendors,
  departments,
  sites,
  buildings,
  floors,
  rooms,
  users,
} from '@/database/schema';
import { alias } from 'drizzle-orm/pg-core';
import { eq, and, sql, desc, asc, count } from 'drizzle-orm';
import type { SQL, SQLWrapper } from 'drizzle-orm';
import { toDateString, todayString } from '@/modules/maintenance-schedules/schedule.date';

const technicianUsers = alias(users, 'technician_users');
const createdByUsers = alias(users, 'created_by_users');

export interface MaintenanceReportFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  maintenanceTypeId?: string;
  assetId?: string;
  assetCategoryId?: string;
  priority?: string;
  status?: string;
  technicianId?: string;
  vendorId?: string;
  departmentId?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MaintenanceReportSummary {
  total: number;
  scheduled: number;
  inProgress: number;
  waitingPart: number;
  testing: number;
  completed: number;
  cancelled: number;
  overdue: number;
  averageResolutionHours: number;
}

const SORT_COLUMNS: Record<string, SQLWrapper> = {
  maintenance_code: maintenanceRecords.maintenanceCode,
  created_at: maintenanceRecords.createdAt,
  scheduled_date: maintenanceRecords.scheduledDate,
  completed_at: maintenanceRecords.finishDate,
  priority: maintenanceRecords.priority,
  status: maintenanceRecords.status,
};

function buildWhere(filters: MaintenanceReportFilters): SQL[] {
  const conditions: SQL[] = [];

  if (filters.keyword) {
    const p = `%${filters.keyword}%`;
    conditions.push(
      sql`(${maintenanceRecords.maintenanceCode} ILIKE ${p} OR ${assets.assetCode} ILIKE ${p} OR ${assets.assetName} ILIKE ${p} OR ${maintenanceRecords.problem} ILIKE ${p})`,
    );
  }
  if (filters.maintenanceTypeId) conditions.push(eq(maintenanceRecords.maintenanceTypeId, sql`${filters.maintenanceTypeId}::uuid`));
  if (filters.assetId) conditions.push(eq(maintenanceRecords.assetId, sql`${filters.assetId}::uuid`));
  if (filters.assetCategoryId) conditions.push(eq(assets.categoryId, sql`${filters.assetCategoryId}::uuid`));
  if (filters.priority) conditions.push(eq(maintenanceRecords.priority, sql`${filters.priority}::varchar`));
  if (filters.status) conditions.push(eq(maintenanceRecords.status, sql`${filters.status}::varchar`));
  if (filters.technicianId) conditions.push(eq(maintenanceRecords.technicianId, sql`${filters.technicianId}::uuid`));
  if (filters.vendorId) conditions.push(eq(maintenanceRecords.vendorId, sql`${filters.vendorId}::uuid`));
  if (filters.departmentId) conditions.push(eq(assets.departmentId, sql`${filters.departmentId}::uuid`));
  if (filters.siteId) conditions.push(eq(assets.siteId, sql`${filters.siteId}::uuid`));
  if (filters.buildingId) conditions.push(eq(assets.buildingId, sql`${filters.buildingId}::uuid`));
  if (filters.floorId) conditions.push(eq(assets.floorId, sql`${filters.floorId}::uuid`));
  if (filters.roomId) conditions.push(eq(assets.roomId, sql`${filters.roomId}::uuid`));
  if (filters.startDate) conditions.push(sql`${maintenanceRecords.createdAt} >= ${filters.startDate}::date`);
  if (filters.endDate) conditions.push(sql`${maintenanceRecords.createdAt} <= ${filters.endDate}::date + interval '1 day'`);

  return conditions;
}

export async function maintenanceReport(filters: MaintenanceReportFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const where = and(...buildWhere(filters));

  const sortCol = SORT_COLUMNS[filters.sortBy ?? ''] ?? SORT_COLUMNS.created_at;
  const orderFn = filters.sortOrder === 'asc' ? asc : desc;

  const rows = await db
    .select({
      id: maintenanceRecords.id,
      assetId: maintenanceRecords.assetId,
      maintenanceCode: maintenanceRecords.maintenanceCode,
      maintenanceCategory: maintenanceRecords.maintenanceCategory,
      problem: maintenanceRecords.problem,
      priority: maintenanceRecords.priority,
      status: maintenanceRecords.status,
      scheduledDate: maintenanceRecords.scheduledDate,
      startDate: maintenanceRecords.startDate,
      finishDate: maintenanceRecords.finishDate,
      createdAt: maintenanceRecords.createdAt,
      updatedAt: maintenanceRecords.updatedAt,
      assetCode: assets.assetCode,
      assetName: assets.assetName,
      assetCategoryName: assetCategories.name,
      maintenanceTypeName: maintenanceTypes.name,
      technicianName: technicianUsers.name,
      vendorName: vendors.name,
      departmentName: departments.name,
      siteName: sites.name,
      buildingName: buildings.name,
      floorName: floors.name,
      roomName: rooms.name,
      createdByName: createdByUsers.name,
    })
    .from(maintenanceRecords)
    .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(maintenanceTypes, eq(maintenanceRecords.maintenanceTypeId, maintenanceTypes.id))
    .leftJoin(technicianUsers, eq(maintenanceRecords.technicianId, technicianUsers.id))
    .leftJoin(vendors, eq(maintenanceRecords.vendorId, vendors.id))
    .leftJoin(departments, eq(assets.departmentId, departments.id))
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .leftJoin(buildings, eq(assets.buildingId, buildings.id))
    .leftJoin(floors, eq(assets.floorId, floors.id))
    .leftJoin(rooms, eq(assets.roomId, rooms.id))
    .leftJoin(createdByUsers, eq(maintenanceRecords.createdBy, createdByUsers.id))
    .where(where)
    .orderBy(orderFn(sortCol))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(maintenanceRecords).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  const summary = await buildSummary(where);

  const today = todayString();
  const items = rows.map((row) => {
    const scheduled = toDateString(row.scheduledDate);
    const start = row.startDate ? new Date(row.startDate).getTime() : null;
    const finish = row.finishDate ? new Date(row.finishDate).getTime() : null;
    const durationHours = start && finish ? Math.round(((finish - start) / 3600000) * 10) / 10 : null;
    return {
      id: row.id,
      maintenanceCode: row.maintenanceCode,
      maintenanceCategory: row.maintenanceCategory,
      problem: row.problem,
      priority: row.priority,
      status: row.status,
      scheduledDate: scheduled,
      startDate: row.startDate,
      finishDate: row.finishDate,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      asset: {
        assetCode: row.assetCode,
        assetName: row.assetName,
        category: row.assetCategoryName,
      },
      maintenanceType: row.maintenanceTypeName,
      technician: row.technicianName,
      vendor: row.vendorName,
      department: row.departmentName,
      site: row.siteName,
      building: row.buildingName,
      floor: row.floorName,
      room: row.roomName,
      createdBy: row.createdByName,
      durationHours,
      overdue: row.status !== 'COMPLETED' && !!scheduled && scheduled < today,
    } as any;
  });

  return {
    items,
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

async function buildSummary(where: SQL | undefined): Promise<MaintenanceReportSummary> {
  const db = getDb();

  const overdueConditions: SQL[] = [
    sql`${maintenanceRecords.scheduledDate} < current_date AND ${maintenanceRecords.status} <> 'COMPLETED'`,
  ];
  if (where) overdueConditions.push(where);

  const avgConditions: SQL[] = [
    eq(maintenanceRecords.status, 'COMPLETED'),
    sql`${maintenanceRecords.finishDate} IS NOT NULL`,
    sql`${maintenanceRecords.startDate} IS NOT NULL`,
  ];
  if (where) avgConditions.push(where);

  const [statusRows, overdueResult, avgResult] = await Promise.all([
    db.select({ status: maintenanceRecords.status, value: count() }).from(maintenanceRecords).where(where).groupBy(maintenanceRecords.status),
    db.select({ value: count() }).from(maintenanceRecords).where(and(...overdueConditions)),
    db.execute(
      sql`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (${maintenanceRecords.finishDate} - ${maintenanceRecords.startDate})) / 3600), 0)::float AS value
          FROM ${maintenanceRecords}
          WHERE ${and(...avgConditions)}`,
    ),
  ]);

  const statusMap = new Map(statusRows.map((r) => [r.status, Number(r.value)]));
  const countOf = (key: string) => statusMap.get(key) ?? 0;
  const avgRow = (avgResult as any[])[0];

  return {
    total: Array.from(statusMap.values()).reduce((acc, n) => acc + n, 0),
    scheduled: countOf('OPEN') + countOf('ASSIGNED'),
    inProgress: countOf('IN_PROGRESS'),
    waitingPart: countOf('WAITING_PART'),
    testing: countOf('TESTING'),
    completed: countOf('COMPLETED'),
    cancelled: countOf('CANCELLED'),
    overdue: Number(overdueResult[0]?.value ?? 0),
    averageResolutionHours: Math.round((Number(avgRow?.value ?? 0) * 10)) / 10,
  };
}
