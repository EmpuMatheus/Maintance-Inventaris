import { getDb } from '@/database/client';
import { sql } from 'drizzle-orm';
import type { AssetAnalyticsRow, AnalyticsEvent, MonthlyTrendPoint } from './analytics.types';

const ASSET_AGGREGATES_SQL = sql`
  SELECT
    a.id,
    a.asset_code,
    a.asset_name,
    a.condition,
    a.status,
    a.category_id,
    a.subcategory_id,
    a.purchase_date,
    COALESCE(a.purchase_price, 0) AS purchase_price,
    GREATEST(
      EXTRACT(EPOCH FROM (now() - COALESCE(a.purchase_date::timestamptz, a.created_at))) / 86400,
      0
    ) AS age_days,
    COALESCE((SELECT count(*) FROM maintenance_records mr WHERE mr.asset_id = a.id AND mr.status = 'COMPLETED'), 0) AS completed_maintenance,
    COALESCE((SELECT count(*) FROM maintenance_records mr WHERE mr.asset_id = a.id AND mr.status = 'COMPLETED' AND mr.maintenance_category = 'CORRECTIVE'), 0) AS corrective_maintenance,
    COALESCE((SELECT count(*) FROM maintenance_records mr WHERE mr.asset_id = a.id AND mr.maintenance_category = 'PREVENTIVE'), 0) AS preventive_maintenance,
    COALESCE((SELECT SUM(COALESCE(mr.total_cost, 0)) FROM maintenance_records mr WHERE mr.asset_id = a.id AND mr.status = 'COMPLETED'), 0) AS total_maintenance_cost,
    COALESCE((SELECT SUM(COALESCE(mr.downtime_minutes, (EXTRACT(EPOCH FROM (mr.finish_date - mr.start_date)) / 60)::int)) FROM maintenance_records mr WHERE mr.asset_id = a.id AND mr.status = 'COMPLETED'), 0) AS total_downtime_minutes,
    (SELECT AVG(EXTRACT(EPOCH FROM (mr.finish_date - mr.start_date)) / 60) FROM maintenance_records mr WHERE mr.asset_id = a.id AND mr.status = 'COMPLETED' AND mr.finish_date IS NOT NULL AND mr.start_date IS NOT NULL) AS mttr_minutes,
    COALESCE((SELECT count(*) FROM tickets t WHERE t.asset_id = a.id), 0) AS ticket_count,
    COALESCE((SELECT count(*) FROM asset_condition_history h WHERE h.asset_id = a.id AND h.new_condition IN ('BROKEN', 'CRITICAL')), 0) AS critical_events,
    (SELECT max(h.created_at) FROM asset_condition_history h WHERE h.asset_id = a.id) AS last_condition_change,
    a.health_score,
    a.repeated_failure
  FROM assets a
  WHERE a.deleted_at IS NULL
`;

interface AggregateRow {
  id: string;
  asset_code: string;
  asset_name: string;
  condition: string;
  status: string;
  category_id: string | null;
  subcategory_id: string | null;
  purchase_date: string | null;
  purchase_price: string;
  age_days: string;
  completed_maintenance: string;
  corrective_maintenance: string;
  preventive_maintenance: string;
  total_maintenance_cost: string;
  total_downtime_minutes: string;
  mttr_minutes: string | null;
  ticket_count: string;
  critical_events: string;
  last_condition_change: string | null;
  health_score: string | null;
  repeated_failure: boolean;
}

function num(v: string | number | null | undefined): number {
  return v == null || v === '' ? 0 : Number(v);
}

/**
 * Single aggregate query returning per-asset analytics facts. Avoids N+1 by
 * aggregating maintenance, tickets and condition history in one statement.
 */
export async function getAssetAnalyticsRows(): Promise<AssetAnalyticsRow[]> {
  const db = getDb();
  const rows = (await db.execute(ASSET_AGGREGATES_SQL)) as unknown as AggregateRow[];
  return rows.map((r) => ({
    id: r.id,
    assetCode: r.asset_code,
    assetName: r.asset_name,
    condition: r.condition,
    status: r.status,
    categoryId: r.category_id,
    subcategoryId: r.subcategory_id,
    purchaseDate: r.purchase_date,
    purchasePrice: num(r.purchase_price),
    ageDays: num(r.age_days),
    completedMaintenance: num(r.completed_maintenance),
    correctiveMaintenance: num(r.corrective_maintenance),
    preventiveMaintenance: num(r.preventive_maintenance),
    totalMaintenanceCost: num(r.total_maintenance_cost),
    totalDowntimeMinutes: num(r.total_downtime_minutes),
    mttrMinutes: r.mttr_minutes == null ? null : num(r.mttr_minutes),
    ticketCount: num(r.ticket_count),
    criticalEvents: num(r.critical_events),
    lastConditionChangeAt: r.last_condition_change,
    storedHealthScore: r.health_score == null ? null : num(r.health_score),
    storedRepeatedFailure: Boolean(r.repeated_failure),
  }));
}

export async function getMaintenanceMonthlyTrend(months = 12): Promise<MonthlyTrendPoint[]> {
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT
      to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
      count(*)::int AS value
    FROM maintenance_records
    WHERE created_at >= now() - interval '${sql.raw(String(months))} months'
    GROUP BY 1 ORDER BY 1
  `)) as unknown as { month: string; value: number }[];
  return rows.map((r) => ({ month: r.month, label: monthLabel(r.month), value: r.value }));
}

export async function getTicketMonthlyTrend(months = 12): Promise<MonthlyTrendPoint[]> {
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT
      to_char(date_trunc('month', reported_at), 'YYYY-MM') AS month,
      count(*)::int AS value
    FROM tickets
    WHERE reported_at >= now() - interval '${sql.raw(String(months))} months'
    GROUP BY 1 ORDER BY 1
  `)) as unknown as { month: string; value: number }[];
  return rows.map((r) => ({ month: r.month, label: monthLabel(r.month), value: r.value }));
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[Number(m) - 1]} ${y.slice(2)}`;
}

export async function getRecentEvents(limit = 10): Promise<AnalyticsEvent[]> {
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT
      e.id, e.asset_id, e.event_type, e.severity, e.title, e.message, e.created_at,
      a.asset_code, a.asset_name
    FROM analytics_events e
    LEFT JOIN assets a ON a.id = e.asset_id
    ORDER BY e.created_at DESC
    LIMIT ${sql.raw(String(Math.min(limit, 50)))}
  `)) as unknown as {
    id: string;
    asset_id: string | null;
    asset_code: string | null;
    asset_name: string | null;
    event_type: string;
    severity: string;
    title: string;
    message: string | null;
    created_at: string;
  }[];
  return rows.map((r) => ({
    id: r.id,
    assetId: r.asset_id,
    assetCode: r.asset_code,
    assetName: r.asset_name,
    eventType: r.event_type,
    severity: r.severity,
    title: r.title,
    message: r.message,
    createdAt: r.created_at,
  }));
}

export async function insertAnalyticsEvent(input: {
  assetId: string | null;
  eventType: string;
  severity: string;
  title: string;
  message: string | null;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    INSERT INTO analytics_events (id, asset_id, event_type, severity, title, message, meta, created_at)
    VALUES (
      gen_random_uuid(),
      ${input.assetId === null ? sql`NULL` : sql`${input.assetId}::uuid`},
      ${input.eventType},
      ${input.severity},
      ${input.title},
      ${input.message},
      ${input.meta ? sql`${JSON.stringify(input.meta)}::jsonb` : sql`NULL`},
      now()
    )
  `);
}

export async function persistAssetAnalytics(assetId: string, healthScore: number, repeatedFailure: boolean): Promise<void> {
  const db = getDb();
  await db.execute(sql`
    UPDATE assets
    SET health_score = ${healthScore},
        health_score_updated_at = now(),
        repeated_failure = ${repeatedFailure},
        updated_at = now()
    WHERE id = ${assetId}::uuid
  `);
}

/** Returns true when an event of the given type was recorded for the asset recently. */
export async function hasRecentEvent(assetId: string, eventType: string, withinDays: number): Promise<boolean> {
  const db = getDb();
  const rows = (await db.execute(sql`
    SELECT 1 FROM analytics_events
    WHERE asset_id = ${assetId}::uuid
      AND event_type = ${eventType}
      AND created_at >= now() - interval '${sql.raw(String(withinDays))} days'
    LIMIT 1
  `)) as unknown as unknown[];
  return rows.length > 0;
}
