import { AppError } from '@/middleware/error-handler';
import { getDb } from '@/database/client';
import { assets as assetsTable, assetAssignments, users, departments, sites, buildings, floors, rooms, assetMovements } from '@/database/schema';
import { alias } from 'drizzle-orm/pg-core';
import { sql, eq, and, desc as descOrder } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { canAccessAsset, type AssetScope } from '@/middleware/scope';

const assignedUsers = alias(users, 'assigned_users');
const assignerUsers = alias(users, 'assigner_users');
const fromRooms = alias(rooms, 'from_rooms');
const toRooms = alias(rooms, 'to_rooms');

function str(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function assertAssetAccess(asset: { categoryId?: unknown; currentPicId?: unknown } | null | undefined, scope?: AssetScope) {
  if (!canAccessAsset(scope ?? {}, asset)) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view this asset.');
  }
}

async function ref(table: string, id: string | null | undefined, label: string) {
  if (!id) return;
  const name = await getRefName(table, id);
  if (!name) throw new AppError(400, 'VALIDATION_ERROR', `${label} not found.`);
}

async function getRefName(table: string, id: string): Promise<string | null> {
  const db = getDb();
  const tables: Record<string, any> = { users, departments, sites, buildings, floors, rooms };
  const t = tables[table];
  if (!t) return null;
  const rows = await db.select({ name: t.name }).from(t).where(eq(t.id, sql`${id}::uuid`)).limit(1);
  return (rows as any[])[0]?.name ?? null;
}

export async function assign(
  assetId: string,
  body: Record<string, unknown>,
  userId?: string,
  userName?: string,
) {
  const db = getDb();

  const [asset] = await db
    .select({ id: assetsTable.id, status: assetsTable.status, assetCode: assetsTable.assetCode })
    .from(assetsTable)
    .where(and(eq(assetsTable.id, sql`${assetId}::uuid`), sql`${assetsTable.deletedAt} IS NULL`))
    .limit(1);
  if (!asset) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
  if (asset.status === 'RETIRED') {
    throw new AppError(409, 'CONFLICT', 'Cannot assign a retired asset.');
  }

  const picId = str(body.userId);
  const departmentId = str(body.departmentId);
  if (!picId) throw new AppError(400, 'VALIDATION_ERROR', 'User/PIC is required.');

  await ref('users', picId, 'User/PIC');
  await ref('departments', departmentId, 'Department');

  const [active] = await db
    .select({ id: assetAssignments.id })
    .from(assetAssignments)
    .where(and(eq(assetAssignments.assetId, sql`${assetId}::uuid`), eq(assetAssignments.status, 'ACTIVE')))
    .limit(1);
  if (active) {
    throw new AppError(409, 'CONFLICT', 'Asset is already assigned. Return it first.');
  }

  const assignedDate = str(body.assignedDate) || new Date().toISOString().slice(0, 10);

  try {
    const result = await db.transaction(async (tx) => {
      const [record] = await tx.insert(assetAssignments).values({
        assetId: sql`${assetId}::uuid`,
        userId: sql`${picId}::uuid`,
        departmentId: departmentId ? sql`${departmentId}::uuid` : undefined,
        assignedDate: sql`${assignedDate}::date`,
        assignedBy: userId ? sql`${userId}::uuid` : undefined,
        notes: str(body.notes) ?? undefined,
        status: 'ACTIVE',
      } as any).returning();

      await tx.update(assetsTable)
        .set({
          currentPicId: sql`${picId}::uuid`,
          departmentId: departmentId ? sql`${departmentId}::uuid` : undefined,
          status: sql`'ASSIGNED'::varchar`,
          updatedAt: sql`now()`,
        })
        .where(eq(assetsTable.id, sql`${assetId}::uuid`));

      return record;
    });

    eventBus.publish({
      type: 'ASSIGNMENT',
      action: 'assigned',
      targetUserId: picId,
      entityType: 'asset',
      entityId: assetId,
      data: { assetCode: asset.assetCode },
    });

    return { ...result, performedByName: userName || null };
  } catch (err: any) {
    if (err?.code === '23503') throw new AppError(400, 'VALIDATION_ERROR', 'Referenced record not found.');
    throw err;
  }
}

export async function returnAsset(
  assetId: string,
  body: Record<string, unknown>,
  _userId?: string,
  userName?: string,
) {
  const db = getDb();

  const [asset] = await db
    .select({ id: assetsTable.id, assetCode: assetsTable.assetCode })
    .from(assetsTable)
    .where(and(eq(assetsTable.id, sql`${assetId}::uuid`), sql`${assetsTable.deletedAt} IS NULL`))
    .limit(1);
  if (!asset) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');

  const [active] = await db
    .select({ id: assetAssignments.id, userId: assetAssignments.userId })
    .from(assetAssignments)
    .where(and(eq(assetAssignments.assetId, sql`${assetId}::uuid`), eq(assetAssignments.status, 'ACTIVE')))
    .limit(1);
  if (!active) throw new AppError(400, 'VALIDATION_ERROR', 'Asset has no active assignment.');

  const returnedDate = str(body.returnedDate) || new Date().toISOString().slice(0, 10);

  const result = await db.transaction(async (tx) => {
    const [record] = await tx.update(assetAssignments)
      .set({
        returnedDate: sql`${returnedDate}::date`,
        status: 'RETURNED',
        updatedAt: sql`now()`,
      } as any)
      .where(eq(assetAssignments.id, active.id))
      .returning();

    await tx.update(assetsTable)
      .set({
        currentPicId: null,
        status: sql`'AVAILABLE'::varchar`,
        updatedAt: sql`now()`,
      })
      .where(eq(assetsTable.id, sql`${assetId}::uuid`));

    return record;
  });

  eventBus.publish({
    type: 'ASSIGNMENT',
    action: 'returned',
    targetUserId: (active.userId as string) ?? null,
    entityType: 'asset',
    entityId: assetId,
    data: { assetCode: asset.assetCode },
  });

  return { ...result, performedByName: userName || null };
}

export async function getAssignmentHistory(assetId: string, scope?: AssetScope) {
  const db = getDb();

  const [asset] = await db
    .select({ id: assetsTable.id, categoryId: assetsTable.categoryId, currentPicId: assetsTable.currentPicId })
    .from(assetsTable)
    .where(and(eq(assetsTable.id, sql`${assetId}::uuid`), sql`${assetsTable.deletedAt} IS NULL`))
    .limit(1);
  if (!asset) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
  assertAssetAccess(asset, scope);

  const rows = await db
    .select({
      id: assetAssignments.id,
      userId: assetAssignments.userId,
      userName: assignedUsers.name,
      userUsername: assignedUsers.username,
      departmentId: assetAssignments.departmentId,
      departmentName: departments.name,
      assignedDate: assetAssignments.assignedDate,
      returnedDate: assetAssignments.returnedDate,
      notes: assetAssignments.notes,
      status: assetAssignments.status,
      assignedBy: assetAssignments.assignedBy,
      assignedByName: assignerUsers.name,
      createdAt: assetAssignments.createdAt,
    })
    .from(assetAssignments)
    .leftJoin(assignedUsers, eq(assetAssignments.userId, assignedUsers.id))
    .leftJoin(departments, eq(assetAssignments.departmentId, departments.id))
    .leftJoin(assignerUsers, eq(assetAssignments.assignedBy, assignerUsers.id))
    .where(eq(assetAssignments.assetId, sql`${assetId}::uuid`))
    .orderBy(descOrder(assetAssignments.createdAt));

  return rows;
}

export async function transfer(
  assetId: string,
  body: Record<string, unknown>,
  userId?: string,
  userName?: string,
) {
  const db = getDb();

  const [asset] = await db
    .select({
      id: assetsTable.id,
      assetCode: assetsTable.assetCode,
      status: assetsTable.status,
      siteId: assetsTable.siteId,
      buildingId: assetsTable.buildingId,
      floorId: assetsTable.floorId,
      roomId: assetsTable.roomId,
      departmentId: assetsTable.departmentId,
      currentPicId: assetsTable.currentPicId,
    })
    .from(assetsTable)
    .where(and(eq(assetsTable.id, sql`${assetId}::uuid`), sql`${assetsTable.deletedAt} IS NULL`))
    .limit(1);
  if (!asset) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
  if (asset.status === 'RETIRED') {
    throw new AppError(409, 'CONFLICT', 'Cannot transfer a retired asset.');
  }

  const siteId = str(body.siteId);
  const buildingId = str(body.buildingId);
  const floorId = str(body.floorId);
  const roomId = str(body.roomId);
  if (!siteId || !buildingId || !floorId || !roomId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Site, Building, Floor, and Room are required.');
  }

  await ref('sites', siteId, 'Site');
  await ref('buildings', buildingId, 'Building');
  await ref('floors', floorId, 'Floor');
  await ref('rooms', roomId, 'Room');

  const [b] = await db.select({ siteId: buildings.siteId }).from(buildings).where(eq(buildings.id, sql`${buildingId}::uuid`)).limit(1);
  if (b && b.siteId !== siteId) throw new AppError(400, 'VALIDATION_ERROR', 'Building does not belong to the selected site.');
  const [f] = await db.select({ buildingId: floors.buildingId }).from(floors).where(eq(floors.id, sql`${floorId}::uuid`)).limit(1);
  if (f && f.buildingId !== buildingId) throw new AppError(400, 'VALIDATION_ERROR', 'Floor does not belong to the selected building.');
  const [r] = await db.select({ floorId: rooms.floorId }).from(rooms).where(eq(rooms.id, sql`${roomId}::uuid`)).limit(1);
  if (r && r.floorId !== floorId) throw new AppError(400, 'VALIDATION_ERROR', 'Room does not belong to the selected floor.');

  if (asset.siteId === siteId && asset.buildingId === buildingId && asset.floorId === floorId && asset.roomId === roomId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Asset is already at this location.');
  }

  const movementDate = str(body.movementDate) || new Date().toISOString().slice(0, 10);
  const reason = str(body.reason);
  const notes = str(body.notes);

  const result = await db.transaction(async (tx) => {
    const [record] = await tx.insert(assetMovements).values({
      assetId: sql`${assetId}::uuid`,
      fromSiteId: asset.siteId ? sql`${asset.siteId}::uuid` : undefined,
      fromBuildingId: asset.buildingId ? sql`${asset.buildingId}::uuid` : undefined,
      fromFloorId: asset.floorId ? sql`${asset.floorId}::uuid` : undefined,
      fromRoomId: asset.roomId ? sql`${asset.roomId}::uuid` : undefined,
      fromDepartmentId: asset.departmentId ? sql`${asset.departmentId}::uuid` : undefined,
      fromPicId: asset.currentPicId ? sql`${asset.currentPicId}::uuid` : undefined,
      toSiteId: sql`${siteId}::uuid`,
      toBuildingId: sql`${buildingId}::uuid`,
      toFloorId: sql`${floorId}::uuid`,
      toRoomId: sql`${roomId}::uuid`,
      movementDate: sql`${movementDate}::date`,
      reason: reason ?? undefined,
      notes: notes ?? undefined,
      movedBy: userId ? sql`${userId}::uuid` : undefined,
    } as any).returning();

    await tx.update(assetsTable)
      .set({
        siteId: sql`${siteId}::uuid`,
        buildingId: sql`${buildingId}::uuid`,
        floorId: sql`${floorId}::uuid`,
        roomId: sql`${roomId}::uuid`,
        updatedAt: sql`now()`,
      })
      .where(eq(assetsTable.id, sql`${assetId}::uuid`));

    return record;
  });

  eventBus.publish({
    type: 'MOVEMENT',
    action: 'moved',
    targetUserId: (asset.currentPicId as string) ?? null,
    entityType: 'asset',
    entityId: assetId,
    data: { assetCode: asset.assetCode, assetName: '' },
  });

  return { ...result, performedByName: userName || null };
}

export async function getMovementHistory(assetId: string, scope?: AssetScope) {
  const db = getDb();

  const [asset] = await db
    .select({ id: assetsTable.id, categoryId: assetsTable.categoryId, currentPicId: assetsTable.currentPicId })
    .from(assetsTable)
    .where(and(eq(assetsTable.id, sql`${assetId}::uuid`), sql`${assetsTable.deletedAt} IS NULL`))
    .limit(1);
  if (!asset) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
  assertAssetAccess(asset, scope);

  const rows = await db
    .select({
      id: assetMovements.id,
      movementCode: assetMovements.movementCode,
      fromSiteId: assetMovements.fromSiteId,
      fromBuildingId: assetMovements.fromBuildingId,
      fromFloorId: assetMovements.fromFloorId,
      fromRoomId: assetMovements.fromRoomId,
      fromRoomName: fromRooms.name,
      fromDepartmentId: assetMovements.fromDepartmentId,
      fromPicId: assetMovements.fromPicId,
      toSiteId: assetMovements.toSiteId,
      toBuildingId: assetMovements.toBuildingId,
      toFloorId: assetMovements.toFloorId,
      toRoomId: assetMovements.toRoomId,
      toRoomName: toRooms.name,
      toDepartmentId: assetMovements.toDepartmentId,
      toPicId: assetMovements.toPicId,
      movementDate: assetMovements.movementDate,
      reason: assetMovements.reason,
      notes: assetMovements.notes,
      createdAt: assetMovements.createdAt,
    })
    .from(assetMovements)
    .leftJoin(fromRooms, eq(assetMovements.fromRoomId, fromRooms.id))
    .leftJoin(toRooms, eq(assetMovements.toRoomId, toRooms.id))
    .where(eq(assetMovements.assetId, sql`${assetId}::uuid`))
    .orderBy(descOrder(assetMovements.createdAt));

  return rows;
}
