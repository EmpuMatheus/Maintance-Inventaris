import { getDb } from '@/database/client';
import {
  networkDevices,
  rooms,
  assets,
  assetCategories,
  assetSubcategories,
  sites,
  buildings,
  floors,
  departments,
  users,
} from '@/database/schema';
import { alias } from 'drizzle-orm/pg-core';
import { eq, and, sql, desc, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { deriveDeviceType } from './device-type';

const assetRooms = alias(rooms, 'asset_rooms');
const assetPics = alias(users, 'asset_pics');

export interface DeviceFilters {
  page?: number;
  limit?: number;
  search?: string;
  deviceType?: string;
  status?: string;
  roomId?: string;
  isActive?: boolean;
}

const DEVICE_SELECT = {
  id: networkDevices.id,
  name: networkDevices.name,
  deviceType: networkDevices.deviceType,
  hostname: networkDevices.hostname,
  ipAddress: networkDevices.ipAddress,
  macAddress: networkDevices.macAddress,
  roomId: networkDevices.roomId,
  assetId: networkDevices.assetId,
  status: networkDevices.status,
  consecutiveFailures: networkDevices.consecutiveFailures,
  lastPingAt: networkDevices.lastPingAt,
  lastSuccessAt: networkDevices.lastSuccessAt,
  lastStatusChangeAt: networkDevices.lastStatusChangeAt,
  offlineStartedAt: networkDevices.offlineStartedAt,
  isActive: networkDevices.isActive,
  createdAt: networkDevices.createdAt,
  updatedAt: networkDevices.updatedAt,
  roomCode: rooms.code,
  roomName: rooms.name,
  roomFloorId: rooms.floorId,
  roomFloorName: floors.name,
  roomBuildingId: floors.buildingId,
  roomBuildingName: buildings.name,
  roomSiteId: buildings.siteId,
  roomSiteName: sites.name,
  assetCode: assets.assetCode,
  assetName: assets.assetName,
  assetStatus: assets.status,
  assetCondition: assets.condition,
  assetCategoryId: assets.categoryId,
  assetCategoryName: assetCategories.name,
  assetSubcategoryId: assets.subcategoryId,
  assetSubcategoryCode: assetSubcategories.code,
  assetSubcategoryName: assetSubcategories.name,
  assetPicName: assetPics.name,
  assetRoomId: assets.roomId,
  assetRoomCode: assetRooms.code,
  assetRoomName: assetRooms.name,
};

type DeviceRow = Record<string, unknown>;

function mapDevice(row: DeviceRow) {
  const hasAsset = Boolean(row.assetId);
  // When the device is linked to an Asset, its PIC (hostname) and Room are read
  // live from the Asset so the device never shows stale data. The stored
  // columns remain as a fallback for unlinked devices.
  const hostname = hasAsset
    ? ((row.assetPicName as string | null) ?? null)
    : ((row.hostname as string | null) ?? null);
  const roomId = hasAsset ? ((row.assetRoomId as string) ?? (row.roomId as string)) : (row.roomId as string);
  const roomCode = hasAsset ? ((row.assetRoomCode as string | null) ?? (row.roomCode as string)) : (row.roomCode as string);
  const roomName = hasAsset ? ((row.assetRoomName as string | null) ?? (row.roomName as string)) : (row.roomName as string);
  // Device type also follows the asset's subcategory live, so editing the
  // subcategory is reflected without a separate device update.
  const deviceType = hasAsset
    ? deriveDeviceType({ code: row.assetSubcategoryCode, name: row.assetSubcategoryName })
    : (row.deviceType as string);
  const location = [row.roomSiteName, row.roomBuildingName, row.roomFloorName, roomName]
    .filter((v): v is string => Boolean(v))
    .join(' / ');
  return {
    id: row.id as string,
    name: row.name as string,
    deviceType,
    hostname,
    ipAddress: row.ipAddress as string,
    macAddress: (row.macAddress as string | null) ?? null,
    roomId,
    assetId: (row.assetId as string | null) ?? null,
    status: row.status as string,
    consecutiveFailures: row.consecutiveFailures as number,
    lastPingAt: (row.lastPingAt as Date | null) ?? null,
    lastSuccessAt: (row.lastSuccessAt as Date | null) ?? null,
    lastStatusChangeAt: (row.lastStatusChangeAt as Date | null) ?? null,
    offlineStartedAt: (row.offlineStartedAt as Date | null) ?? null,
    isActive: row.isActive as boolean,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    room: {
      id: roomId,
      code: roomCode,
      name: roomName,
      location: location || null,
      floorId: (row.roomFloorId as string | null) ?? null,
      floorName: (row.roomFloorName as string | null) ?? null,
      buildingId: (row.roomBuildingId as string | null) ?? null,
      buildingName: (row.roomBuildingName as string | null) ?? null,
      siteId: (row.roomSiteId as string | null) ?? null,
      siteName: (row.roomSiteName as string | null) ?? null,
    },
    asset: hasAsset
      ? {
          id: row.assetId as string,
          assetCode: row.assetCode as string,
          assetName: row.assetName as string,
          status: row.assetStatus as string,
          condition: row.assetCondition as string,
          categoryId: row.assetCategoryId as string | null,
          categoryName: row.assetCategoryName as string,
          subcategoryId: (row.assetSubcategoryId as string | null) ?? null,
          subcategoryName: (row.assetSubcategoryName as string | null) ?? null,
          picName: (row.assetPicName as string | null) ?? null,
        }
      : null,
  } as any;
}

export async function findMany(filters: DeviceFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (filters.search) {
    const p = `%${filters.search}%`;
    conditions.push(
      sql`(${networkDevices.name} ILIKE ${p} OR ${networkDevices.hostname} ILIKE ${p} OR ${networkDevices.ipAddress} ILIKE ${p})`,
    );
  }
  if (filters.deviceType) conditions.push(eq(networkDevices.deviceType, sql`${filters.deviceType}::varchar`));
  if (filters.status) conditions.push(eq(networkDevices.status, sql`${filters.status}::varchar`));
  if (filters.roomId) conditions.push(eq(networkDevices.roomId, sql`${filters.roomId}::uuid`));
  if (filters.isActive !== undefined) conditions.push(eq(networkDevices.isActive, filters.isActive));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select(DEVICE_SELECT)
    .from(networkDevices)
    .leftJoin(rooms, eq(networkDevices.roomId, rooms.id))
    .leftJoin(floors, eq(rooms.floorId, floors.id))
    .leftJoin(buildings, eq(floors.buildingId, buildings.id))
    .leftJoin(sites, eq(buildings.siteId, sites.id))
    .leftJoin(assets, eq(networkDevices.assetId, assets.id))
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(assetSubcategories, eq(assets.subcategoryId, assetSubcategories.id))
    .leftJoin(assetPics, eq(assets.currentPicId, assetPics.id))
    .leftJoin(assetRooms, eq(assets.roomId, assetRooms.id))
    .leftJoin(departments, eq(assets.departmentId, departments.id))
    .where(where)
    .orderBy(desc(networkDevices.createdAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ value: count() })
    .from(networkDevices)
    .where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  return {
    data: rows.map((r) => mapDevice(r as DeviceRow)),
    meta: { page, limit, total, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPreviousPage: page > 1 },
  };
}

export async function findById(id: string) {
  const db = getDb();
  const rows = await db
    .select(DEVICE_SELECT)
    .from(networkDevices)
    .leftJoin(rooms, eq(networkDevices.roomId, rooms.id))
    .leftJoin(floors, eq(rooms.floorId, floors.id))
    .leftJoin(buildings, eq(floors.buildingId, buildings.id))
    .leftJoin(sites, eq(buildings.siteId, sites.id))
    .leftJoin(assets, eq(networkDevices.assetId, assets.id))
    .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
    .leftJoin(assetSubcategories, eq(assets.subcategoryId, assetSubcategories.id))
    .leftJoin(assetPics, eq(assets.currentPicId, assetPics.id))
    .leftJoin(assetRooms, eq(assets.roomId, assetRooms.id))
    .leftJoin(departments, eq(assets.departmentId, departments.id))
    .where(eq(networkDevices.id, sql`${id}::uuid`))
    .limit(1);
  const row = rows[0];
  return row ? mapDevice(row as DeviceRow) : null;
}

/** Raw row (no joins) - used by the service for internal checks. */
export async function findRawById(id: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(networkDevices)
    .where(eq(networkDevices.id, sql`${id}::uuid`))
    .limit(1);
  return (rows as DeviceRow[])[0] ?? null;
}

/** Checks whether any ACTIVE device (optionally excluding `excludeId`) uses `ip`. */
export async function findActiveByIp(ip: string, excludeId?: string) {
  const db = getDb();
  const conditions: SQL[] = [eq(networkDevices.ipAddress, ip), eq(networkDevices.isActive, true)];
  if (excludeId) conditions.push(sql`${networkDevices.id} <> ${excludeId}::uuid`);
  const rows = await db
    .select({ id: networkDevices.id })
    .from(networkDevices)
    .where(and(...conditions))
    .limit(1);
  return rows[0] ?? null;
}

export async function create(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(networkDevices).values(data as any).returning();
  return (rows as DeviceRow[])[0] ?? null;
}

export async function update(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db
    .update(networkDevices)
    .set({ ...data, updatedAt: sql`now()` } as any)
    .where(eq(networkDevices.id, sql`${id}::uuid`))
    .returning();
  return (rows as DeviceRow[])[0] ?? null;
}

export async function setActive(id: string, isActive: boolean) {
  const db = getDb();
  const rows = await db
    .update(networkDevices)
    .set({ isActive, updatedAt: sql`now()` } as any)
    .where(eq(networkDevices.id, sql`${id}::uuid`))
    .returning();
  return (rows as DeviceRow[])[0] ?? null;
}
