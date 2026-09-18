import { AppError } from '@/middleware/error-handler';
import { getDb } from '@/database/client';
import { assets as assetsTable, assetTransfers, assetMovements, users, departments, sites, buildings, floors, rooms } from '@/database/schema';
import { alias } from 'drizzle-orm/pg-core';
import { sql, eq, and, desc as descOrder } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { canAccessAsset, type AssetScope } from '@/middleware/scope';

const transferFromRooms = alias(rooms, 'transfer_from_rooms');
const transferToRooms = alias(rooms, 'transfer_to_rooms');
const transferFromSites = alias(sites, 'transfer_from_sites');
const transferFromBuildings = alias(buildings, 'transfer_from_buildings');
const transferFromFloors = alias(floors, 'transfer_from_floors');
const transferToSites = alias(sites, 'transfer_to_sites');
const transferToBuildings = alias(buildings, 'transfer_to_buildings');
const transferToFloors = alias(floors, 'transfer_to_floors');

function str(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s || undefined;
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

function assertAssetAccess(asset: { categoryId?: unknown; currentPicId?: unknown } | null | undefined, scope?: AssetScope) {
  if (!canAccessAsset(scope ?? {}, asset)) {
    throw new AppError(403, 'FORBIDDEN', 'You do not have permission to view this asset.');
  }
}

export async function createTransfer(
  assetId: string,
  body: Record<string, unknown>,
  fileUrl?: string,
  userId?: string,
  scope?: AssetScope,
) {
  const db = getDb();

  const [asset] = await db
    .select({
      id: assetsTable.id,
      assetCode: assetsTable.assetCode,
      status: assetsTable.status,
      categoryId: assetsTable.categoryId,
      currentPicId: assetsTable.currentPicId,
      siteId: assetsTable.siteId,
      buildingId: assetsTable.buildingId,
      floorId: assetsTable.floorId,
      roomId: assetsTable.roomId,
      departmentId: assetsTable.departmentId,
    })
    .from(assetsTable)
    .where(and(eq(assetsTable.id, sql`${assetId}::uuid`), sql`${assetsTable.deletedAt} IS NULL`))
    .limit(1);
  if (!asset) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
  assertAssetAccess(asset, scope);
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

  // Prevent duplicate PENDING transfers
  const [existing] = await db
    .select({ id: assetTransfers.id })
    .from(assetTransfers)
    .where(and(eq(assetTransfers.assetId, sql`${assetId}::uuid`), eq(assetTransfers.status, 'PENDING')))
    .limit(1);
  if (existing) {
    throw new AppError(409, 'CONFLICT', 'There is already a pending transfer for this asset.');
  }

  const reason = str(body.reason);
  const notes = str(body.notes);

  const [record] = await db.insert(assetTransfers).values({
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
    status: 'PENDING',
    reason: reason ?? undefined,
    notes: notes ?? undefined,
    authorizationLetterUrl: fileUrl ?? undefined,
    requestedBy: userId ? sql`${userId}::uuid` : undefined,
  } as any).returning();

  eventBus.publish({
    type: 'MOVEMENT',
    action: 'transfer_requested',
    targetUserId: (asset.currentPicId as string) ?? null,
    entityType: 'asset_transfer',
    entityId: record.id as string,
    data: { assetCode: asset.assetCode, assetName: '' },
  });

  return { ...record, performedByName: userId || null };
}

export async function getActiveTransfer(assetId: string, scope?: AssetScope) {
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
      id: assetTransfers.id,
      assetId: assetTransfers.assetId,
      fromSiteName: transferFromSites.name,
      fromBuildingName: transferFromBuildings.name,
      fromFloorName: transferFromFloors.name,
      fromRoomName: transferFromRooms.name,
      toSiteName: transferToSites.name,
      toBuildingName: transferToBuildings.name,
      toFloorName: transferToFloors.name,
      toRoomName: transferToRooms.name,
       status: assetTransfers.status,
       reason: assetTransfers.reason,
       notes: assetTransfers.notes,
       authorizationLetterUrl: assetTransfers.authorizationLetterUrl,
       requestedAt: assetTransfers.requestedAt,
      completedAt: assetTransfers.completedAt,
      createdAt: assetTransfers.createdAt,
      updatedAt: assetTransfers.updatedAt,
    })
    .from(assetTransfers)
    .leftJoin(transferFromSites, eq(assetTransfers.fromSiteId, transferFromSites.id))
    .leftJoin(transferFromBuildings, eq(assetTransfers.fromBuildingId, transferFromBuildings.id))
    .leftJoin(transferFromFloors, eq(assetTransfers.fromFloorId, transferFromFloors.id))
    .leftJoin(transferFromRooms, eq(assetTransfers.fromRoomId, transferFromRooms.id))
    .leftJoin(transferToSites, eq(assetTransfers.toSiteId, transferToSites.id))
    .leftJoin(transferToBuildings, eq(assetTransfers.toBuildingId, transferToBuildings.id))
    .leftJoin(transferToFloors, eq(assetTransfers.toFloorId, transferToFloors.id))
    .leftJoin(transferToRooms, eq(assetTransfers.toRoomId, transferToRooms.id))
    .where(and(eq(assetTransfers.assetId, sql`${assetId}::uuid`), sql`${assetTransfers.status} IN ('PENDING','IN_PROGRESS')`))
    .orderBy(descOrder(assetTransfers.createdAt))
    .limit(1);

  return rows[0] ?? null;
}

export async function getTransferById(transferId: string, scope?: AssetScope) {
  const db = getDb();

  const [transfer] = await db
    .select({
      id: assetTransfers.id,
      assetId: assetTransfers.assetId,
      status: assetTransfers.status,
      authorizationLetterUrl: assetTransfers.authorizationLetterUrl,
      reason: assetTransfers.reason,
      notes: assetTransfers.notes,
      fromSiteName: transferFromSites.name,
      fromBuildingName: transferFromBuildings.name,
      fromFloorName: transferFromFloors.name,
      fromRoomName: transferFromRooms.name,
      toSiteName: transferToSites.name,
      toBuildingName: transferToBuildings.name,
      toFloorName: transferToFloors.name,
      toRoomName: transferToRooms.name,
      requestedAt: assetTransfers.requestedAt,
      completedAt: assetTransfers.completedAt,
      createdAt: assetTransfers.createdAt,
      updatedAt: assetTransfers.updatedAt,
    })
    .from(assetTransfers)
    .leftJoin(transferFromSites, eq(assetTransfers.fromSiteId, transferFromSites.id))
    .leftJoin(transferFromBuildings, eq(assetTransfers.fromBuildingId, transferFromBuildings.id))
    .leftJoin(transferFromFloors, eq(assetTransfers.fromFloorId, transferFromFloors.id))
    .leftJoin(transferFromRooms, eq(assetTransfers.fromRoomId, transferFromRooms.id))
    .leftJoin(transferToSites, eq(assetTransfers.toSiteId, transferToSites.id))
    .leftJoin(transferToBuildings, eq(assetTransfers.toBuildingId, transferToBuildings.id))
    .leftJoin(transferToFloors, eq(assetTransfers.toFloorId, transferToFloors.id))
    .leftJoin(transferToRooms, eq(assetTransfers.toRoomId, transferToRooms.id))
    .where(eq(assetTransfers.id, sql`${transferId}::uuid`))
    .limit(1);

  if (!transfer) throw new AppError(404, 'NOT_FOUND', 'Transfer not found.');

  const [asset] = await db
    .select({ id: assetsTable.id, categoryId: assetsTable.categoryId, currentPicId: assetsTable.currentPicId })
    .from(assetsTable)
    .where(eq(assetsTable.id, sql`${transfer.assetId}::uuid`))
    .limit(1);
  if (!asset) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');
  assertAssetAccess(asset, scope);

  return transfer;
}

export async function confirmTransfer(transferId: string, userId?: string) {
  const db = getDb();

  const [transfer] = await db
    .select({
      id: assetTransfers.id,
      assetId: assetTransfers.assetId,
      status: assetTransfers.status,
      fromSiteId: assetTransfers.fromSiteId,
      fromBuildingId: assetTransfers.fromBuildingId,
      fromFloorId: assetTransfers.fromFloorId,
      fromRoomId: assetTransfers.fromRoomId,
      fromDepartmentId: assetTransfers.fromDepartmentId,
      fromPicId: assetTransfers.fromPicId,
      toSiteId: assetTransfers.toSiteId,
      toBuildingId: assetTransfers.toBuildingId,
      toFloorId: assetTransfers.toFloorId,
      toRoomId: assetTransfers.toRoomId,
      toDepartmentId: assetTransfers.toDepartmentId,
      toPicId: assetTransfers.toPicId,
      reason: assetTransfers.reason,
      notes: assetTransfers.notes,
    })
    .from(assetTransfers)
    .where(eq(assetTransfers.id, sql`${transferId}::uuid`))
    .limit(1);
  if (!transfer) throw new AppError(404, 'NOT_FOUND', 'Transfer not found.');
  if (transfer.status !== 'PENDING') {
    throw new AppError(409, 'CONFLICT', `Transfer cannot be confirmed (current status: ${transfer.status}).`);
  }

  const [asset] = await db
    .select({
      id: assetsTable.id,
      siteId: assetsTable.siteId,
      buildingId: assetsTable.buildingId,
      floorId: assetsTable.floorId,
      roomId: assetsTable.roomId,
      departmentId: assetsTable.departmentId,
      currentPicId: assetsTable.currentPicId,
      assetCode: assetsTable.assetCode,
    })
    .from(assetsTable)
    .where(eq(assetsTable.id, sql`${transfer.assetId}::uuid`))
    .limit(1);
  if (!asset) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');

  const result = await db.transaction(async (tx) => {
    const [updatedTransfer] = await tx
      .update(assetTransfers)
      .set({
        status: 'COMPLETED',
        completedAt: sql`now()`,
        approvedBy: userId ? sql`${userId}::uuid` : undefined,
        updatedAt: sql`now()`,
      } as any)
      .where(eq(assetTransfers.id, sql`${transferId}::uuid`))
      .returning();

    const movementDate = new Date().toISOString().slice(0, 10);

    const [movementRecord] = await tx.insert(assetMovements).values({
      assetId: sql`${transfer.assetId}::uuid`,
      transferId: sql`${transferId}::uuid`,
      fromSiteId: transfer.fromSiteId,
      fromBuildingId: transfer.fromBuildingId,
      fromFloorId: transfer.fromFloorId,
      fromRoomId: transfer.fromRoomId,
      fromDepartmentId: transfer.fromDepartmentId,
      fromPicId: transfer.fromPicId,
      toSiteId: transfer.toSiteId,
      toBuildingId: transfer.toBuildingId,
      toFloorId: transfer.toFloorId,
      toRoomId: transfer.toRoomId,
      toDepartmentId: transfer.toDepartmentId,
      toPicId: transfer.toPicId,
      movementDate: sql`${movementDate}::date`,
      reason: transfer.reason ?? undefined,
      notes: transfer.notes ?? undefined,
      movedBy: userId ? sql`${userId}::uuid` : undefined,
      approvedBy: userId ? sql`${userId}::uuid` : undefined,
    } as any).returning();

    await tx
      .update(assetsTable)
      .set({
        siteId: transfer.toSiteId ? sql`${transfer.toSiteId}::uuid` : undefined,
        buildingId: transfer.toBuildingId ? sql`${transfer.toBuildingId}::uuid` : undefined,
        floorId: transfer.toFloorId ? sql`${transfer.toFloorId}::uuid` : undefined,
        roomId: transfer.toRoomId ? sql`${transfer.toRoomId}::uuid` : undefined,
        departmentId: transfer.toDepartmentId ? sql`${transfer.toDepartmentId}::uuid` : undefined,
        currentPicId: transfer.toPicId ? sql`${transfer.toPicId}::uuid` : asset.currentPicId,
        updatedAt: sql`now()`,
      } as any)
      .where(eq(assetsTable.id, sql`${transfer.assetId}::uuid`));

    eventBus.publish({
      type: 'MOVEMENT',
      action: 'moved',
      targetUserId: (transfer.fromPicId as string) ?? null,
      entityType: 'asset',
      entityId: transfer.assetId,
      data: { assetCode: asset.assetCode, assetName: '' },
    });

    return { transfer: updatedTransfer, movement: movementRecord };
  });

  return result;
}

export async function cancelTransfer(transferId: string) {
  const db = getDb();

  const [transfer] = await db
    .select({ id: assetTransfers.id, status: assetTransfers.status, assetId: assetTransfers.assetId })
    .from(assetTransfers)
    .where(eq(assetTransfers.id, sql`${transferId}::uuid`))
    .limit(1);
  if (!transfer) throw new AppError(404, 'NOT_FOUND', 'Transfer not found.');
  if (transfer.status !== 'PENDING') {
    throw new AppError(409, 'CONFLICT', `Transfer cannot be cancelled (current status: ${transfer.status}).`);
  }

  const [updatedTransfer] = await db
    .update(assetTransfers)
    .set({
      status: 'CANCELLED',
      updatedAt: sql`now()`,
    } as any)
    .where(eq(assetTransfers.id, sql`${transferId}::uuid`))
    .returning();

  return updatedTransfer;
}
