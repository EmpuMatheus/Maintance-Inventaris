import { getDb } from '@/database/client';
import {
  assets,
  assetCategories,
  departments,
  vendors,
  maintenanceRecords,
  maintenanceTypes,
  tickets,
} from '@/database/schema';
import { sql, eq, and, gte, count, desc, inArray } from 'drizzle-orm';
import * as scheduleService from '@/modules/maintenance-schedules/schedule.service';
import { unreadCount as getUnreadCount, list as listNotifications } from '@/modules/notifications/notification.service';
import type { DueFilters } from '@/modules/maintenance-schedules/schedule.repository';
import type { AssetScope } from '@/middleware/scope';
import type { SQL } from 'drizzle-orm';

/** Builds a WHERE fragment that constrains an assets query to the given scope. */
function buildAssetScopeCondition(scope: AssetScope): SQL | undefined {
  if (scope.ownUserId) return eq(assets.currentPicId, sql`${scope.ownUserId}::uuid`);
  if (scope.categoryIds && scope.categoryIds.length > 0) return inArray(assets.categoryId, scope.categoryIds);
  return undefined;
}

/**
 * Full WHERE for asset-scoped dashboard queries. Keeps every widget consistent
 * with the Inventory list: soft-deleted and RETIRED assets are always excluded,
 * and ADMIN/TECHNICIAN are limited to their categories via the shared scope.
 */
function assetBaseCondition(scope: AssetScope, extra: SQL[] = []): SQL | undefined {
  return and(
    sql`${assets.deletedAt} IS NULL`,
    sql`${assets.status} != 'RETIRED'`,
    buildAssetScopeCondition(scope),
    ...extra,
  );
}

/** Builds a WHERE fragment that constrains a tickets query to the scope's categories. */
function buildTicketCategoryCondition(scope: AssetScope): SQL | undefined {
  if (scope.categoryIds && scope.categoryIds.length > 0) return inArray(assets.categoryId, scope.categoryIds);
  return undefined;
}

function dueFilters(scope: AssetScope, extra: Record<string, unknown> = {}): DueFilters & Record<string, unknown> {
  return scope.categoryIds?.length ? { ...extra, categoryIds: scope.categoryIds } : extra;
}

export async function getMySummary(userId: string) {
  const db = getDb();
  const myAssetsWhere = and(sql`${assets.deletedAt} IS NULL`, eq(assets.currentPicId, sql`${userId}::uuid`));
  const myOpenTicketsWhere = and(
    sql`${tickets.status} IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD')`,
    eq(tickets.reporterId, sql`${userId}::uuid`),
  );

  const [assetCount, ticketCount, maintCount] = await Promise.all([
    db.select({ value: count() }).from(assets).where(myAssetsWhere),
    db.select({ value: count() }).from(tickets).where(myOpenTicketsWhere),
    db
      .select({ value: count() })
      .from(maintenanceRecords)
      .innerJoin(assets, eq(maintenanceRecords.assetId, assets.id))
      .where(eq(assets.currentPicId, sql`${userId}::uuid`)),
  ]);

  const recent = await listNotifications(userId, { page: 1, limit: 5 });

  return {
    myAssets: Number(assetCount[0]?.value ?? 0),
    myOpenTickets: Number(ticketCount[0]?.value ?? 0),
    myMaintenance: Number(maintCount[0]?.value ?? 0),
    notificationsUnread: await getUnreadCount(userId),
    recentNotifications: recent.data,
  };
}

export async function getSummary(userId?: string, scope: AssetScope = {}) {
  const db = getDb();
  const rows = await db
    .select({ condition: assets.condition, status: assets.status })
    .from(assets)
    .where(assetBaseCondition(scope));

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
    scheduleService.dueToday(dueFilters(scope, { limit: 1 })),
    scheduleService.upcoming({ days: 365, limit: 1, ...dueFilters(scope) }),
    scheduleService.overdue(dueFilters(scope, { limit: 1 })),
  ]);

  return {
    assets: { total, good, fair, needAttention, broken, critical, inMaintenance },
    maintenance: {
      dueToday: dueToday.meta.total,
      upcoming: upcoming.meta.total,
      overdue: overdue.meta.total,
      completedThisMonth: await countCompletedThisMonth(scope),
    },
    tickets: await getTicketStats(scope),
    notifications: { unread: userId ? await getUnreadCount(userId) : 0 },
  };
}

export async function getTicketStats(scope: AssetScope = {}) {
  const db = getDb();
  const active = sql`${tickets.status} IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'ON_HOLD')`;
  const categoryCond = buildTicketCategoryCondition(scope);

  const openResult = await db
    .select({ value: count() })
    .from(tickets)
    .leftJoin(assets, eq(tickets.assetId, assets.id))
    .where(and(active, categoryCond));
  const criticalResult = await db
    .select({ value: count() })
    .from(tickets)
    .leftJoin(assets, eq(tickets.assetId, assets.id))
    .where(and(active, eq(tickets.priority, 'CRITICAL'), categoryCond));
  const resolvedTodayResult = await db
    .select({ value: count() })
    .from(tickets)
    .leftJoin(assets, eq(tickets.assetId, assets.id))
    .where(and(sql`${tickets.resolvedAt}::date = current_date`, categoryCond));
  const avgResult = await db.execute(
    sql`SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.reportedAt})) / 3600), 0)::float AS value
        FROM ${tickets}
        LEFT JOIN ${assets} ON ${tickets.assetId} = ${assets.id}
        WHERE ${tickets.resolvedAt} IS NOT NULL AND ${tickets.reportedAt} IS NOT NULL${
          categoryCond ? sql` AND ${categoryCond}` : sql``
        }`,
  );

  const avgRow = (avgResult as any[])[0];
  return {
    open: Number(openResult[0]?.value ?? 0),
    critical: Number(criticalResult[0]?.value ?? 0),
    resolvedToday: Number(resolvedTodayResult[0]?.value ?? 0),
    avgResolutionHours: Number(avgRow?.value ?? 0),
  };
}

export async function getMaintenanceStats(scope: AssetScope = {}) {
  const db = getDb();
  const categoryCond = scope.categoryIds?.length ? inArray(assets.categoryId, scope.categoryIds) : undefined;

  const byStatusRows = await db
    .select({ status: maintenanceRecords.status, value: count() })
    .from(maintenanceRecords)
    .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
    .where(categoryCond)
    .groupBy(maintenanceRecords.status);

  const byTypeRows = await db
    .select({ name: maintenanceTypes.name, value: count() })
    .from(maintenanceRecords)
    .leftJoin(maintenanceTypes, eq(maintenanceRecords.maintenanceTypeId, maintenanceTypes.id))
    .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
    .where(categoryCond)
    .groupBy(maintenanceTypes.name);

  const trendRows = await db
    .select({
      month: sql<string>`to_char(${maintenanceRecords.createdAt}, 'YYYY-MM')`,
      value: count(),
    })
    .from(maintenanceRecords)
    .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
    .where(categoryCond)
    .groupBy(sql`to_char(${maintenanceRecords.createdAt}, 'YYYY-MM')`);

  return {
    byStatus: byStatusRows.map((r) => ({ status: r.status, value: Number(r.value) })),
    byType: byTypeRows.map((r) => ({ type: r.name, value: Number(r.value) })),
    monthlyTrend: buildMonthlyTrend(trendRows.map((r) => ({ month: r.month, value: Number(r.value) }))),
  };
}

export async function getUpcomingSchedules(params: { days?: number } & DueFilters, scope: AssetScope = {}) {
  const result = await scheduleService.upcoming({ ...params, ...dueFilters(scope) });
  return { data: result.data, meta: result.meta };
}

export async function getCriticalAssets(scope: AssetScope = {}) {
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
      assetBaseCondition(scope, [sql`${assets.condition} IN ('BROKEN', 'CRITICAL', 'NEED_ATTENTION')`]),
    )
    .orderBy(sql`CASE ${assets.condition} WHEN 'CRITICAL' THEN 0 WHEN 'BROKEN' THEN 1 WHEN 'NEED_ATTENTION' THEN 2 ELSE 3 END`)
    .limit(20);
  return rows as any[];
}

export async function getAssetStats(scope: AssetScope = {}) {
  const db = getDb();
  const where = assetBaseCondition(scope);

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

export async function getConditionAnalytics(scope: AssetScope = {}) {
  const db = getDb();
  const rows = await db
    .select({ condition: assets.condition, value: count() })
    .from(assets)
    .where(assetBaseCondition(scope))
    .groupBy(assets.condition);
  return { byCondition: rows.map((r) => ({ condition: r.condition, value: Number(r.value) })) };
}

export async function getAssetAgeAnalytics(scope: AssetScope = {}) {
  const db = getDb();
  const rows = await db
    .select({ purchaseDate: assets.purchaseDate })
    .from(assets)
    .where(assetBaseCondition(scope));

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

export async function getDepartmentAnalytics(scope: AssetScope = {}) {
  const db = getDb();
  const rows = await db
    .select({ name: departments.name, value: count() })
    .from(assets)
    .leftJoin(departments, eq(assets.departmentId, departments.id))
    .where(assetBaseCondition(scope))
    .groupBy(departments.name);
  return { byDepartment: rows.map((r) => ({ department: r.name ?? 'Unassigned', value: Number(r.value) })) };
}

export async function getVendorAnalytics(scope: AssetScope = {}) {
  const db = getDb();
  const rows = await db
    .select({ name: vendors.name, value: count() })
    .from(assets)
    .leftJoin(vendors, eq(assets.vendorId, vendors.id))
    .where(assetBaseCondition(scope))
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

/**
 * Returns only the latest "Maintenance created" activities within the user's
 * asset scope, newest first. Scope rules mirror the maintenance module:
 * own-user scope -> asset.current_pic_id, category scope -> asset.category_id.
 * Queries maintenance records directly (each one is a creation event) and
 * applies the limit in SQL so no unrelated activity is ever fetched.
 */
export async function getRecentActivity(limit = 3, scope: AssetScope = {}) {
  const db = getDb();
  const conditions: SQL[] = [];
  if (scope.ownUserId) conditions.push(eq(assets.currentPicId, sql`${scope.ownUserId}::uuid`));
  if (scope.categoryIds && scope.categoryIds.length > 0) {
    conditions.push(inArray(assets.categoryId, scope.categoryIds));
  }

  const rows = await db
    .select({
      code: maintenanceRecords.maintenanceCode,
      assetCode: assets.assetCode,
      createdAt: maintenanceRecords.createdAt,
    })
    .from(maintenanceRecords)
    .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(maintenanceRecords.createdAt))
    .limit(Math.max(1, Math.min(limit, 50)));

  return rows.map((r) => ({
    type: 'MAINTENANCE_CREATED',
    title: 'Maintenance created',
    description: r.code ?? '',
    reference: r.assetCode,
    createdAt: String(r.createdAt),
  }));
}

async function countCompletedThisMonth(scope: AssetScope = {}): Promise<number> {
  const db = getDb();
  const categoryCond = scope.categoryIds?.length ? inArray(assets.categoryId, scope.categoryIds) : undefined;
  const rows = await db
    .select({ value: count() })
    .from(maintenanceRecords)
    .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
    .where(
      and(
        eq(maintenanceRecords.status, 'COMPLETED'),
        gte(maintenanceRecords.finishDate, sql`date_trunc('month', now())`),
        categoryCond,
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
