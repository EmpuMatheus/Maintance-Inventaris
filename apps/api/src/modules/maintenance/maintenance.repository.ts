import { getDb } from '@/database/client';
import {
  maintenanceRecords,
  maintenanceParts,
  maintenanceDocuments,
  assets,
  assetCategories,
  sites,
  buildings,
  floors,
  rooms,
  departments,
  tickets,
  users,
  maintenanceTypes,
  vendors,
} from '@/database/schema';
import { alias } from 'drizzle-orm/pg-core';
import { eq, like, and, sql, desc, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

const technicianUsers = alias(users, 'technician_users');
const assetPicUsers = alias(users, 'asset_pic_users');
const createdByUsers = alias(users, 'created_by_users');

export async function findMany(params: {
  page?: number; limit?: number; search?: string; status?: string; priority?: string;
  assetId?: string; technicianId?: string; typeId?: string;
}) {
  const db = getDb();
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 25));
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (params.search) {
    const p = `%${params.search}%`;
    conditions.push(sql`(${like(maintenanceRecords.maintenanceCode, p)} OR ${like(maintenanceRecords.problem, p)})`);
  }
  if (params.status) conditions.push(eq(maintenanceRecords.status, sql`${params.status}::varchar`));
  if (params.priority) conditions.push(eq(maintenanceRecords.priority, sql`${params.priority}::varchar`));
  if (params.assetId) conditions.push(eq(maintenanceRecords.assetId, sql`${params.assetId}::uuid`));
  if (params.technicianId) conditions.push(eq(maintenanceRecords.technicianId, sql`${params.technicianId}::uuid`));
  if (params.typeId) conditions.push(eq(maintenanceRecords.maintenanceTypeId, sql`${params.typeId}::uuid`));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: maintenanceRecords.id,
      maintenanceCode: maintenanceRecords.maintenanceCode,
      maintenanceCategory: maintenanceRecords.maintenanceCategory,
      problem: maintenanceRecords.problem,
      priority: maintenanceRecords.priority,
      status: maintenanceRecords.status,
      assetId: maintenanceRecords.assetId,
      maintenanceTypeId: maintenanceRecords.maintenanceTypeId,
      technicianId: maintenanceRecords.technicianId,
      scheduledDate: maintenanceRecords.scheduledDate,
      startDate: maintenanceRecords.startDate,
      finishDate: maintenanceRecords.finishDate,
      createdAt: maintenanceRecords.createdAt,
      assetCode: assets.assetCode,
      assetName: assets.assetName,
      maintenanceTypeName: maintenanceTypes.name,
      technicianName: technicianUsers.name,
    })
    .from(maintenanceRecords)
    .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
    .leftJoin(maintenanceTypes, eq(maintenanceRecords.maintenanceTypeId, maintenanceTypes.id))
    .leftJoin(technicianUsers, eq(maintenanceRecords.technicianId, technicianUsers.id))
    .where(where)
    .orderBy(desc(maintenanceRecords.createdAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(maintenanceRecords).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  const data = rows.map((row) => ({
    id: row.id,
    maintenanceCode: row.maintenanceCode,
    maintenanceCategory: row.maintenanceCategory,
    problem: row.problem,
    priority: row.priority,
    status: row.status,
    assetId: row.assetId,
    maintenanceTypeId: row.maintenanceTypeId,
    technicianId: row.technicianId,
    scheduledDate: row.scheduledDate,
    startDate: row.startDate,
    finishDate: row.finishDate,
    createdAt: row.createdAt,
    asset: row.assetId
      ? { id: row.assetId, assetCode: row.assetCode, assetName: row.assetName }
      : null,
    maintenanceType: row.maintenanceTypeId
      ? { id: row.maintenanceTypeId, name: row.maintenanceTypeName }
      : null,
    technician: row.technicianId
      ? { id: row.technicianId, name: row.technicianName }
      : null,
  }));

  return { data: data as any[], meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 } };
}

export async function findById(id: string) {
  const db = getDb();
  const rows = await db.select().from(maintenanceRecords).where(eq(maintenanceRecords.id, sql`${id}::uuid`)).limit(1);
  return (rows as any[])[0] ?? null;
}

export async function findByCode(code: string) {
  const db = getDb();
  const rows = await db.select().from(maintenanceRecords).where(eq(maintenanceRecords.maintenanceCode, code)).limit(1);
  return (rows as any[])[0] ?? null;
}

export async function findDetails(id: string) {
  const db = getDb();
  const rows = await db
    .select({
      id: maintenanceRecords.id,
      maintenanceCode: maintenanceRecords.maintenanceCode,
      maintenanceCategory: maintenanceRecords.maintenanceCategory,
      problem: maintenanceRecords.problem,
      diagnosis: maintenanceRecords.diagnosis,
      actionTaken: maintenanceRecords.actionTaken,
      priority: maintenanceRecords.priority,
      status: maintenanceRecords.status,
      scheduledDate: maintenanceRecords.scheduledDate,
      startDate: maintenanceRecords.startDate,
      finishDate: maintenanceRecords.finishDate,
      downtimeMinutes: maintenanceRecords.downtimeMinutes,
      laborCost: maintenanceRecords.laborCost,
      partsCost: maintenanceRecords.partsCost,
      otherCost: maintenanceRecords.otherCost,
      totalCost: maintenanceRecords.totalCost,
      result: maintenanceRecords.result,
      notes: maintenanceRecords.notes,
      assetId: maintenanceRecords.assetId,
      maintenanceTypeId: maintenanceRecords.maintenanceTypeId,
      technicianId: maintenanceRecords.technicianId,
      vendorId: maintenanceRecords.vendorId,
      createdBy: maintenanceRecords.createdBy,
      ticketId: maintenanceRecords.ticketId,
      createdAt: maintenanceRecords.createdAt,
      updatedAt: maintenanceRecords.updatedAt,
      assetCode: assets.assetCode,
      assetName: assets.assetName,
      assetCondition: assets.condition,
      assetStatus: assets.status,
      assetCategoryName: assetCategories.name,
      assetPicName: assetPicUsers.name,
      assetSiteName: sites.name,
      assetBuildingName: buildings.name,
      assetFloorName: floors.name,
      assetRoomName: rooms.name,
      assetDepartmentName: departments.name,
      maintenanceTypeName: maintenanceTypes.name,
      maintenanceTypeCategory: maintenanceTypes.maintenanceCategory,
      technicianName: technicianUsers.name,
      vendorName: vendors.name,
      createdByName: createdByUsers.name,
      ticketCode: tickets.ticketCode,
    })
    .from(maintenanceRecords)
    .leftJoin(assets, eq(maintenanceRecords.assetId, assets.id))
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(sites, eq(assets.siteId, sites.id))
    .leftJoin(buildings, eq(assets.buildingId, buildings.id))
    .leftJoin(floors, eq(assets.floorId, floors.id))
    .leftJoin(rooms, eq(assets.roomId, rooms.id))
    .leftJoin(departments, eq(assets.departmentId, departments.id))
    .leftJoin(assetPicUsers, eq(assets.currentPicId, assetPicUsers.id))
    .leftJoin(maintenanceTypes, eq(maintenanceRecords.maintenanceTypeId, maintenanceTypes.id))
    .leftJoin(technicianUsers, eq(maintenanceRecords.technicianId, technicianUsers.id))
    .leftJoin(vendors, eq(maintenanceRecords.vendorId, vendors.id))
    .leftJoin(createdByUsers, eq(maintenanceRecords.createdBy, createdByUsers.id))
    .leftJoin(tickets, eq(maintenanceRecords.ticketId, tickets.id))
    .where(eq(maintenanceRecords.id, sql`${id}::uuid`))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const location = [row.assetSiteName, row.assetBuildingName, row.assetFloorName, row.assetRoomName]
    .filter((v): v is string => Boolean(v))
    .join(' / ');

  return {
    id: row.id,
    maintenanceCode: row.maintenanceCode,
    maintenanceCategory: row.maintenanceCategory,
    problem: row.problem,
    diagnosis: row.diagnosis,
    actionTaken: row.actionTaken,
    priority: row.priority,
    status: row.status,
    scheduledDate: row.scheduledDate,
    startDate: row.startDate,
    finishDate: row.finishDate,
    downtimeMinutes: row.downtimeMinutes,
    laborCost: row.laborCost,
    partsCost: row.partsCost,
    otherCost: row.otherCost,
    totalCost: row.totalCost,
    result: row.result,
    notes: row.notes,
    assetId: row.assetId,
    maintenanceTypeId: row.maintenanceTypeId,
    technicianId: row.technicianId,
    vendorId: row.vendorId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    asset: row.assetId
      ? {
          id: row.assetId,
          assetCode: row.assetCode,
          assetName: row.assetName,
          condition: row.assetCondition,
          status: row.assetStatus,
          categoryName: row.assetCategoryName,
          picName: row.assetPicName,
          location: location || null,
          departmentName: row.assetDepartmentName,
        }
      : null,
    maintenanceType: row.maintenanceTypeId
      ? {
          id: row.maintenanceTypeId,
          name: row.maintenanceTypeName,
          maintenanceCategory: row.maintenanceTypeCategory,
        }
      : null,
    technician: row.technicianId
      ? { id: row.technicianId, name: row.technicianName }
      : null,
    vendor: row.vendorId
      ? { id: row.vendorId, name: row.vendorName }
      : null,
    createdByUser: row.createdBy
      ? { id: row.createdBy, name: row.createdByName }
      : null,
    ticket: row.ticketId
      ? { id: row.ticketId, ticketCode: row.ticketCode }
      : null,
  } as any;
}

export async function update(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.update(maintenanceRecords).set({ ...data, updatedAt: sql`now()` } as any).where(eq(maintenanceRecords.id, sql`${id}::uuid`)).returning();
  return (rows as any[])[0] ?? null;
}

export async function getParts(maintenanceId: string) {
  const db = getDb();
  return db.select().from(maintenanceParts).where(eq(maintenanceParts.maintenanceId, sql`${maintenanceId}::uuid`)).orderBy(maintenanceParts.createdAt);
}

export async function addPart(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(maintenanceParts).values(data as any).returning();
  return (rows as any[])[0] ?? null;
}

export async function deletePart(partId: string) {
  const db = getDb();
  await db.delete(maintenanceParts).where(eq(maintenanceParts.id, sql`${partId}::uuid`));
}

export async function getDocuments(maintenanceId: string) {
  const db = getDb();
  return db.select().from(maintenanceDocuments).where(eq(maintenanceDocuments.maintenanceId, sql`${maintenanceId}::uuid`)).orderBy(maintenanceDocuments.createdAt);
}
