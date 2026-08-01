import { getDb } from '@/database/client';
import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export interface MovementFilters {
  page?: number;
  limit?: number;
  keyword?: string;
  assetId?: string;
  departmentId?: string;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MovementSummary {
  total: number;
  totalMovements: number;
  totalAssignments: number;
  totalReturns: number;
  assetsMoved: number;
}

const CTE = `
  WITH combined AS (
    SELECT
      m.id AS id,
      'MOVEMENT' AS type,
      a.id AS asset_id,
      a.asset_code,
      a.asset_name,
      a.department_id AS asset_department_id,
      a.site_id AS asset_site_id,
      a.building_id AS asset_building_id,
      a.floor_id AS asset_floor_id,
      a.room_id AS asset_room_id,
      concat_ws(' / ', rs.name, rb.name, rf.name, rr.name) AS from_label,
      concat_ws(' / ', ts.name, tb.name, tf.name, tr.name) AS to_label,
      m.movement_date AS event_date,
      m.reason AS notes,
      u.name AS performed_by,
      m.created_at
    FROM asset_movements m
    JOIN assets a ON a.id = m.asset_id
    LEFT JOIN sites rs ON rs.id = m.from_site_id
    LEFT JOIN buildings rb ON rb.id = m.from_building_id
    LEFT JOIN floors rf ON rf.id = m.from_floor_id
    LEFT JOIN rooms rr ON rr.id = m.from_room_id
    LEFT JOIN sites ts ON ts.id = m.to_site_id
    LEFT JOIN buildings tb ON tb.id = m.to_building_id
    LEFT JOIN floors tf ON tf.id = m.to_floor_id
    LEFT JOIN rooms tr ON tr.id = m.to_room_id
    LEFT JOIN users u ON u.id = m.moved_by
    UNION ALL
    SELECT
      am.id,
      CASE WHEN am.status = 'RETURNED' THEN 'RETURN' ELSE 'ASSIGNMENT' END AS type,
      a.id,
      a.asset_code,
      a.asset_name,
      a.department_id,
      a.site_id,
      a.building_id,
      a.floor_id,
      a.room_id,
      '' AS from_label,
      u.name AS to_label,
      am.assigned_date AS event_date,
      am.notes,
      ua.name AS performed_by,
      am.created_at
    FROM asset_assignments am
    JOIN assets a ON a.id = am.asset_id
    LEFT JOIN users u ON u.id = am.user_id
    LEFT JOIN users ua ON ua.id = am.assigned_by
  )
`;

function buildWhere(filters: MovementFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.keyword) {
    const p = `%${filters.keyword}%`;
    conditions.push(sql`(combined.asset_code ILIKE ${p} OR combined.asset_name ILIKE ${p})`);
  }
  if (filters.assetId) conditions.push(sql`combined.asset_id = ${filters.assetId}::uuid`);
  if (filters.departmentId) conditions.push(sql`combined.asset_department_id = ${filters.departmentId}::uuid`);
  if (filters.siteId) conditions.push(sql`combined.asset_site_id = ${filters.siteId}::uuid`);
  if (filters.buildingId) conditions.push(sql`combined.asset_building_id = ${filters.buildingId}::uuid`);
  if (filters.floorId) conditions.push(sql`combined.asset_floor_id = ${filters.floorId}::uuid`);
  if (filters.roomId) conditions.push(sql`combined.asset_room_id = ${filters.roomId}::uuid`);
  if (filters.dateFrom) conditions.push(sql`combined.event_date >= ${filters.dateFrom}::date`);
  if (filters.dateTo) conditions.push(sql`combined.event_date <= ${filters.dateTo}::date`);
  return conditions;
}

export async function movementReport(filters: MovementFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const conditions = buildWhere(filters);
  const whereSql = conditions.length > 0 ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;
  const orderSql = filters.sortBy === 'asset_code' ? sql`combined.asset_code ${filters.sortOrder === 'asc' ? sql`ASC` : sql`DESC`}` : sql`combined.event_date DESC, combined.created_at DESC`;

  const rows = await db.execute(sql`
    ${sql.raw(CTE)}
    SELECT * FROM combined ${whereSql} ORDER BY ${orderSql} LIMIT ${limit} OFFSET ${offset}
  `);

  const summaryRows = await db.execute(sql`
    ${sql.raw(CTE)}
    SELECT type, count(*)::int AS n, count(DISTINCT asset_id)::int AS assets FROM combined ${whereSql} GROUP BY type
  `);

  const summaryRowsArr = summaryRows as unknown as { type: string; n: number; assets: number }[];
  const totalEvents = summaryRowsArr.reduce((acc, r) => acc + r.n, 0);
  const assetsMoved = summaryRowsArr.reduce((acc, r) => acc + r.assets, 0);

  const summary: MovementSummary = {
    total: totalEvents,
    totalMovements: summaryRowsArr.find((r) => r.type === 'MOVEMENT')?.n ?? 0,
    totalAssignments: summaryRowsArr.find((r) => r.type === 'ASSIGNMENT')?.n ?? 0,
    totalReturns: summaryRowsArr.find((r) => r.type === 'RETURN')?.n ?? 0,
    assetsMoved,
  };

  const items = (rows as unknown[]).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: row.id,
      assetId: row.asset_id,
      type: row.type,
      assetCode: row.asset_code,
      assetName: row.asset_name,
      fromLabel: row.from_label || null,
      toLabel: row.to_label || null,
      eventDate: row.event_date,
      notes: row.notes,
      performedBy: row.performed_by,
      createdAt: row.created_at,
    } as any;
  });

  return {
    items,
    summary,
    analytics: {
      byType: [
        { name: 'Movements', value: summary.totalMovements },
        { name: 'Assignments', value: summary.totalAssignments },
        { name: 'Returns', value: summary.totalReturns },
      ],
    },
    meta: { page, limit, total: totalEvents, totalPages: Math.ceil(totalEvents / limit), hasNextPage: page * limit < totalEvents, hasPreviousPage: page > 1 },
  };
}
