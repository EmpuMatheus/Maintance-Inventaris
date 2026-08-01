import { getDb } from '@/database/client';
import { auditLogs } from '@/database/schema';
import { eq, and, sql, desc, asc, count, like } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export interface AuditFilters {
  page?: number;
  limit?: number;
  search?: string;
  module?: string;
  action?: string;
  entityType?: string;
  performedBy?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

type Row = Record<string, unknown>;

export async function insertLog(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(auditLogs).values(data as any).returning();
  return (rows as Row[])[0] ?? null;
}

function mapRow(row: Row) {
  return {
    id: row.id as string,
    auditCode: row.auditCode as string,
    module: row.module as string,
    entityType: row.entityType as string,
    entityId: row.entityId as string | null,
    action: row.action as string,
    description: row.description as string | null,
    oldData: row.oldData ?? null,
    newData: row.newData ?? null,
    performedBy: row.userId as string | null,
    performedByName: row.performedByName as string | null,
    ipAddress: row.ipAddress as string | null,
    userAgent: row.userAgent as string | null,
    requestId: row.requestId as string | null,
    createdAt: row.createdAt,
  };
}

export async function findMany(filters: AuditFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (filters.search) {
    const p = `%${filters.search}%`;
    conditions.push(sql`(${like(auditLogs.auditCode, p)} OR ${like(auditLogs.description, p)} OR ${like(auditLogs.entityType, p)} OR ${like(auditLogs.performedByName, p)})`);
  }
  if (filters.module) conditions.push(eq(auditLogs.module, sql`${filters.module}::varchar`));
  if (filters.action) conditions.push(eq(auditLogs.action, sql`${filters.action}::varchar`));
  if (filters.entityType) conditions.push(eq(auditLogs.entityType, sql`${filters.entityType}::varchar`));
  if (filters.performedBy) conditions.push(eq(auditLogs.userId, sql`${filters.performedBy}::uuid`));
  if (filters.dateFrom) conditions.push(sql`${auditLogs.createdAt} >= ${filters.dateFrom}::date`);
  if (filters.dateTo) conditions.push(sql`${auditLogs.createdAt} <= ${filters.dateTo}::date + interval '1 day'`);

  const where = conditions.length ? and(...conditions) : undefined;
  const orderCol = filters.sortBy === 'audit_code' ? auditLogs.auditCode : auditLogs.createdAt;
  const orderFn = filters.sortOrder === 'asc' ? asc : desc;

  const rows = await db
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(orderFn(orderCol))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(auditLogs).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  return {
    data: rows.map((r) => mapRow(r as Row)),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
  };
}

export async function findById(id: string) {
  const db = getDb();
  const rows = await db.select().from(auditLogs).where(eq(auditLogs.id, sql`${id}::uuid`)).limit(1);
  const row = rows[0];
  return row ? mapRow(row as Row) : null;
}

export async function summary() {
  const db = getDb();
  const [totalResult, todayResult, byModule, byAction] = await Promise.all([
    db.select({ value: count() }).from(auditLogs),
    db.select({ value: count() }).from(auditLogs).where(sql`${auditLogs.createdAt}::date = current_date`),
    db.select({ name: auditLogs.module, value: count() }).from(auditLogs).groupBy(auditLogs.module).orderBy(sql`count(*) DESC`),
    db.select({ name: auditLogs.action, value: count() }).from(auditLogs).groupBy(auditLogs.action).orderBy(sql`count(*) DESC`),
  ]);

  return {
    total: Number(totalResult[0]?.value ?? 0),
    today: Number(todayResult[0]?.value ?? 0),
    byModule: byModule.map((r) => ({ name: r.name, value: Number(r.value) })),
    byAction: byAction.map((r) => ({ name: r.name, value: Number(r.value) })),
  };
}
