import { getDb } from '@/database/client';
import { cctvDevices, cctvChannels, cctvStreamProfiles } from '@/database/schema';
import { eq, and, sql, desc, asc, count, inArray } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { resolveIntegrationProtocol } from './integration/protocol';

type Row = Record<string, unknown>;

/**
 * Columns safe to return to the API. `password_encrypted` is intentionally
 * excluded so a device credential can never leak through a list/detail query.
 */
const DEVICE_SELECT = {
  id: cctvDevices.id,
  name: cctvDevices.name,
  deviceType: cctvDevices.deviceType,
  brand: cctvDevices.brand,
  model: cctvDevices.model,
  integrationProtocol: cctvDevices.integrationProtocol,
  ipAddress: cctvDevices.ipAddress,
  port: cctvDevices.port,
  rtspPort: cctvDevices.rtspPort,
  username: cctvDevices.username,
  location: cctvDevices.location,
  description: cctvDevices.description,
  status: cctvDevices.status,
  lastCheckedAt: cctvDevices.lastCheckedAt,
  lastSuccessAt: cctvDevices.lastSuccessAt,
  lastError: cctvDevices.lastError,
  manufacturer: cctvDevices.manufacturer,
  firmwareVersion: cctvDevices.firmwareVersion,
  serialNumber: cctvDevices.serialNumber,
  hardwareId: cctvDevices.hardwareId,
  onvifServices: cctvDevices.onvifServices,
  lastSyncedAt: cctvDevices.lastSyncedAt,
  isActive: cctvDevices.isActive,
  createdAt: cctvDevices.createdAt,
  updatedAt: cctvDevices.updatedAt,
} as const;

export interface DeviceFilters {
  page?: number;
  limit?: number;
  search?: string;
  deviceType?: string;
  status?: string;
  isActive?: boolean;
}

function mapDevice(row: Row) {
  return {
    id: row.id as string,
    name: row.name as string,
    deviceType: row.deviceType as string,
    brand: (row.brand as string | null) ?? null,
    model: (row.model as string | null) ?? null,
    // Prefer the persisted protocol; derive it for legacy rows that predate
    // the column so the UI always has a value.
    integrationProtocol:
      (row.integrationProtocol as string | null) ??
      resolveIntegrationProtocol({
        brand: row.brand,
        model: row.model,
        deviceType: row.deviceType,
      }),
    ipAddress: row.ipAddress as string,
    port: row.port as number,
    rtspPort: (row.rtspPort as number | null) ?? 554,
    username: (row.username as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    status: row.status as string,
    lastCheckedAt: (row.lastCheckedAt as Date | null) ?? null,
    lastSuccessAt: (row.lastSuccessAt as Date | null) ?? null,
    lastError: (row.lastError as string | null) ?? null,
    manufacturer: (row.manufacturer as string | null) ?? null,
    firmwareVersion: (row.firmwareVersion as string | null) ?? null,
    serialNumber: (row.serialNumber as string | null) ?? null,
    hardwareId: (row.hardwareId as string | null) ?? null,
    onvifServices: (row.onvifServices as unknown) ?? null,
    lastSyncedAt: (row.lastSyncedAt as Date | null) ?? null,
    isActive: row.isActive as boolean,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
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
      sql`(${cctvDevices.name} ILIKE ${p} OR ${cctvDevices.ipAddress} ILIKE ${p} OR ${cctvDevices.brand} ILIKE ${p} OR ${cctvDevices.model} ILIKE ${p})`,
    );
  }
  if (filters.deviceType) conditions.push(eq(cctvDevices.deviceType, sql`${filters.deviceType}::varchar`));
  if (filters.status) conditions.push(eq(cctvDevices.status, sql`${filters.status}::varchar`));
  if (filters.isActive !== undefined) conditions.push(eq(cctvDevices.isActive, filters.isActive));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select(DEVICE_SELECT)
    .from(cctvDevices)
    .where(where)
    .orderBy(desc(cctvDevices.createdAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(cctvDevices).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  return {
    data: rows.map((r) => mapDevice(r as Row)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}

export async function findById(id: string) {
  const db = getDb();
  const rows = await db.select(DEVICE_SELECT).from(cctvDevices).where(eq(cctvDevices.id, sql`${id}::uuid`)).limit(1);
  return rows[0] ? mapDevice(rows[0] as Row) : null;
}

/** Full raw row including the encrypted credential. Internal use only. */
export async function findRawById(id: string) {
  const db = getDb();
  const rows = await db.select().from(cctvDevices).where(eq(cctvDevices.id, sql`${id}::uuid`)).limit(1);
  return (rows as Row[])[0] ?? null;
}

export async function findActiveByEndpoint(ipAddress: string, port: number, excludeId?: string) {
  const db = getDb();
  const conditions: SQL[] = [
    eq(cctvDevices.ipAddress, ipAddress),
    eq(cctvDevices.port, port),
    eq(cctvDevices.isActive, true),
  ];
  if (excludeId) conditions.push(sql`${cctvDevices.id} <> ${excludeId}::uuid`);
  const rows = await db.select({ id: cctvDevices.id }).from(cctvDevices).where(and(...conditions)).limit(1);
  return rows[0] ?? null;
}

export async function create(data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db.insert(cctvDevices).values(data as any).returning();
  return (rows as Row[])[0] ?? null;
}

export async function update(id: string, data: Record<string, unknown>) {
  const db = getDb();
  const rows = await db
    .update(cctvDevices)
    .set({ ...data, updatedAt: sql`now()` } as any)
    .where(eq(cctvDevices.id, sql`${id}::uuid`))
    .returning();
  return (rows as Row[])[0] ?? null;
}

export async function setActive(id: string, isActive: boolean) {
  const db = getDb();
  const rows = await db
    .update(cctvDevices)
    .set({ isActive, updatedAt: sql`now()` } as any)
    .where(eq(cctvDevices.id, sql`${id}::uuid`))
    .returning();
  return (rows as Row[])[0] ?? null;
}

/**
 * Records the outcome of a connection attempt. Only backend-owned technical
 * columns are touched; user-managed fields are never affected.
 */
export async function recordConnectionResult(
  id: string,
  result: {
    status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
    lastCheckedAt: Date;
    lastSuccessAt?: Date | null;
    lastError?: string | null;
    info?: {
      manufacturer?: string | null;
      model?: string | null;
      firmwareVersion?: string | null;
      serialNumber?: string | null;
      hardwareId?: string | null;
      onvifServices?: unknown;
      integrationProtocol?: string;
    } | null;
  },
) {
  const db = getDb();
  const data: Record<string, unknown> = {
    status: result.status,
    lastCheckedAt: result.lastCheckedAt,
    lastError: result.lastError ?? null,
  };
  if (result.lastSuccessAt) data.lastSuccessAt = result.lastSuccessAt;
  if (result.info) {
    if (result.info.manufacturer !== undefined) data.manufacturer = result.info.manufacturer;
    if (result.info.firmwareVersion !== undefined) {
      data.firmwareVersion = result.info.firmwareVersion;
    }
    if (result.info.serialNumber !== undefined) data.serialNumber = result.info.serialNumber;
    if (result.info.hardwareId !== undefined) data.hardwareId = result.info.hardwareId;
    // Model/brand are user-owned; only fill them when the device reports a
    // value AND the user has not set one (handled in the service).
    if (result.info.onvifServices !== undefined) data.onvifServices = result.info.onvifServices;
    if (result.info.integrationProtocol !== undefined) {
      data.integrationProtocol = result.info.integrationProtocol;
    }
  }
  const rows = await db
    .update(cctvDevices)
    .set({ ...data, updatedAt: sql`now()` } as any)
    .where(eq(cctvDevices.id, sql`${id}::uuid`))
    .returning();
  return (rows as Row[])[0] ?? null;
}

export async function markSynced(id: string, at: Date) {
  const db = getDb();
  await db
    .update(cctvDevices)
    .set({ lastSyncedAt: at, updatedAt: sql`now()` } as any)
    .where(eq(cctvDevices.id, sql`${id}::uuid`));
}

/* ----------------------------- Channels ----------------------------- */

export interface ChannelFilters {
  page?: number;
  limit?: number;
  deviceId?: string;
  status?: string;
  search?: string;
  isActive?: boolean;
}

const CHANNEL_SELECT = {
  id: cctvChannels.id,
  deviceId: cctvChannels.deviceId,
  channelNumber: cctvChannels.channelNumber,
  deviceChannelId: cctvChannels.deviceChannelId,
  technicalName: cctvChannels.technicalName,
  name: cctvChannels.name,
  location: cctvChannels.location,
  description: cctvChannels.description,
  displayOrder: cctvChannels.displayOrder,
  cameraIp: cctvChannels.cameraIp,
  status: cctvChannels.status,
  isActive: cctvChannels.isActive,
  lastSyncAt: cctvChannels.lastSyncAt,
  createdAt: cctvChannels.createdAt,
  updatedAt: cctvChannels.updatedAt,
} as const;

function mapChannel(row: Row) {
  return {
    id: row.id as string,
    deviceId: row.deviceId as string,
    channelNumber: row.channelNumber as number,
    deviceChannelId: (row.deviceChannelId as string | null) ?? null,
    technicalName: (row.technicalName as string | null) ?? null,
    name: row.name as string,
    location: (row.location as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    displayOrder: row.displayOrder as number,
    cameraIp: (row.cameraIp as string | null) ?? null,
    status: row.status as string,
    isActive: row.isActive as boolean,
    lastSyncAt: (row.lastSyncAt as Date | null) ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Lightweight device lookup (id + name + type) for channel/stream responses. */
export async function findDeviceSummaries(ids: string[]) {
  if (ids.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select({
      id: cctvDevices.id,
      name: cctvDevices.name,
      deviceType: cctvDevices.deviceType,
      brand: cctvDevices.brand,
      model: cctvDevices.model,
      integrationProtocol: cctvDevices.integrationProtocol,
      status: cctvDevices.status,
      isActive: cctvDevices.isActive,
    })
    .from(cctvDevices)
    .where(inArray(cctvDevices.id, ids));
  return rows as unknown as Row[];
}

export async function findChannelsByDevice(deviceId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(cctvChannels)
    .where(eq(cctvChannels.deviceId, sql`${deviceId}::uuid`))
    .orderBy(asc(cctvChannels.channelNumber));
  return rows as unknown as Row[];
}

export async function findManyChannels(filters: ChannelFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (filters.deviceId) conditions.push(eq(cctvChannels.deviceId, sql`${filters.deviceId}::uuid`));
  if (filters.status) conditions.push(eq(cctvChannels.status, sql`${filters.status}::varchar`));
  if (filters.isActive !== undefined) conditions.push(eq(cctvChannels.isActive, filters.isActive));
  if (filters.search) {
    const p = `%${filters.search}%`;
    conditions.push(
      sql`(${cctvChannels.name} ILIKE ${p} OR ${cctvChannels.technicalName} ILIKE ${p} OR ${cctvChannels.location} ILIKE ${p} OR CAST(${cctvChannels.channelNumber} AS text) ILIKE ${p})`,
    );
  }

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select(CHANNEL_SELECT)
    .from(cctvChannels)
    .where(where)
    .orderBy(asc(cctvChannels.channelNumber))
    .limit(limit)
    .offset(offset);

  const totalResult = await db.select({ value: count() }).from(cctvChannels).where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  return {
    data: rows.map((r) => mapChannel(r as Row)),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}

export async function findChannelById(id: string) {
  const db = getDb();
  const rows = await db.select(CHANNEL_SELECT).from(cctvChannels).where(eq(cctvChannels.id, sql`${id}::uuid`)).limit(1);
  return rows[0] ? mapChannel(rows[0] as Row) : null;
}

export async function findChannelByNumber(deviceId: string, channelNumber: number) {
  const db = getDb();
  const rows = await db
    .select()
    .from(cctvChannels)
    .where(and(eq(cctvChannels.deviceId, sql`${deviceId}::uuid`), eq(cctvChannels.channelNumber, channelNumber)))
    .limit(1);
  return (rows as Row[])[0] ?? null;
}

/**
 * Creates or updates a channel's TECHNICAL fields only. Operational fields
 * (name, location, description, displayOrder, isActive) are never part of the
 * update payload, so a user's edits survive every sync.
 */
export async function upsertChannelTechnical(
  deviceId: string,
  channelNumber: number,
  technical: {
    deviceChannelId?: string | null;
    technicalName?: string | null;
    cameraIp?: string | null;
    status: string;
    lastSyncAt: Date;
  },
) {
  const db = getDb();
  const rows = await db
    .insert(cctvChannels)
    .values({
      deviceId: sql`${deviceId}::uuid`,
      channelNumber,
      deviceChannelId: technical.deviceChannelId ?? null,
      technicalName: technical.technicalName ?? null,
      cameraIp: technical.cameraIp ?? null,
      status: technical.status,
      lastSyncAt: technical.lastSyncAt,
    } as any)
    .onConflictDoUpdate({
      target: [cctvChannels.deviceId, cctvChannels.channelNumber],
      set: {
        deviceChannelId: technical.deviceChannelId ?? null,
        technicalName: technical.technicalName ?? null,
        cameraIp: technical.cameraIp ?? null,
        status: technical.status,
        lastSyncAt: technical.lastSyncAt,
        updatedAt: sql`now()`,
      } as any,
    })
    .returning();
  return (rows as Row[])[0] ?? null;
}

/** Marks channels not returned by the latest sync as MISSING (never deletes). */
export async function markChannelsMissing(deviceId: string, keepChannelIds: string[], at: Date) {
  const db = getDb();
  if (keepChannelIds.length === 0) {
    await db
      .update(cctvChannels)
      .set({ status: 'MISSING', lastSyncAt: at, updatedAt: sql`now()` } as any)
      .where(eq(cctvChannels.deviceId, sql`${deviceId}::uuid`));
    return;
  }
  const list = sql.join(
    keepChannelIds.map((id) => sql`${id}::uuid`),
    sql`, `,
  );
  await db
    .update(cctvChannels)
    .set({ status: 'MISSING', lastSyncAt: at, updatedAt: sql`now()` } as any)
    .where(
      and(
        eq(cctvChannels.deviceId, sql`${deviceId}::uuid`),
        sql`${cctvChannels.id} NOT IN (${list})`,
      ),
    );
}

export async function updateChannelOperational(
  id: string,
  data: {
    name?: string;
    location?: string | null;
    description?: string | null;
    displayOrder?: number;
    isActive?: boolean;
  },
) {
  const db = getDb();
  const rows = await db
    .update(cctvChannels)
    .set({ ...data, updatedAt: sql`now()` } as any)
    .where(eq(cctvChannels.id, sql`${id}::uuid`))
    .returning();
  return (rows as Row[])[0] ?? null;
}

/* -------------------------- Stream profiles -------------------------- */

export interface ProfileInput {
  profileToken: string;
  profileName: string | null;
  streamType: string;
  streamUri: string | null;
  videoCodec: string | null;
  resolution: string | null;
  fps: number | null;
  isMainStream: boolean;
}

export async function upsertStreamProfiles(channelId: string, profiles: ProfileInput[]) {
  const db = getDb();
  if (profiles.length === 0) return;
  for (const p of profiles) {
    await db
      .insert(cctvStreamProfiles)
      .values({
        channelId: sql`${channelId}::uuid`,
        profileToken: p.profileToken,
        profileName: p.profileName,
        streamType: p.streamType,
        streamUri: p.streamUri,
        videoCodec: p.videoCodec,
        resolution: p.resolution,
        fps: p.fps,
        isMainStream: p.isMainStream,
      } as any)
      .onConflictDoUpdate({
        target: [cctvStreamProfiles.channelId, cctvStreamProfiles.profileToken],
        set: {
          profileName: p.profileName,
          streamType: p.streamType,
          streamUri: p.streamUri,
          videoCodec: p.videoCodec,
          resolution: p.resolution,
          fps: p.fps,
          isMainStream: p.isMainStream,
          updatedAt: sql`now()`,
        } as any,
      });
  }
}

/** Removes stream profiles that no longer exist on the device for a channel. */
export async function deleteStreamProfilesNotIn(channelId: string, profileTokens: string[]) {
  const db = getDb();
  if (profileTokens.length === 0) {
    await db.delete(cctvStreamProfiles).where(eq(cctvStreamProfiles.channelId, sql`${channelId}::uuid`));
    return;
  }
  const list = sql.join(
    profileTokens.map((t) => sql`${t}`),
    sql`, `,
  );
  await db
    .delete(cctvStreamProfiles)
    .where(
      and(
        eq(cctvStreamProfiles.channelId, sql`${channelId}::uuid`),
        sql`${cctvStreamProfiles.profileToken} NOT IN (${list})`,
      ),
    );
}

export async function findStreamProfilesByChannelIds(channelIds: string[]) {
  if (channelIds.length === 0) return [];
  const db = getDb();
  const rows = await db
    .select()
    .from(cctvStreamProfiles)
    .where(inArray(cctvStreamProfiles.channelId, channelIds))
    .orderBy(desc(cctvStreamProfiles.isMainStream), asc(cctvStreamProfiles.profileName));
  return rows as unknown as Row[];
}
