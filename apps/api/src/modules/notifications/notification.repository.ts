import { getDb } from '@/database/client';
import { notifications, notificationSettings } from '@/database/schema';
import { eq, and, sql, desc, count, like, isNull } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export interface NotificationFilters {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  priority?: string;
  unreadOnly?: boolean;
  archived?: boolean;
}

type Row = Record<string, unknown>;

export async function insertNotification(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(notifications).values(data as any).returning();
  return (rows as Row[])[0] ?? null;
}

export async function findMany(userId: string, filters: NotificationFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [eq(notifications.userId, sql`${userId}::uuid`)];

  if (filters.archived === true) {
    conditions.push(sql`${notifications.archivedAt} IS NOT NULL`);
  } else {
    conditions.push(sql`${notifications.archivedAt} IS NULL`);
  }
  if (filters.type) conditions.push(eq(notifications.type, sql`${filters.type}::varchar`));
  if (filters.priority) conditions.push(eq(notifications.priority, sql`${filters.priority}::varchar`));
  if (filters.unreadOnly) conditions.push(eq(notifications.isRead, false));
  if (filters.search) {
    const p = `%${filters.search}%`;
    conditions.push(sql`(${like(notifications.title, p)} OR ${like(notifications.message, p)})`);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: notifications.id,
      userId: notifications.userId,
      type: notifications.type,
      priority: notifications.priority,
      title: notifications.title,
      message: notifications.message,
      entityType: notifications.entityType,
      entityId: notifications.entityId,
      isRead: notifications.isRead,
      readAt: notifications.readAt,
      archivedAt: notifications.archivedAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(where)
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(notifications).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  return {
    data: rows as Row[],
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
  };
}

export async function countUnread(userId: string): Promise<number> {
  const db = getDb();
  const rows = await db
    .select({ value: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, sql`${userId}::uuid`), eq(notifications.isRead, false), isNull(notifications.archivedAt)));
  return Number(rows[0]?.value ?? 0);
}

export async function markRead(userId: string, id: string) {
  const db = getDb();
  const rows = await db
    .update(notifications)
    .set({ isRead: true, readAt: sql`now()` })
    .where(and(eq(notifications.id, sql`${id}::uuid`), eq(notifications.userId, sql`${userId}::uuid`)))
    .returning();
  return (rows as Row[])[0] ?? null;
}

export async function markAllRead(userId: string) {
  const db = getDb();
  const rows = await db
    .update(notifications)
    .set({ isRead: true, readAt: sql`now()` })
    .where(and(eq(notifications.userId, sql`${userId}::uuid`), eq(notifications.isRead, false)))
    .returning();
  return rows.length;
}

export async function archive(userId: string, id: string) {
  const db = getDb();
  const rows = await db
    .update(notifications)
    .set({ archivedAt: sql`now()` })
    .where(and(eq(notifications.id, sql`${id}::uuid`), eq(notifications.userId, sql`${userId}::uuid`)))
    .returning();
  return (rows as Row[])[0] ?? null;
}

export async function remove(userId: string, id: string) {
  const db = getDb();
  await db
    .delete(notifications)
    .where(and(eq(notifications.id, sql`${id}::uuid`), eq(notifications.userId, sql`${userId}::uuid`)));
}

export type SettingsShape = Record<string, boolean>;

const DEFAULT_SETTINGS: SettingsShape = {
  asset: true,
  maintenance: true,
  schedule: true,
  ticket: true,
  assignment: true,
  movement: true,
  reminder: true,
  system: true,
};

export async function getSettings(userId: string): Promise<SettingsShape> {
  const db = getDb();
  const rows = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, sql`${userId}::uuid`)).limit(1);
  const row = (rows as Row[])[0];
  if (!row) return { ...DEFAULT_SETTINGS };
  return {
    asset: row.asset === true,
    maintenance: row.maintenance === true,
    schedule: row.schedule === true,
    ticket: row.ticket === true,
    assignment: row.assignment === true,
    movement: row.movement === true,
    reminder: row.reminder === true,
    system: row.system === true,
  };
}

export async function upsertSettings(userId: string, patch: Partial<SettingsShape>): Promise<SettingsShape> {
  const db = getDb();
  const data: Record<string, unknown> = { updatedAt: sql`now()` };
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (typeof patch[key] === 'boolean') data[key] = patch[key];
  }
  await db
    .insert(notificationSettings)
    .values({ userId: sql`${userId}::uuid`, ...data, updatedAt: sql`now()` } as any)
    .onConflictDoUpdate({ target: notificationSettings.userId, set: data });
  return getSettings(userId);
}
