import { getDb } from '@/database/client';
import {
  maintenanceSchedules,
  maintenanceTypes,
  assets,
  maintenanceScheduleLogs,
  maintenanceRecords,
  maintenanceReminders,
} from '@/database/schema';
import { eq, and, sql, desc, asc, count, gte, lte, inArray } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { toDateString } from './schedule.date';

const BASE_JOIN = {
  scheduleId: maintenanceSchedules.id,
  assetId: maintenanceSchedules.assetId,
  maintenanceTypeId: maintenanceSchedules.maintenanceTypeId,
  frequencyType: maintenanceSchedules.frequencyType,
  frequencyValue: maintenanceSchedules.frequencyValue,
  startDate: maintenanceSchedules.startDate,
  lastMaintenanceDate: maintenanceSchedules.lastMaintenanceDate,
  nextMaintenanceDate: maintenanceSchedules.nextMaintenanceDate,
  reminderDays: maintenanceSchedules.reminderDays,
  notes: maintenanceSchedules.notes,
  isActive: maintenanceSchedules.isActive,
  createdBy: maintenanceSchedules.createdBy,
  createdAt: maintenanceSchedules.createdAt,
  updatedAt: maintenanceSchedules.updatedAt,
  assetCode: assets.assetCode,
  assetName: assets.assetName,
  maintenanceTypeName: maintenanceTypes.name,
};

type Row = Record<string, unknown>;

export function mapSchedule(row: Row) {
  return {
    id: row.scheduleId as string,
    assetId: row.assetId as string,
    maintenanceTypeId: row.maintenanceTypeId as string | null,
    frequencyType: row.frequencyType as string,
    frequencyValue: row.frequencyValue as number,
    startDate: toDateString(row.startDate),
    lastMaintenanceDate: toDateString(row.lastMaintenanceDate),
    nextMaintenanceDate: toDateString(row.nextMaintenanceDate),
    reminderDays: row.reminderDays as number | null,
    notes: row.notes as string | null,
    isActive: row.isActive as boolean,
    createdBy: row.createdBy as string | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    asset: {
      id: row.assetId as string,
      assetCode: row.assetCode as string,
      assetName: row.assetName as string,
    },
    maintenanceType: row.maintenanceTypeId
      ? { id: row.maintenanceTypeId as string, name: row.maintenanceTypeName as string }
      : null,
  };
}

export interface ScheduleFilters {
  page?: number;
  limit?: number;
  search?: string;
  assetId?: string;
  typeId?: string;
  isActive?: boolean;
  categoryIds?: string[];
}

export async function findMany(filters: ScheduleFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (filters.search) {
    const p = `%${filters.search}%`;
    conditions.push(sql`(${assets.assetCode} ILIKE ${p} OR ${assets.assetName} ILIKE ${p})`);
  }
  if (filters.assetId) conditions.push(eq(maintenanceSchedules.assetId, sql`${filters.assetId}::uuid`));
  if (filters.typeId) conditions.push(eq(maintenanceSchedules.maintenanceTypeId, sql`${filters.typeId}::uuid`));
  if (filters.isActive !== undefined) conditions.push(eq(maintenanceSchedules.isActive, filters.isActive));
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    conditions.push(inArray(assets.categoryId, filters.categoryIds));
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select(BASE_JOIN)
    .from(maintenanceSchedules)
    .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
    .leftJoin(maintenanceTypes, eq(maintenanceSchedules.maintenanceTypeId, maintenanceTypes.id))
    .where(where)
    .orderBy(asc(maintenanceSchedules.nextMaintenanceDate), desc(maintenanceSchedules.createdAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ value: count() })
    .from(maintenanceSchedules)
    .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
    .where(where);

  const total = Number(totalResult[0]?.value ?? 0);

  return {
    data: rows.map((r) => mapSchedule(r as Row)),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
  };
}

export async function findById(id: string) {
  const db = getDb();
  const rows = await db
    .select(BASE_JOIN)
    .from(maintenanceSchedules)
    .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
    .leftJoin(maintenanceTypes, eq(maintenanceSchedules.maintenanceTypeId, maintenanceTypes.id))
    .where(eq(maintenanceSchedules.id, sql`${id}::uuid`))
    .limit(1);
  const row = rows[0];
  return row ? mapSchedule(row as Row) : null;
}

export async function findRawById(id: string) {
  const db = getDb();
  const rows = await db.select().from(maintenanceSchedules).where(eq(maintenanceSchedules.id, sql`${id}::uuid`)).limit(1);
  return (rows as Row[])[0] ?? null;
}

export async function create(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(maintenanceSchedules).values(data as any).returning();
  return (rows as Row[])[0] ?? null;
}

export async function update(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db
    .update(maintenanceSchedules)
    .set({ ...data, updatedAt: sql`now()` } as any)
    .where(eq(maintenanceSchedules.id, sql`${id}::uuid`))
    .returning();
  return (rows as Row[])[0] ?? null;
}

export async function setActive(id: string, isActive: boolean) {
  const db = getDb();
  const rows = await db
    .update(maintenanceSchedules)
    .set({ isActive, updatedAt: sql`now()` } as any)
    .where(eq(maintenanceSchedules.id, sql`${id}::uuid`))
    .returning();
  return (rows as Row[])[0] ?? null;
}

/** All active schedules with asset + type names (used for reminder generation). */
export async function findAllActive() {
  const db = getDb();
  const rows = await db
    .select(BASE_JOIN)
    .from(maintenanceSchedules)
    .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
    .leftJoin(maintenanceTypes, eq(maintenanceSchedules.maintenanceTypeId, maintenanceTypes.id))
    .where(eq(maintenanceSchedules.isActive, true));
  return rows.map((r) => mapSchedule(r as Row));
}

/** Active schedules whose next due date has already passed (candidates for auto generation). */
export async function findSchedulesForGeneration(today: string) {
  const db = getDb();
  const rows = await db
    .select({ ...BASE_JOIN, maintenanceTypeName: maintenanceTypes.name })
    .from(maintenanceSchedules)
    .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
    .leftJoin(maintenanceTypes, eq(maintenanceSchedules.maintenanceTypeId, maintenanceTypes.id))
    .where(
      and(
        eq(maintenanceSchedules.isActive, true),
        lte(maintenanceSchedules.nextMaintenanceDate, sql`${today}::date`),
      ),
    );
  return rows.map((r) => mapSchedule(r as Row));
}

export interface DueFilters {
  page?: number;
  limit?: number;
  assetId?: string;
  typeId?: string;
  categoryIds?: string[];
}

async function findDuePage(
  conditions: SQL[],
  filters: DueFilters,
  orderAsc: boolean,
) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  if (filters.categoryIds && filters.categoryIds.length > 0) {
    conditions.push(inArray(assets.categoryId, filters.categoryIds));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select(BASE_JOIN)
    .from(maintenanceSchedules)
    .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
    .leftJoin(maintenanceTypes, eq(maintenanceSchedules.maintenanceTypeId, maintenanceTypes.id))
    .where(where)
    .orderBy(orderAsc ? asc(maintenanceSchedules.nextMaintenanceDate) : desc(maintenanceSchedules.nextMaintenanceDate))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ value: count() })
    .from(maintenanceSchedules)
    .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
    .where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  return {
    data: rows.map((r) => mapSchedule(r as Row)),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
  };
}

export async function findUpcoming(today: string, days: number, filters: DueFilters) {
  const conditions: SQL[] = [
    eq(maintenanceSchedules.isActive, true),
    gte(maintenanceSchedules.nextMaintenanceDate, sql`${today}::date`),
    lte(maintenanceSchedules.nextMaintenanceDate, sql`${addDaysSql(today, days)}::date`),
  ];
  if (filters.assetId) conditions.push(eq(maintenanceSchedules.assetId, sql`${filters.assetId}::uuid`));
  if (filters.typeId) conditions.push(eq(maintenanceSchedules.maintenanceTypeId, sql`${filters.typeId}::uuid`));
  return findDuePage(conditions, filters, true);
}

export async function findDueToday(today: string, filters: DueFilters) {
  const conditions: SQL[] = [
    eq(maintenanceSchedules.isActive, true),
    eq(maintenanceSchedules.nextMaintenanceDate, sql`${today}::date`),
  ];
  if (filters.assetId) conditions.push(eq(maintenanceSchedules.assetId, sql`${filters.assetId}::uuid`));
  if (filters.typeId) conditions.push(eq(maintenanceSchedules.maintenanceTypeId, sql`${filters.typeId}::uuid`));
  return findDuePage(conditions, filters, true);
}

export async function findOverdue(today: string, filters: DueFilters) {
  const conditions: SQL[] = [
    eq(maintenanceSchedules.isActive, true),
    sql`${maintenanceSchedules.nextMaintenanceDate} < ${today}::date`,
  ];
  if (filters.assetId) conditions.push(eq(maintenanceSchedules.assetId, sql`${filters.assetId}::uuid`));
  if (filters.typeId) conditions.push(eq(maintenanceSchedules.maintenanceTypeId, sql`${filters.typeId}::uuid`));
  return findDuePage(conditions, filters, true);
}

/** Schedules whose latest generated maintenance was completed within the last `days` days. */
export async function findCompleted(days: number, filters: DueFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;

  const conditions: SQL[] = [
    sql`${maintenanceScheduleLogs.status} = 'GENERATED'`,
    eq(maintenanceRecords.status, 'COMPLETED'),
    gte(maintenanceRecords.finishDate, sql`(now() - make_interval(days => ${days}))`),
  ];
  if (filters.assetId) conditions.push(eq(maintenanceSchedules.assetId, sql`${filters.assetId}::uuid`));
  if (filters.typeId) conditions.push(eq(maintenanceSchedules.maintenanceTypeId, sql`${filters.typeId}::uuid`));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      scheduleId: maintenanceSchedules.id,
      assetId: maintenanceSchedules.assetId,
      maintenanceTypeId: maintenanceSchedules.maintenanceTypeId,
      frequencyType: maintenanceSchedules.frequencyType,
      frequencyValue: maintenanceSchedules.frequencyValue,
      startDate: maintenanceSchedules.startDate,
      lastMaintenanceDate: maintenanceSchedules.lastMaintenanceDate,
      nextMaintenanceDate: maintenanceSchedules.nextMaintenanceDate,
      reminderDays: maintenanceSchedules.reminderDays,
      notes: maintenanceSchedules.notes,
      isActive: maintenanceSchedules.isActive,
      createdBy: maintenanceSchedules.createdBy,
      createdAt: maintenanceSchedules.createdAt,
      updatedAt: maintenanceSchedules.updatedAt,
      assetCode: assets.assetCode,
      assetName: assets.assetName,
      maintenanceTypeName: maintenanceTypes.name,
      maintenanceId: maintenanceScheduleLogs.maintenanceId,
      maintenanceCode: maintenanceRecords.maintenanceCode,
      completedAt: maintenanceRecords.finishDate,
    })
    .from(maintenanceScheduleLogs)
    .innerJoin(maintenanceSchedules, eq(maintenanceScheduleLogs.scheduleId, maintenanceSchedules.id))
    .innerJoin(maintenanceRecords, eq(maintenanceScheduleLogs.maintenanceId, maintenanceRecords.id))
    .leftJoin(assets, eq(maintenanceSchedules.assetId, assets.id))
    .leftJoin(maintenanceTypes, eq(maintenanceSchedules.maintenanceTypeId, maintenanceTypes.id))
    .where(where)
    .orderBy(desc(maintenanceRecords.finishDate))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ value: count() })
    .from(maintenanceScheduleLogs)
    .innerJoin(maintenanceSchedules, eq(maintenanceScheduleLogs.scheduleId, maintenanceSchedules.id))
    .innerJoin(maintenanceRecords, eq(maintenanceScheduleLogs.maintenanceId, maintenanceRecords.id))
    .where(where);

  const total = Number(totalResult[0]?.value ?? 0);

  const data = rows.map((r) => ({
    id: r.scheduleId,
    assetId: r.assetId,
    maintenanceTypeId: r.maintenanceTypeId,
    frequencyType: r.frequencyType,
    frequencyValue: r.frequencyValue,
    startDate: toDateString(r.startDate),
    lastMaintenanceDate: toDateString(r.lastMaintenanceDate),
    nextMaintenanceDate: toDateString(r.nextMaintenanceDate),
    reminderDays: r.reminderDays,
    notes: r.notes,
    isActive: r.isActive,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    asset: { id: r.assetId, assetCode: r.assetCode, assetName: r.assetName },
    maintenanceType: r.maintenanceTypeId ? { id: r.maintenanceTypeId, name: r.maintenanceTypeName } : null,
    maintenance: r.maintenanceCode ? { id: r.maintenanceId, maintenanceCode: r.maintenanceCode, completedAt: r.completedAt } : null,
  }));

  return {
    data: data as any[],
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
  };
}

function addDaysSql(dateString: string, days: number): string {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

// ---- Schedule generation logs ----

export async function insertLog(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(maintenanceScheduleLogs).values(data as any).onConflictDoNothing().returning();
  return (rows as Row[])[0] ?? null;
}

export async function getLog(scheduleId: string, dueDate: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(maintenanceScheduleLogs)
    .where(and(eq(maintenanceScheduleLogs.scheduleId, sql`${scheduleId}::uuid`), eq(maintenanceScheduleLogs.dueDate, sql`${dueDate}::date`)))
    .limit(1);
  return (rows as Row[])[0] ?? null;
}

export async function confirmLog(scheduleId: string, dueDate: string, maintenanceId: string) {
  const db = getDb();
  await db
    .update(maintenanceScheduleLogs)
    .set({ status: 'GENERATED', maintenanceId: sql`${maintenanceId}::uuid` })
    .where(and(eq(maintenanceScheduleLogs.scheduleId, sql`${scheduleId}::uuid`), eq(maintenanceScheduleLogs.dueDate, sql`${dueDate}::date`)));
}

export async function removeGeneratingLog(scheduleId: string, dueDate: string) {
  const db = getDb();
  await db
    .delete(maintenanceScheduleLogs)
    .where(
      and(
        eq(maintenanceScheduleLogs.scheduleId, sql`${scheduleId}::uuid`),
        eq(maintenanceScheduleLogs.dueDate, sql`${dueDate}::date`),
        eq(maintenanceScheduleLogs.status, 'GENERATING'),
      ),
    );
}

// ---- Reminders ----

export async function insertReminder(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(maintenanceReminders).values(data as any).onConflictDoNothing().returning();
  return (rows as Row[])[0] ?? null;
}

export async function findReminders(filters: { status?: string; userId?: string; limit?: number }) {
  const db = getDb();
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
  const conditions: SQL[] = [];
  if (filters.status) conditions.push(eq(maintenanceReminders.status, sql`${filters.status}::varchar`));
  if (filters.userId) conditions.push(eq(maintenanceReminders.targetUserId, sql`${filters.userId}::uuid`));
  const where = conditions.length ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: maintenanceReminders.id,
      scheduleId: maintenanceReminders.scheduleId,
      maintenanceId: maintenanceReminders.maintenanceId,
      reminderType: maintenanceReminders.reminderType,
      offsetDays: maintenanceReminders.offsetDays,
      dueDate: maintenanceReminders.dueDate,
      title: maintenanceReminders.title,
      message: maintenanceReminders.message,
      status: maintenanceReminders.status,
      targetUserId: maintenanceReminders.targetUserId,
      readAt: maintenanceReminders.readAt,
      createdAt: maintenanceReminders.createdAt,
    })
    .from(maintenanceReminders)
    .where(where)
    .orderBy(desc(maintenanceReminders.createdAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, dueDate: toDateString(r.dueDate) })) as any[];
}

export async function markReminderRead(id: string) {
  const db = getDb();
  const rows = await db
    .update(maintenanceReminders)
    .set({ status: 'READ', readAt: sql`now()` })
    .where(eq(maintenanceReminders.id, sql`${id}::uuid`))
    .returning();
  return (rows as Row[])[0] ?? null;
}
