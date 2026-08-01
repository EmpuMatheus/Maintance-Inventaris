import { getDb } from '@/database/client';
import {
  assets,
  assetCategories,
  assetConditionHistory,
  assetMovements,
  assetAssignments,
  departments,
  vendors,
  rooms,
  maintenanceRecords,
  maintenanceTypes,
  tickets,
} from '@/database/schema';
import { alias } from 'drizzle-orm/pg-core';
import { sql, eq, and, gte, count, desc } from 'drizzle-orm';
import * as scheduleService from '@/modules/maintenance-schedules/schedule.service';
import { unreadCount as getUnreadCount } from '@/modules/notifications/notification.service';
import type { DueFilters } from '@/modules/maintenance-schedules/schedule.repository';

const toRooms = alias(rooms, 'to_rooms');

export async function getSummary(userId?: string) {
  const db = getDb();
  const rows = await db
    .select({ condition: assets.condition, status: assets.status })
    .from(assets)
    .where(sql`${assets.deletedAt} IS NULL`);

  let total = 0;
  let good = 0;
  let fair = 0;
  let needAttention = 0;
  let broken = 0;
  let critical = 0;
  let inMaintenance = 0;

  for (const r of rows) {
    total += 1;
    if (r.condition === 'GOOD') good += 1;
    else if (r.condition === 'FAIR') fair += 1;
    else if (r.condition === 'NEED_ATTENTION') needAttention += 1;
    else if (r.condition === 'BROKEN') broken += 1;
    else if (r.condition === 'CRITICAL') critical += 1;
    if (r.status === 'IN_MAINTENANCE') inMaintenance += 1;
  }

  const [dueToday, upcoming, overdue] = await Promise.all([
    scheduleService.dueToday({ limit: 1 }),
    scheduleService.upcoming({ days: 365, limit: 1 }),
    scheduleService.overdue({ limit: 1 }),
  ]);

  return {
    assets: { total, good, fair, needAttention, broken, critical, inMaintenance },
    maintenance: {
      dueToday: dueToday.meta.total,
      upcoming: upcoming.meta.total,
      overdue: overdue.meta.total,
      completedThisMonth: await countCompletedThisMonth(),
    },
    tickets: await getTicketStats(),
    notifications: { unread: userId ? await getUnreadCount(userId) : 0 },
  };
}

export async function getTicketStats() {
  const db = getDb();
  const active = sql`${tickets.status} IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD')`;

  const openResult = await db.select({ value: count() }).from(tickets).where(active);
  const criticalResult = await db
    .select({ value: count() })
    .from(tickets)
    .where(and(active, eq(tickets.priority, 'CRITICAL')));
  const resolvedTodayResult = await db
    .select({ value: count() })
    .from(tickets)
    .where(sql`${tickets.resolvedAt}::date = current_date`);
  const avgResult = await db.execute(
    sql`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.reportedAt})) / 3600), 0)::float AS value
        FROM ${tickets}
        WHERE ${tickets.resolvedAt} IS NOT NULL AND ${tickets.reportedAt} IS NOT NULL`,
  );

  const avgRow = (avgResult as any[])[0];
  return {
    open: Number(openResult[0]?.value ?? 0),
    critical: Number(criticalResult[0]?.value ?? 0),
    resolvedToday: Number(resolvedTodayResult[0]?.value ?? 0),
    avgResolutionHours: Number(avgRow?.value ?? 0),
  };
}

export async function getMaintenanceStats() {
  const db = getDb();

  const byStatusRows = await db
    .select({ status: maintenanceRecords.status, value: count() })
    .from(maintenanceRecords)
    .groupBy(maintenanceRecords.status);

  const byTypeRows = await db
    .select({ name: maintenanceTypes.name, value: count() })
    .from(maintenanceRecords)
    .leftJoin(maintenanceTypes, eq(maintenanceRecords.maintenanceTypeId, maintenanceTypes.id))
    .groupBy(maintenanceTypes.name);

  const trendRows = await db
    .select({
      month: sql<string>`to_char(${maintenanceRecords.createdAt}, 'YYYY-MM')`,
      value: count(),
    })
    .from(maintenanceRecords)
    .groupBy(sql`to_char(${maintenanceRecords.createdAt}, 'YYYY-MM')`);

  return {
    byStatus: byStatusRows.map((r) => ({ status: r.status, value: Number(r.value) })),
    byType: byTypeRows.map((r) => ({ type: r.name, value: Number(r.value) })),
    monthlyTrend: buildMonthlyTrend(trendRows.map((r) => ({ month: r.month, value: Number(r.value) }))),
  };
}

export async function getUpcomingSchedules(params: { days?: number } & DueFilters) {
  const result = await scheduleService.upcoming(params);
  return { data: result.data, meta: result.meta };
}

export async function getCriticalAssets() {
  const db = getDb();
  const rows = await db
    .select({
      id: assets.id,
      assetCode: assets.assetCode,
      assetName: assets.assetName,
      condition: assets.condition,
      status: assets.status,
    })
    .from(assets)
    .where(
      and(
        sql`${assets.deletedAt} IS NULL`,
        sql`${assets.condition} IN ('BROKEN', 'CRITICAL', 'NEED_ATTENTION')`,
      ),
    )
    .orderBy(sql`CASE ${assets.condition} WHEN 'CRITICAL' THEN 0 WHEN 'BROKEN' THEN 1 WHEN 'NEED_ATTENTION' THEN 2 ELSE 3 END`)
    .limit(20);
  return rows as any[];
}

export async function getAssetStats() {
  const db = getDb();
  const where = sql`${assets.deletedAt} IS NULL`;

  const byStatusRows = await db
    .select({ status: assets.status, value: count() })
    .from(assets)
    .where(where)
    .groupBy(assets.status);

  const byCategoryRows = await db
    .select({ name: assetCategories.name, value: count() })
    .from(assets)
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .where(where)
    .groupBy(assetCategories.name);

  return {
    byStatus: byStatusRows.map((r) => ({ status: r.status, value: Number(r.value) })),
    byCategory: byCategoryRows.map((r) => ({ category: r.name ?? 'Unassigned', value: Number(r.value) })),
  };
}

export async function getConditionAnalytics() {
  const db = getDb();
  const rows = await db
    .select({ condition: assets.condition, value: count() })
    .from(assets)
    .where(sql`${assets.deletedAt} IS NULL`)
    .groupBy(assets.condition);
  return { byCondition: rows.map((r) => ({ condition: r.condition, value: Number(r.value) })) };
}

export async function getAssetAgeAnalytics() {
  const db = getDb();
  const rows = await db
    .select({ purchaseDate: assets.purchaseDate })
    .from(assets)
    .where(sql`${assets.deletedAt} IS NULL`);

  const buckets = ['< 1 year', '1-2 years', '2-3 years', '3-5 years', '5-10 years', '> 10 years'];
  const counts = new Map<string, number>(buckets.map((b) => [b, 0]));
  let unknown = 0;
  const now = new Date();

  for (const r of rows) {
    if (!r.purchaseDate) {
      unknown += 1;
      continue;
    }
    const years = (now.getTime() - new Date(r.purchaseDate as string | Date).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    let key = '> 10 years';
    if (years < 1) key = '< 1 year';
    else if (years < 2) key = '1-2 years';
    else if (years < 3) key = '2-3 years';
    else if (years < 5) key = '3-5 years';
    else if (years < 10) key = '5-10 years';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const data = buckets.map((b) => ({ bucket: b, value: counts.get(b) ?? 0 }));
  if (unknown > 0) data.push({ bucket: 'Unknown', value: unknown });
  return { byAge: data };
}

export async function getDepartmentAnalytics() {
  const db = getDb();
  const rows = await db
    .select({ name: departments.name, value: count() })
    .from(assets)
    .leftJoin(departments, eq(assets.departmentId, departments.id))
    .where(sql`${assets.deletedAt} IS NULL`)
    .groupBy(departments.name);
  return { byDepartment: rows.map((r) => ({ department: r.name ?? 'Unassigned', value: Number(r.value) })) };
}

export async function getVendorAnalytics() {
  const db = getDb();
  const rows = await db
    .select({ name: vendors.name, value: count() })
    .from(assets)
    .leftJoin(vendors, eq(assets.vendorId, vendors.id))
    .where(sql`${assets.deletedAt} IS NULL`)
    .groupBy(vendors.name);
  return { byVendor: rows.map((r) => ({ vendor: r.name ?? 'Unassigned', value: Number(r.value) })) };
}

export interface RecentActivityItem {
  type: string;
  title: string;
  description: string;
  reference: string | null;
  createdAt: string;
}

export async function getRecentActivity(limit = 20) {
  const db = getDb();

  const [maint, conds, moves, asns] = await Promise.all([
    db
      .select({
        id: maintenanceRecords.id,
        code: maintenanceRecords.maintenanceCode,
        status: maintenanceRecords.status,
        assetCode: assets.assetCode,
        createdAt: maintenanceRecords.createdAt,
      })
      .from(maintenanceRecords)
      .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
      .orderBy(desc(maintenanceRecords.createdAt))
      .limit(50),
    db
      .select({
        id: assetConditionHistory.id,
        prev: assetConditionHistory.previousCondition,
        next: assetConditionHistory.newCondition,
        assetCode: assets.assetCode,
        createdAt: assetConditionHistory.createdAt,
      })
      .from(assetConditionHistory)
      .leftJoin(assets, eq(assetConditionHistory.assetId, assets.id))
      .orderBy(desc(assetConditionHistory.createdAt))
      .limit(50),
    db
      .select({
        id: assetMovements.id,
        assetCode: assets.assetCode,
        fromRoom: rooms.name,
        toRoom: toRooms.name,
        createdAt: assetMovements.createdAt,
      })
      .from(assetMovements)
      .leftJoin(assets, eq(assetMovements.assetId, assets.id))
      .leftJoin(rooms, eq(assetMovements.fromRoomId, rooms.id))
      .leftJoin(toRooms, eq(assetMovements.toRoomId, toRooms.id))
      .orderBy(desc(assetMovements.createdAt))
      .limit(50),
    db
      .select({
        id: assetAssignments.id,
        assetCode: assets.assetCode,
        status: assetAssignments.status,
        createdAt: assetAssignments.createdAt,
      })
      .from(assetAssignments)
      .leftJoin(assets, eq(assetAssignments.assetId, assets.id))
      .orderBy(desc(assetAssignments.createdAt))
      .limit(50),
  ]);

  const events: RecentActivityItem[] = [
    ...maint.map((r) => ({
      type: r.status === 'COMPLETED' ? 'MAINTENANCE_COMPLETED' : 'MAINTENANCE_CREATED',
      title: r.status === 'COMPLETED' ? 'Maintenance completed' : 'Maintenance created',
      description: r.code ?? '',
      reference: r.assetCode,
      createdAt: String(r.createdAt),
    })),
    ...conds.map((r) => ({
      type: 'CONDITION_CHANGED',
      title: 'Condition changed',
      description: `${r.prev} → ${r.next}`,
      reference: r.assetCode,
      createdAt: String(r.createdAt),
    })),
    ...moves.map((r) => ({
      type: 'ASSET_MOVED',
      title: 'Asset moved',
      description: `${r.fromRoom ?? '-'} → ${r.toRoom ?? '-'}`,
      reference: r.assetCode,
      createdAt: String(r.createdAt),
    })),
    ...asns.map((r) => ({
      type: 'ASSET_ASSIGNED',
      title: r.status === 'RETURNED' ? 'Asset returned' : 'Asset assigned',
      description: '',
      reference: r.assetCode,
      createdAt: String(r.createdAt),
    })),
  ];

  events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return events.slice(0, limit);
}

async function countCompletedThisMonth(): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ value: count() })
    .from(maintenanceRecords)
    .where(
      and(
        eq(maintenanceRecords.status, 'COMPLETED'),
        gte(maintenanceRecords.finishDate, sql`date_trunc('month', now())`),
      ),
    );
  return Number(rows[0]?.value ?? 0);
}

function buildMonthlyTrend(rows: { month: string; value: number }[]) {
  const map = new Map(rows.map((r) => [r.month, r.value]));
  const result: { month: string; label: string; value: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    result.push({
      month: key,
      label: d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
      value: map.get(key) ?? 0,
    });
  }
  return result;
}
