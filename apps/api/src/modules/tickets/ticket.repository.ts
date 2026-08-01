import { getDb } from '@/database/client';
import { tickets, ticketComments, ticketAssignments, assets, users, departments, maintenanceRecords } from '@/database/schema';
import { alias } from 'drizzle-orm/pg-core';
import { eq, and, sql, like, desc, count, gte, lte } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

const reporterUsers = alias(users, 'reporter_users');
const assignedUsers = alias(users, 'assigned_users');
const technicianUsers = alias(users, 'technician_users');
const assignerUsers = alias(users, 'assigner_users');
const previousUsers = alias(users, 'previous_users');

export interface TicketFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  priority?: string;
  category?: string;
  assetId?: string;
  reporterId?: string;
  assignedTo?: string;
  departmentId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface TicketScope {
  /** Restricts the query to tickets the user reported or is assigned to. */
  userId?: string;
}

type Row = Record<string, unknown>;

const BASE_JOIN = {
  id: tickets.id,
  ticketCode: tickets.ticketCode,
  assetId: tickets.assetId,
  reporterId: tickets.reporterId,
  departmentId: tickets.departmentId,
  category: tickets.category,
  title: tickets.title,
  description: tickets.description,
  priority: tickets.priority,
  status: tickets.status,
  assignedTo: tickets.assignedTo,
  reportedAt: tickets.reportedAt,
  assignedAt: tickets.assignedAt,
  resolvedAt: tickets.resolvedAt,
  closedAt: tickets.closedAt,
  resolution: tickets.resolution,
  createdAt: tickets.createdAt,
  updatedAt: tickets.updatedAt,
  assetCode: assets.assetCode,
  assetName: assets.assetName,
  reporterName: reporterUsers.name,
  assignedName: assignedUsers.name,
  departmentName: departments.name,
};

export function mapTicket(row: Row) {
  return {
    id: row.id as string,
    ticketCode: row.ticketCode as string,
    assetId: row.assetId as string | null,
    reporterId: row.reporterId as string | null,
    departmentId: row.departmentId as string | null,
    category: row.category as string | null,
    title: row.title as string,
    description: row.description as string | null,
    priority: row.priority as string,
    status: row.status as string,
    assignedTo: row.assignedTo as string | null,
    reportedAt: row.reportedAt,
    assignedAt: row.assignedAt,
    resolvedAt: row.resolvedAt,
    closedAt: row.closedAt,
    resolution: row.resolution as string | null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    asset: row.assetId
      ? { id: row.assetId as string, assetCode: row.assetCode as string, assetName: row.assetName as string }
      : null,
    reporter: row.reporterId
      ? { id: row.reporterId as string, name: row.reporterName as string }
      : null,
    assignedToUser: row.assignedTo
      ? { id: row.assignedTo as string, name: row.assignedName as string }
      : null,
    department: row.departmentId
      ? { id: row.departmentId as string, name: row.departmentName as string }
      : null,
  };
}

export async function findMany(filters: TicketFilters, scope?: TicketScope) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (filters.search) {
    const p = `%${filters.search}%`;
    conditions.push(sql`(${like(tickets.ticketCode, p)} OR ${like(tickets.title, p)} OR ${like(tickets.description, p)})`);
  }
  if (filters.status) conditions.push(eq(tickets.status, sql`${filters.status}::varchar`));
  if (filters.priority) conditions.push(eq(tickets.priority, sql`${filters.priority}::varchar`));
  if (filters.category) conditions.push(eq(tickets.category, sql`${filters.category}::varchar`));
  if (filters.assetId) conditions.push(eq(tickets.assetId, sql`${filters.assetId}::uuid`));
  if (filters.reporterId) conditions.push(eq(tickets.reporterId, sql`${filters.reporterId}::uuid`));
  if (filters.assignedTo) conditions.push(eq(tickets.assignedTo, sql`${filters.assignedTo}::uuid`));
  if (filters.departmentId) conditions.push(eq(tickets.departmentId, sql`${filters.departmentId}::uuid`));
  if (filters.dateFrom) conditions.push(gte(tickets.reportedAt, sql`${filters.dateFrom}::date`));
  if (filters.dateTo) conditions.push(lte(tickets.reportedAt, sql`${filters.dateTo}::date + interval '1 day'`));

  if (scope?.userId) {
    conditions.push(sql`(${tickets.reporterId} = ${scope.userId}::uuid OR ${tickets.assignedTo} = ${scope.userId}::uuid)`);
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select(BASE_JOIN)
    .from(tickets)
    .leftJoin(assets, eq(tickets.assetId, assets.id))
    .leftJoin(reporterUsers, eq(tickets.reporterId, reporterUsers.id))
    .leftJoin(assignedUsers, eq(tickets.assignedTo, assignedUsers.id))
    .leftJoin(departments, eq(tickets.departmentId, departments.id))
    .where(where)
    .orderBy(desc(tickets.createdAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(tickets).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  return {
    data: rows.map((r) => mapTicket(r as Row)),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
  };
}

export async function findById(id: string) {
  const db = getDb();
  const rows = await db
    .select(BASE_JOIN)
    .from(tickets)
    .leftJoin(assets, eq(tickets.assetId, assets.id))
    .leftJoin(reporterUsers, eq(tickets.reporterId, reporterUsers.id))
    .leftJoin(assignedUsers, eq(tickets.assignedTo, assignedUsers.id))
    .leftJoin(departments, eq(tickets.departmentId, departments.id))
    .where(eq(tickets.id, sql`${id}::uuid`))
    .limit(1);
  const row = rows[0];
  return row ? mapTicket(row as Row) : null;
}

export async function findByCode(code: string) {
  const db = getDb();
  const rows = await db
    .select(BASE_JOIN)
    .from(tickets)
    .leftJoin(assets, eq(tickets.assetId, assets.id))
    .leftJoin(reporterUsers, eq(tickets.reporterId, reporterUsers.id))
    .leftJoin(assignedUsers, eq(tickets.assignedTo, assignedUsers.id))
    .leftJoin(departments, eq(tickets.departmentId, departments.id))
    .where(eq(tickets.ticketCode, code))
    .limit(1);
  const row = rows[0];
  return row ? mapTicket(row as Row) : null;
}

export async function findRawById(id: string) {
  const db = getDb();
  const rows = await db.select().from(tickets).where(eq(tickets.id, sql`${id}::uuid`)).limit(1);
  return (rows as Row[])[0] ?? null;
}

export async function create(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(tickets).values(data as any).returning();
  return (rows as Row[])[0] ?? null;
}

export async function update(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db
    .update(tickets)
    .set({ ...data, updatedAt: sql`now()` } as any)
    .where(eq(tickets.id, sql`${id}::uuid`))
    .returning();
  return (rows as Row[])[0] ?? null;
}

export async function addComment(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(ticketComments).values(data as any).returning();
  return (rows as Row[])[0] ?? null;
}

export async function getComments(ticketId: string) {
  const db = getDb();
  return db
    .select({
      id: ticketComments.id,
      ticketId: ticketComments.ticketId,
      userId: ticketComments.userId,
      type: ticketComments.type,
      comment: ticketComments.comment,
      isInternal: ticketComments.isInternal,
      createdAt: ticketComments.createdAt,
      userName: users.name,
    })
    .from(ticketComments)
    .leftJoin(users, eq(ticketComments.userId, users.id))
    .where(eq(ticketComments.ticketId, sql`${ticketId}::uuid`))
    .orderBy(ticketComments.createdAt);
}

export async function recordAssignment(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(ticketAssignments).values(data as any).returning();
  return (rows as Row[])[0] ?? null;
}

export async function getAssignments(ticketId: string) {
  const db = getDb();
  return db
    .select({
      id: ticketAssignments.id,
      ticketId: ticketAssignments.ticketId,
      technicianId: ticketAssignments.technicianId,
      assignedBy: ticketAssignments.assignedBy,
      reassignedFromId: ticketAssignments.reassignedFromId,
      notes: ticketAssignments.notes,
      assignedAt: ticketAssignments.assignedAt,
      technicianName: technicianUsers.name,
      assignedByName: assignerUsers.name,
      previousTechnicianName: previousUsers.name,
    })
    .from(ticketAssignments)
    .leftJoin(technicianUsers, eq(ticketAssignments.technicianId, technicianUsers.id))
    .leftJoin(assignerUsers, eq(ticketAssignments.assignedBy, assignerUsers.id))
    .leftJoin(previousUsers, eq(ticketAssignments.reassignedFromId, previousUsers.id))
    .where(eq(ticketAssignments.ticketId, sql`${ticketId}::uuid`))
    .orderBy(ticketAssignments.assignedAt);
}

export async function findMaintenanceForTicket(ticketId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: maintenanceRecords.id, maintenanceCode: maintenanceRecords.maintenanceCode, status: maintenanceRecords.status })
    .from(maintenanceRecords)
    .where(eq(maintenanceRecords.ticketId, sql`${ticketId}::uuid`))
    .orderBy(desc(maintenanceRecords.createdAt));
  return rows as any[];
}
