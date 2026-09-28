import { AppError } from '@/middleware/error-handler';
import { getDb } from '@/database/client';
import {
  assets as assetsTable,
  assetTransfers,
  assetMovements,
  assetAssignments,
  transferConfirmations,
  users,
  departments,
  sites,
  buildings,
  floors,
  rooms,
} from '@/database/schema';
import { alias } from 'drizzle-orm/pg-core';
import { sql, eq, and, desc as descOrder } from 'drizzle-orm';
import { eventBus } from '@/lib/event-bus';
import { canAccessAsset, type AssetScope } from '@/middleware/scope';
import * as notificationRepo from '@/modules/notifications/notification.repository';

const transferFromRooms = alias(rooms, 'transfer_from_rooms');
const transferToRooms = alias(rooms, 'transfer_to_rooms');
const transferFromSites = alias(sites, 'transfer_from_sites');
const transferFromBuildings = alias(buildings, 'transfer_from_buildings');
const transferFromFloors = alias(floors, 'transfer_from_floors');
const transferToSites = alias(sites, 'transfer_to_sites');
const transferToBuildings = alias(buildings, 'transfer_to_buildings');
const transferToFloors = alias(floors, 'transfer_to_floors');
const transferFromUsers = alias(users, 'transfer_from_users');
const transferToUsers = alias(users, 'transfer_to_users');
const transferRequesterUsers = alias(users, 'transfer_requester_users');

/**
 * Confirmation party roles for a Transfer Location. Stored per-user (unique per
 * transfer) so a user holding several roles only needs one confirmation.
 */
export const TRANSFER_ROLES = ['PREVIOUS_HOLDER', 'NEXT_RECEIVER', 'CREATOR', 'KNOWER'] as const;
export type TransferRole = (typeof TRANSFER_ROLES)[number];

export const TRANSFER_STATUS = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
} as const;

export const CONFIRMATION_STATUS = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  REJECTED: 'REJECTED',
} as const;

function str(v: unknown): string | null | undefined {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function uuidList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return [];
    if (s.startsWith('[')) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed.map((x) => String(x).trim()).filter(Boolean);
      } catch {
        return [];
      }
    }
    return s.split(',').map((x) => x.trim()).filter(Boolean);
  }
  return [];
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

type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

async function loadConfirmations(db: Tx | ReturnType<typeof getDb>, transferId: string) {
  const rows = await (db as any)
    .select({
      userId: transferConfirmations.userId,
      userName: users.name,
      userPosition: users.position,
      roles: transferConfirmations.roles,
      status: transferConfirmations.status,
      reason: transferConfirmations.reason,
      confirmedAt: transferConfirmations.confirmedAt,
      rejectedAt: transferConfirmations.rejectedAt,
      createdAt: transferConfirmations.createdAt,
    })
    .from(transferConfirmations)
    .leftJoin(users, eq(transferConfirmations.userId, users.id))
    .where(eq(transferConfirmations.transferId, sql`${transferId}::uuid`))
    .orderBy(transferConfirmations.createdAt);
  return rows as Array<{
    userId: string;
    userName: string | null;
    userPosition: string | null;
    roles: string[];
    status: string;
    reason: string | null;
    confirmedAt: Date | null;
    rejectedAt: Date | null;
    createdAt: Date;
  }>;
}

async function getActiveAssignment(assetId: string) {
  const db = getDb();
  const [active] = await db
    .select({
      id: assetAssignments.id,
      userId: assetAssignments.userId,
      departmentId: assetAssignments.departmentId,
    })
    .from(assetAssignments)
    .where(and(eq(assetAssignments.assetId, sql`${assetId}::uuid`), eq(assetAssignments.status, 'ACTIVE')))
    .limit(1);
  return active ?? null;
}

export interface ReceiverContext {
  userId: string;
  userName: string | null;
  departmentId: string | null;
  departmentName: string | null;
  location: {
    siteId: string | null;
    buildingId: string | null;
    floorId: string | null;
    roomId: string | null;
    siteName: string | null;
    buildingName: string | null;
    floorName: string | null;
    roomName: string | null;
  } | null;
}

/**
 * Resolves the department and current asset location of a prospective receiver
 * from that user's ACTIVE assignment. Used so the Transfer Location form can
 * follow the selected PIC automatically, and so the backend can validate it.
 */
export async function getReceiverContext(userId: string): Promise<ReceiverContext> {
  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      departmentId: users.departmentId,
      departmentName: departments.name,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.id, sql`${userId}::uuid`))
    .limit(1);
  if (!user) throw new AppError(404, 'NOT_FOUND', 'User not found.');

  const [active] = await db
    .select({
      assignmentDepartmentId: assetAssignments.departmentId,
      siteId: assetsTable.siteId,
      buildingId: assetsTable.buildingId,
      floorId: assetsTable.floorId,
      roomId: assetsTable.roomId,
      siteName: sites.name,
      buildingName: buildings.name,
      floorName: floors.name,
      roomName: rooms.name,
    })
    .from(assetAssignments)
    .innerJoin(assetsTable, eq(assetAssignments.assetId, assetsTable.id))
    .leftJoin(sites, eq(assetsTable.siteId, sites.id))
    .leftJoin(buildings, eq(assetsTable.buildingId, buildings.id))
    .leftJoin(floors, eq(assetsTable.floorId, floors.id))
    .leftJoin(rooms, eq(assetsTable.roomId, rooms.id))
    .where(and(
      eq(assetAssignments.userId, sql`${userId}::uuid`),
      eq(assetAssignments.status, 'ACTIVE'),
      sql`${assetsTable.deletedAt} IS NULL`,
    ))
    .orderBy(descOrder(assetAssignments.createdAt))
    .limit(1);

  const departmentId = (active?.assignmentDepartmentId as string) ?? (user.departmentId as string) ?? null;
  let departmentName = user.departmentName as string | null;
  if (active?.assignmentDepartmentId && active.assignmentDepartmentId !== user.departmentId) {
    const [d] = await db.select({ name: departments.name }).from(departments).where(eq(departments.id, sql`${active.assignmentDepartmentId}::uuid`)).limit(1);
    departmentName = d?.name ?? departmentName;
  }

  return {
    userId: user.id as string,
    userName: user.name as string,
    departmentId,
    departmentName,
    location: active
      ? {
          siteId: (active.siteId as string) ?? null,
          buildingId: (active.buildingId as string) ?? null,
          floorId: (active.floorId as string) ?? null,
          roomId: (active.roomId as string) ?? null,
          siteName: (active.siteName as string) ?? null,
          buildingName: (active.buildingName as string) ?? null,
          floorName: (active.floorName as string) ?? null,
          roomName: (active.roomName as string) ?? null,
        }
      : null,
  };
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
      assetName: assetsTable.assetName,
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

  // A Transfer Location requires an ACTIVE assignment. The previous holder is
  // the active assignee; without one the feature is not available.
  const activeAssignment = await getActiveAssignment(assetId);
  if (!activeAssignment) {
    throw new AppError(409, 'CONFLICT', 'Asset has no active assignment. Assign it first before creating a transfer.');
  }

  const receiverUserId = str(body.receiverUserId ?? body.toPicId);
  if (!receiverUserId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Penerima selanjutnya (receiver) is required.');
  }
  await ref('users', receiverUserId, 'Receiver');

  // Department and target location follow the receiver's data (requirement 10).
  // When the receiver has an active assignment, its location is authoritative
  // and any client-supplied location is ignored; otherwise the request location
  // is used so transfers to an unassigned receiver remain possible.
  const receiverCtx = await getReceiverContext(receiverUserId);
  const receiverLocation = receiverCtx.location;
  const siteId = receiverLocation?.siteId ?? str(body.siteId);
  const buildingId = receiverLocation?.buildingId ?? str(body.buildingId);
  const floorId = receiverLocation?.floorId ?? str(body.floorId);
  const roomId = receiverLocation?.roomId ?? str(body.roomId);
  const toDepartmentId = receiverCtx.departmentId ?? str(body.departmentId);
  if (!siteId || !buildingId || !floorId || !roomId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Site, Building, Floor, and Room are required.');
  }

  const witnessUserIds = Array.from(new Set(uuidList(body.witnessUserIds))).filter((id) => id !== receiverUserId);

  await ref('sites', siteId, 'Site');
  await ref('buildings', buildingId, 'Building');
  await ref('floors', floorId, 'Floor');
  await ref('rooms', roomId, 'Room');
  await ref('departments', toDepartmentId, 'Department');
  for (const wid of witnessUserIds) await ref('users', wid, 'Pihak yang mengetahui');

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

  // Resolve the four parties and merge roles per user (one confirmation per user).
  const previousHolderId = (activeAssignment.userId as string) ?? null;
  const roleMap = new Map<string, Set<TransferRole>>();
  const addRole = (uid: string | null | undefined, role: TransferRole) => {
    if (!uid) return;
    if (!roleMap.has(uid)) roleMap.set(uid, new Set());
    roleMap.get(uid)!.add(role);
  };
  addRole(previousHolderId, 'PREVIOUS_HOLDER');
  addRole(receiverUserId, 'NEXT_RECEIVER');
  addRole(userId, 'CREATOR');
  for (const wid of witnessUserIds) addRole(wid, 'KNOWER');

  if (roleMap.size === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'At least one responsible party is required.');
  }

  const reason = str(body.reason);
  const notes = str(body.notes);

  const result = await db.transaction(async (tx) => {
    const [record] = await tx.insert(assetTransfers).values({
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
      toDepartmentId: toDepartmentId ? sql`${toDepartmentId}::uuid` : undefined,
      toPicId: sql`${receiverUserId}::uuid`,
      status: TRANSFER_STATUS.PENDING,
      reason: reason ?? undefined,
      notes: notes ?? undefined,
      authorizationLetterUrl: fileUrl ?? undefined,
      requestedBy: userId ? sql`${userId}::uuid` : undefined,
    } as any).returning();

    // One confirmation row per unique user, with all their roles merged.
    await tx.insert(transferConfirmations).values(
      Array.from(roleMap.entries()).map(([uid, roles]) => ({
        transferId: sql`${record.id}::uuid`,
        userId: sql`${uid}::uuid`,
        roles: sql`ARRAY[${sql.join(Array.from(roles).map((r) => sql`${r}::text`), sql`, `)}]::text[]`,
        status: CONFIRMATION_STATUS.PENDING,
      })),
    ).returning();

    return { record, parties: roleMap };
  });

  const transferId = result.record.id as string;
  const assetLabel = asset.assetName || asset.assetCode;

  // Notify every involved party (one notification each) with inline actions.
  for (const [uid, roles] of result.parties.entries()) {
    eventBus.publish({
      type: 'MOVEMENT',
      action: 'transfer_requested',
      targetUserId: uid,
      entityType: 'asset_transfer',
      entityId: transferId,
      data: {
        assetCode: asset.assetCode,
        assetName: assetLabel,
        assetId,
        transferId,
        roles: Array.from(roles),
        actionsEnabled: true,
      },
    });
  }

  return { ...result.record, performedByName: userId || null };
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

  const transfer = rows[0];
  if (!transfer) return null;
  const confirmations = await loadConfirmations(db, transfer.id as string);
  return { ...transfer, confirmations };
}

/**
 * Latest transfer (including terminal states except CANCELLED) with the full
 * confirmation tracking, used by the Detail Asset tracking panel.
 */
export async function getLatestTransfer(assetId: string, scope?: AssetScope) {
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
      status: assetTransfers.status,
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
      fromPicName: transferFromUsers.name,
      toPicName: transferToUsers.name,
      requestedByName: transferRequesterUsers.name,
      requestedBy: assetTransfers.requestedBy,
      rejectedByName: users.name,
      rejectionReason: assetTransfers.rejectionReason,
      rejectedAt: assetTransfers.rejectedAt,
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
    .leftJoin(transferFromUsers, eq(assetTransfers.fromPicId, transferFromUsers.id))
    .leftJoin(transferToUsers, eq(assetTransfers.toPicId, transferToUsers.id))
    .leftJoin(transferRequesterUsers, eq(assetTransfers.requestedBy, transferRequesterUsers.id))
    .leftJoin(users, eq(assetTransfers.rejectedBy, users.id))
    .where(and(
      eq(assetTransfers.assetId, sql`${assetId}::uuid`),
      sql`${assetTransfers.status} IN ('PENDING','IN_PROGRESS','COMPLETED','REJECTED')`,
    ))
    .orderBy(descOrder(assetTransfers.createdAt))
    .limit(1);

  const transfer = rows[0];
  if (!transfer) return null;
  const confirmations = await loadConfirmations(db, transfer.id as string);
  return { ...transfer, confirmations };
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
      fromPicName: transferFromUsers.name,
      toPicName: transferToUsers.name,
      requestedByName: transferRequesterUsers.name,
      requestedBy: assetTransfers.requestedBy,
      rejectedByName: users.name,
      rejectionReason: assetTransfers.rejectionReason,
      rejectedAt: assetTransfers.rejectedAt,
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
    .leftJoin(transferFromUsers, eq(assetTransfers.fromPicId, transferFromUsers.id))
    .leftJoin(transferToUsers, eq(assetTransfers.toPicId, transferToUsers.id))
    .leftJoin(transferRequesterUsers, eq(assetTransfers.requestedBy, transferRequesterUsers.id))
    .leftJoin(users, eq(assetTransfers.rejectedBy, users.id))
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

  const confirmations = await loadConfirmations(db, transferId);
  return { ...transfer, confirmations };
}

/** Confirms a transfer for the given user. Completes the transfer when all parties confirm. */
export async function confirmTransfer(transferId: string, userId?: string, options?: { bypassPartyCheck?: boolean }) {
  if (!userId) throw new AppError(400, 'VALIDATION_ERROR', 'User is required.');
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    const [transfer] = await tx
      .select()
      .from(assetTransfers)
      .where(eq(assetTransfers.id, sql`${transferId}::uuid`))
      .limit(1)
      .for('update');
    if (!transfer) throw new AppError(404, 'NOT_FOUND', 'Transfer not found.');
    if (transfer.status !== TRANSFER_STATUS.PENDING) {
      throw new AppError(409, 'CONFLICT', `Transfer cannot be confirmed (current status: ${transfer.status}).`);
    }

    const [confirmation] = await tx
      .select({ id: transferConfirmations.id, status: transferConfirmations.status })
      .from(transferConfirmations)
      .where(and(eq(transferConfirmations.transferId, sql`${transferId}::uuid`), eq(transferConfirmations.userId, sql`${userId}::uuid`)))
      .limit(1);
    if (!confirmation && !options?.bypassPartyCheck) {
      throw new AppError(403, 'FORBIDDEN', 'You are not a party to this transfer.');
    }
    if (confirmation && confirmation.status !== CONFIRMATION_STATUS.PENDING) {
      throw new AppError(409, 'CONFLICT', `Confirmation already ${confirmation.status}.`);
    }

    if (confirmation) {
      await tx
        .update(transferConfirmations)
        .set({ status: CONFIRMATION_STATUS.CONFIRMED, confirmedAt: sql`now()`, reason: null, updatedAt: sql`now()` } as any)
        .where(eq(transferConfirmations.id, confirmation.id));
    }

    // Complete when no pending confirmations remain.
    const [pending] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(transferConfirmations)
      .where(and(eq(transferConfirmations.transferId, sql`${transferId}::uuid`), eq(transferConfirmations.status, CONFIRMATION_STATUS.PENDING)));
    const remaining = Number(pending?.value ?? 0);

    if (remaining > 0) {
      return { completed: false, transferId, pendingRemaining: remaining };
    }

    // All parties confirmed -> move the asset and record a single movement.
    const [asset] = await tx
      .select({
        id: assetsTable.id,
        currentPicId: assetsTable.currentPicId,
        assetCode: assetsTable.assetCode,
        assetName: assetsTable.assetName,
      })
      .from(assetsTable)
      .where(eq(assetsTable.id, transfer.assetId))
      .limit(1);
    if (!asset) throw new AppError(404, 'NOT_FOUND', 'Asset not found.');

    const [updatedTransfer] = await tx
      .update(assetTransfers)
      .set({
        status: TRANSFER_STATUS.COMPLETED,
        completedAt: sql`now()`,
        approvedBy: sql`${userId}::uuid`,
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
      .where(eq(assetsTable.id, transfer.assetId));

    // Update assignments following the existing Assignment workflow: close the
    // current ACTIVE assignment and open a new one for the receiver.
    await tx
      .update(assetAssignments)
      .set({ status: 'RETURNED', returnedDate: sql`${movementDate}::date`, updatedAt: sql`now()` } as any)
      .where(and(eq(assetAssignments.assetId, transfer.assetId), eq(assetAssignments.status, 'ACTIVE')));

    if (transfer.toPicId) {
      await tx.insert(assetAssignments).values({
        assetId: transfer.assetId,
        userId: transfer.toPicId,
        departmentId: transfer.toDepartmentId ?? undefined,
        assignedDate: sql`${movementDate}::date`,
        assignedBy: userId ? sql`${userId}::uuid` : undefined,
        status: 'ACTIVE',
        notes: transfer.reason ?? undefined,
      } as any);
    }

    return { completed: true, transfer: updatedTransfer, movement: movementRecord, asset };
  });

  if (result.completed && result.transfer) {
    const t = result.transfer as any;
    const assetInfo = (result as any).asset;
    // Disable actions and announce completion to all parties.
    await notificationRepo.updateTransferActionData(transferId, { actionsEnabled: false, status: 'COMPLETED' });
    const confirmations = await loadConfirmations(db, transferId);
    for (const c of confirmations) {
      eventBus.publish({
        type: 'MOVEMENT',
        action: 'transfer_completed',
        targetUserId: c.userId,
        entityType: 'asset_transfer',
        entityId: transferId,
        data: {
          assetCode: assetInfo?.assetCode ?? '',
          assetName: assetInfo?.assetName ?? '',
          assetId: t.assetId,
          transferId,
          toRoomName: '',
        },
      });
    }
  } else {
    await notificationRepo.updateTransferActionData(transferId, { status: 'CONFIRMED' }, userId);
    // Inform the creator/other parties that a confirmation was recorded.
    const confirmations = await loadConfirmations(db, transferId);
    const me = confirmations.find((c) => c.userId === userId);
    for (const c of confirmations) {
      eventBus.publish({
        type: 'MOVEMENT',
        action: 'transfer_confirmed',
        targetUserId: c.userId,
        entityType: 'asset_transfer',
        entityId: transferId,
        data: { userName: me?.userName ?? '', transferId, assetId: '', assetCode: '', assetName: '' },
      });
    }
  }

  return result;
}

/** Rejects a transfer for the given user. One rejection terminates the transfer. */
export async function rejectTransfer(transferId: string, userId: string | undefined, reason: string) {
  if (!userId) throw new AppError(400, 'VALIDATION_ERROR', 'User is required.');
  const cleanReason = str(reason);
  if (!cleanReason) throw new AppError(400, 'VALIDATION_ERROR', 'Rejection reason is required.');
  const db = getDb();

  const result = await db.transaction(async (tx) => {
    const [transfer] = await tx
      .select()
      .from(assetTransfers)
      .where(eq(assetTransfers.id, sql`${transferId}::uuid`))
      .limit(1)
      .for('update');
    if (!transfer) throw new AppError(404, 'NOT_FOUND', 'Transfer not found.');
    if (transfer.status !== TRANSFER_STATUS.PENDING) {
      throw new AppError(409, 'CONFLICT', `Transfer cannot be rejected (current status: ${transfer.status}).`);
    }

    const [confirmation] = await tx
      .select({ id: transferConfirmations.id, status: transferConfirmations.status })
      .from(transferConfirmations)
      .where(and(eq(transferConfirmations.transferId, sql`${transferId}::uuid`), eq(transferConfirmations.userId, sql`${userId}::uuid`)))
      .limit(1);
    if (!confirmation) {
      throw new AppError(403, 'FORBIDDEN', 'You are not a party to this transfer.');
    }
    if (confirmation.status !== CONFIRMATION_STATUS.PENDING) {
      throw new AppError(409, 'CONFLICT', `Confirmation already ${confirmation.status}.`);
    }

    await tx
      .update(transferConfirmations)
      .set({
        status: CONFIRMATION_STATUS.REJECTED,
        reason: cleanReason,
        rejectedAt: sql`now()`,
        updatedAt: sql`now()`,
      } as any)
      .where(eq(transferConfirmations.id, confirmation.id));

    const [updatedTransfer] = await tx
      .update(assetTransfers)
      .set({
        status: TRANSFER_STATUS.REJECTED,
        rejectedBy: sql`${userId}::uuid`,
        rejectionReason: cleanReason,
        rejectedAt: sql`now()`,
        updatedAt: sql`now()`,
      } as any)
      .where(eq(assetTransfers.id, sql`${transferId}::uuid`))
      .returning();

    return { transfer: updatedTransfer };
  });

  const confirmations = await loadConfirmations(db, transferId);
  const rejector = confirmations.find((c) => c.userId === userId);
  await notificationRepo.updateTransferActionData(transferId, {
    actionsEnabled: false,
    status: 'REJECTED',
    rejectedByName: rejector?.userName ?? '',
    reason: cleanReason,
  });
  for (const c of confirmations) {
    eventBus.publish({
      type: 'MOVEMENT',
      action: 'transfer_rejected',
      targetUserId: c.userId,
      entityType: 'asset_transfer',
      entityId: transferId,
      data: {
        userName: rejector?.userName ?? '',
        reason: cleanReason,
        transferId,
        assetId: '',
        assetCode: '',
        assetName: '',
      },
    });
  }

  return result;
}

export async function cancelTransfer(transferId: string, _userId?: string) {
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

  await notificationRepo.updateTransferActionData(transferId, { actionsEnabled: false, status: 'CANCELLED' });

  return updatedTransfer;
}

/** List of transfer confirmations for a transfer (used by tests/frontends). */
export async function getTransferConfirmations(transferId: string) {
  const transfer = await getTransferById(transferId);
  return (transfer as any).confirmations;
}
