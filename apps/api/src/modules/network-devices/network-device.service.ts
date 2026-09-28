import { AppError } from '@/middleware/error-handler';
import { getDb } from '@/database/client';
import { networkDevices } from '@/database/schema';
import { eq, and, ne, sql } from 'drizzle-orm';
import * as repo from './network-device.repository';
import * as assetRepo from '@/modules/assets/asset.repository';
import { deriveDeviceType } from './device-type';

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
  name?: string;
  deviceType?: string;
  hostname?: string | null;
  ipAddress: string;
  macAddress?: string | null;
  roomId?: string;
  assetId: string;
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

interface DerivedAsset {
  id: string;
  assetCode: string;
  assetName: string;
  roomId: string | null;
  roomName: string | null;
  picName: string | null;
  subcategoryId: string | null;
  subcategoryCode: string | null;
  subcategoryName: string | null;
  isNetworkDevice: boolean | null;
  deletedAt: Date | null;
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

function getPostgresConstraint(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const e = err as { constraint?: unknown; cause?: unknown };
  if (typeof e.constraint === 'string') return e.constraint;
  if (e.cause && typeof e.cause === 'object') {
    const c = e.cause as { constraint?: unknown };
    if (typeof c.constraint === 'string') return c.constraint;
  }
  return undefined;
}

function uniqueViolationMessage(err: unknown): string {
  return getPostgresConstraint(err) === 'network_devices_active_ip_unique'
    ? 'A device with this IP address is already active.'
    : 'Asset is already used by another network device.';
}

/**
 * Loads an asset and validates that it may back a Network Device:
 * it must exist, have a subcategory flagged `is_network_device`, and not be
 * linked to another Network Device (the current one is excluded on edit).
 *
 * Returns the raw asset info needed to derive `deviceType`/`hostname`/`roomId`.
 */
async function resolveEligibleAsset(assetId: string, excludeDeviceId?: string): Promise<DerivedAsset> {
  const asset = (await assetRepo.findAssetNetworkInfo(assetId)) as DerivedAsset | null;
  if (!asset || asset.deletedAt) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Asset not found.');
  }
  if (!asset.subcategoryId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Asset does not have a subcategory.');
  }
  if (asset.isNetworkDevice !== true) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Asset subcategory is not marked as a network device.');
  }

  const db = getDb();
  const conditions = [eq(networkDevices.assetId, sql`${assetId}::uuid`)];
  if (excludeDeviceId) conditions.push(ne(networkDevices.id, sql`${excludeDeviceId}::uuid`));
  const used = await db
    .select({ id: networkDevices.id })
    .from(networkDevices)
    .where(and(...conditions))
    .limit(1);
  if (used[0]) {
    throw new AppError(409, 'CONFLICT', 'Asset is already used by another network device.');
  }

  return asset;
}

/** Derived, read-only values the form shows once an asset is selected. */
function deriveFromAsset(asset: DerivedAsset) {
  return {
    deviceType: deriveDeviceType({
      code: asset.subcategoryCode,
      name: asset.subcategoryName,
    }),
    hostname: asset.picName,
    roomId: asset.roomId,
  };
}

/** Public preview used by the form to auto-fill the readonly fields. */
export async function getAssetPreview(assetId: string, excludeDeviceId?: string) {
  const asset = await resolveEligibleAsset(assetId, excludeDeviceId);
  const derived = deriveFromAsset(asset);
  return {
    assetId: asset.id,
    assetCode: asset.assetCode,
    assetName: asset.assetName,
    subcategoryId: asset.subcategoryId,
    subcategoryName: asset.subcategoryName,
    picName: asset.picName,
    roomId: derived.roomId,
    roomName: asset.roomName,
    deviceType: derived.deviceType,
    hostname: derived.hostname,
  };
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
  const asset = await resolveEligibleAsset(body.assetId);
  const derived = deriveFromAsset(asset);
  if (!derived.roomId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Asset does not have a room assigned.');
  }

  if (body.isActive !== false) {
    const existing = await repo.findActiveByIp(body.ipAddress);
    if (existing) {
      throw new AppError(409, 'CONFLICT', 'A device with this IP address is already active.');
    }
  }

  try {
    const row = await repo.create({
      name: body.name?.trim() || asset.assetName,
      deviceType: derived.deviceType,
      hostname: derived.hostname,
      ipAddress: body.ipAddress,
      macAddress: body.macAddress ?? undefined,
      roomId: sql`${derived.roomId}::uuid`,
      assetId: sql`${asset.id}::uuid`,
      isActive: body.isActive ?? true,
      status: 'UNKNOWN',
      consecutiveFailures: 0,
    });
    return repo.findById(row.id as string);
  } catch (err: unknown) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'CONFLICT', uniqueViolationMessage(err));
    }
    throw err;
  }
}

export async function update(id: string, body: UpdateInput) {
  const existing = await repo.findRawById(id);
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Network device not found.');

  const data: Record<string, unknown> = {};

  if (body.name !== undefined) data.name = body.name;
  if (body.macAddress !== undefined) data.macAddress = body.macAddress || null;

  if (body.ipAddress !== undefined) {
    const dup = await repo.findActiveByIp(body.ipAddress, id);
    if (dup) throw new AppError(409, 'CONFLICT', 'A device with this IP address is already active.');
    data.ipAddress = body.ipAddress;
  }

  // Asset is the source of truth. When it actually changes the derived fields
  // are recomputed; when it is unchanged the derived fields already follow the
  // asset (read live on the response), so nothing is rewritten. A null/empty
  // assetId clears the relation.
  const assetChanged = body.assetId !== undefined && body.assetId !== existing.assetId;
  if (body.assetId !== undefined && body.assetId) {
    if (assetChanged) {
      const asset = await resolveEligibleAsset(body.assetId!, id);
      const derived = deriveFromAsset(asset);
      if (!derived.roomId) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Asset does not have a room assigned.');
      }
      data.assetId = sql`${asset.id}::uuid`;
      data.deviceType = derived.deviceType;
      data.hostname = derived.hostname;
      data.roomId = sql`${derived.roomId}::uuid`;
      data.name = body.name !== undefined ? body.name : asset.assetName;
    }
  } else if (body.assetId === null && existing.assetId !== null) {
    data.assetId = null;
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
      throw new AppError(409, 'CONFLICT', uniqueViolationMessage(err));
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
