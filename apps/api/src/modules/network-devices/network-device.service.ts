import { AppError } from '@/middleware/error-handler';
import { getDb } from '@/database/client';
import { rooms, assets } from '@/database/schema';
import { eq, sql } from 'drizzle-orm';
import * as repo from './network-device.repository';

export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  deviceType?: string;
  status?: string;
  roomId?: string;
  isActive?: boolean;
}

export interface CreateInput {
  name: string;
  deviceType: string;
  hostname?: string | null;
  ipAddress: string;
  macAddress?: string | null;
  roomId: string;
  assetId?: string | null;
  isActive?: boolean;
}

export interface UpdateInput {
  name?: string;
  deviceType?: string;
  hostname?: string | null;
  ipAddress?: string;
  macAddress?: string | null;
  roomId?: string;
  assetId?: string | null;
}

async function assertRoomExists(roomId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: rooms.id })
    .from(rooms)
    .where(eq(rooms.id, sql`${roomId}::uuid`))
    .limit(1);
  if (!rows[0]) throw new AppError(400, 'VALIDATION_ERROR', 'Room not found.');
  return rows[0];
}

async function assertAssetExists(assetId: string) {
  const db = getDb();
  const rows = await db
    .select({ id: assets.id, assetCode: assets.assetCode, assetName: assets.assetName })
    .from(assets)
    .where(eq(assets.id, sql`${assetId}::uuid`))
    .limit(1);
  if (!rows[0]) throw new AppError(400, 'VALIDATION_ERROR', 'Asset not found.');
  return rows[0];
}

function getPostgresErrorCode(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { code?: unknown; cause?: unknown };
  if (typeof e.code === 'string') return e.code;
  if (e.cause && typeof e.cause === 'object') {
    const c = e.cause as { code?: unknown };
    if (typeof c.code === 'string') return c.code;
  }
  return undefined;
}

function isUniqueViolation(err: unknown): boolean {
  return getPostgresErrorCode(err) === '23505';
}

export async function list(params: ListParams) {
  return repo.findMany(params);
}

export async function getById(id: string) {
  const row = await repo.findById(id);
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Network device not found.');
  return row;
}

export async function create(body: CreateInput) {
  await assertRoomExists(body.roomId);
  if (body.assetId) await assertAssetExists(body.assetId);

  if (body.isActive !== false) {
    const existing = await repo.findActiveByIp(body.ipAddress);
    if (existing) {
      throw new AppError(409, 'CONFLICT', 'A device with this IP address is already active.');
    }
  }

  const row = await repo.create({
    name: body.name,
    deviceType: body.deviceType,
    hostname: body.hostname ?? undefined,
    ipAddress: body.ipAddress,
    macAddress: body.macAddress ?? undefined,
    roomId: sql`${body.roomId}::uuid`,
    assetId: body.assetId ? sql`${body.assetId}::uuid` : undefined,
    isActive: body.isActive ?? true,
    status: 'UNKNOWN',
    consecutiveFailures: 0,
  });

  return repo.findById(row.id as string);
}

export async function update(id: string, body: UpdateInput) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Network device not found.');

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.deviceType !== undefined) data.deviceType = body.deviceType;
  if (body.hostname !== undefined) data.hostname = body.hostname || null;
  if (body.macAddress !== undefined) data.macAddress = body.macAddress || null;

  if (body.ipAddress !== undefined) {
    const dup = await repo.findActiveByIp(body.ipAddress, id);
    if (dup) throw new AppError(409, 'CONFLICT', 'A device with this IP address is already active.');
    data.ipAddress = body.ipAddress;
  }

  if (body.roomId !== undefined) {
    await assertRoomExists(body.roomId);
    data.roomId = sql`${body.roomId}::uuid`;
  }

  if (body.assetId !== undefined) {
    if (body.assetId) await assertAssetExists(body.assetId);
    data.assetId = body.assetId ? sql`${body.assetId}::uuid` : null;
  }

  // Business rule: do NOT allow monitoring state to be changed through UPDATE.
  delete data.status;
  delete data.updatedAt;
  delete data.isActive;

  if (Object.keys(data).length === 0) {
    return repo.findById(id);
  }

  try {
    await repo.update(id, data);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'CONFLICT', 'An active device with this IP address already exists.');
    }
    throw err;
  }

  return repo.findById(id);
}

export async function setActive(id: string, isActive: boolean) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Network device not found.');

  if (isActive) {
    // Re-activating must not collide with another active device using the same IP.
    const dup = await repo.findActiveByIp(existing.ipAddress as string, id);
    if (dup) {
      throw new AppError(409, 'CONFLICT', 'Another active device is already using this IP address.');
    }
  }

  const row = await repo.setActive(id, isActive);
  // History rows are preserved: deactivation only flips is_active.
  return repo.findById(row.id as string);
}