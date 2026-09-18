import { getDb } from '@/database/client';
import {
  networkDevices,
  networkConnectionEvents,
  rooms,
  floors,
  buildings,
  sites,
} from '@/database/schema';
import { eq, and, isNull, asc, desc, gte, lte, count, sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import type { DeviceMonitorSnapshot } from './monitoring.types';

type RawDevice = Record<string, unknown>;

/** Active devices eligible for monitoring, with the state needed by the engine. */
export async function findActiveDevices(): Promise<DeviceMonitorSnapshot[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: networkDevices.id,
      name: networkDevices.name,
      deviceType: networkDevices.deviceType,
      ipAddress: networkDevices.ipAddress,
      roomId: networkDevices.roomId,
      status: networkDevices.status,
      consecutiveFailures: networkDevices.consecutiveFailures,
      offlineStartedAt: networkDevices.offlineStartedAt,
      lastPingAt: networkDevices.lastPingAt,
      lastSuccessAt: networkDevices.lastSuccessAt,
      lastStatusChangeAt: networkDevices.lastStatusChangeAt,
    })
    .from(networkDevices)
    .where(eq(networkDevices.isActive, true))
    .orderBy(asc(networkDevices.createdAt));
  return rows.map((r) => ({
    id: r.id as string,
    status: r.status as DeviceMonitorSnapshot['status'],
    consecutiveFailures: r.consecutiveFailures as number,
    offlineStartedAt: (r.offlineStartedAt as Date | null) ?? null,
    lastPingAt: (r.lastPingAt as Date | null) ?? null,
    lastSuccessAt: (r.lastSuccessAt as Date | null) ?? null,
    lastStatusChangeAt: (r.lastStatusChangeAt as Date | null) ?? null,
    name: r.name as string,
    deviceType: r.deviceType as string,
    ipAddress: r.ipAddress as string,
    roomId: r.roomId as string,
  }));
}

export async function findById(id: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(networkDevices)
    .where(eq(networkDevices.id, sql`${id}::uuid`))
    .limit(1);
  return (rows as RawDevice[])[0] ?? null;
}

async function withTransaction<T>(fn: (tx: ReturnType<typeof getDb>) => Promise<T>): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => fn(tx as unknown as ReturnType<typeof getDb>));
}

/**
 * Records every monitoring attempt: `last_ping_at` always advances.
 */
export async function recordPingAttempt(id: string, checkedAt: Date) {
  const db = getDb();
  await db
    .update(networkDevices)
    .set({ lastPingAt: checkedAt, updatedAt: sql`now()` })
    .where(eq(networkDevices.id, sql`${id}::uuid`));
}

/** UNKNOWN/OFFLINE + SUCCESS or ONLINE + SUCCESS: success bookkeeping. */
export async function applySuccess(id: string, checkedAt: Date, statusChanged: boolean) {
  const db = getDb();
  const set: Record<string, unknown> = {
    status: 'ONLINE',
    consecutiveFailures: 0,
    lastPingAt: checkedAt,
    lastSuccessAt: checkedAt,
    offlineStartedAt: null,
    updatedAt: sql`now()`,
  };
  if (statusChanged) set.lastStatusChangeAt = checkedAt;
  await db.update(networkDevices).set(set as any).where(eq(networkDevices.id, sql`${id}::uuid`));
}

/** ONLINE + FAIL: increment the failure counter, still ONLINE. */
export async function applyFailure(id: string, consecutiveFailures: number, checkedAt: Date) {
  const db = getDb();
  await db
    .update(networkDevices)
    .set({ consecutiveFailures, lastPingAt: checkedAt, updatedAt: sql`now()` } as any)
    .where(eq(networkDevices.id, sql`${id}::uuid`));
}

/** OFFLINE + FAIL: only `last_ping_at` updates; no new incident. */
export async function applyOfflineFailure(id: string, checkedAt: Date) {
  const db = getDb();
  await db
    .update(networkDevices)
    .set({ lastPingAt: checkedAt, updatedAt: sql`now()` } as any)
    .where(eq(networkDevices.id, sql`${id}::uuid`));
}

/**
 * ONLINE -> OFFLINE transition. Atomically sets the device OFFLINE and creates
 * exactly one CONNECTION_LOST incident. The partial unique index on the
 * incident table guards against duplicate active incidents.
 */
export async function applyOfflineWithIncident(
  id: string,
  offlineStartedAt: Date,
  consecutiveFailures: number,
): Promise<string | undefined> {
  return withTransaction(async (tx) => {
    await tx
      .update(networkDevices)
      .set({
        status: 'OFFLINE',
        consecutiveFailures,
        offlineStartedAt,
        lastStatusChangeAt: offlineStartedAt,
        lastPingAt: offlineStartedAt,
        updatedAt: sql`now()`,
      } as any)
      .where(eq(networkDevices.id, sql`${id}::uuid`));

    const inserted = await tx
      .insert(networkConnectionEvents)
      .values({
        networkDeviceId: sql`${id}::uuid`,
        eventType: 'CONNECTION_LOST',
        startedAt: offlineStartedAt,
      } as any)
      .returning({ id: networkConnectionEvents.id });
    return (inserted as { id: string }[])[0]?.id;
  });
}

/** OFFLINE -> ONLINE recovery: sets ONLINE and resolves the active incident. */
export async function applyRecoveryWithResolve(
  id: string,
  resolvedAt: Date,
): Promise<{ incidentId: string; durationSeconds: number; startedAt: Date } | undefined> {
  return withTransaction(async (tx) => {
    await tx
      .update(networkDevices)
      .set({
        status: 'ONLINE',
        consecutiveFailures: 0,
        offlineStartedAt: null,
        lastPingAt: resolvedAt,
        lastSuccessAt: resolvedAt,
        lastStatusChangeAt: resolvedAt,
        updatedAt: sql`now()`,
      } as any)
      .where(eq(networkDevices.id, sql`${id}::uuid`));

    const active = await tx
      .select({ id: networkConnectionEvents.id, startedAt: networkConnectionEvents.startedAt })
      .from(networkConnectionEvents)
      .where(
        and(
          eq(networkConnectionEvents.networkDeviceId, sql`${id}::uuid`),
          isNull(networkConnectionEvents.resolvedAt),
        ),
      )
      .orderBy(asc(networkConnectionEvents.startedAt))
      .limit(1);

    const incident = active[0];
    if (!incident) return undefined;

    const started = incident.startedAt as Date;
    const computed = Math.max(0, Math.floor((resolvedAt.getTime() - started.getTime()) / 1000));
    await tx
      .update(networkConnectionEvents)
      .set({ resolvedAt, durationSeconds: computed } as any)
      .where(eq(networkConnectionEvents.id, incident.id as string));
    return { incidentId: incident.id as string, durationSeconds: computed, startedAt: started };
  });
}

export interface NetworkStatusRow {
  id: string;
  name: string;
  deviceType: string;
  ipAddress: string;
  roomId: string;
  roomName: string | null;
  roomCode: string | null;
  location: string | null;
  status: string;
  consecutiveFailures: number;
  lastPingAt: Date | null;
  lastSuccessAt: Date | null;
  lastStatusChangeAt: Date | null;
  offlineStartedAt: Date | null;
  isActive: boolean;
}

/**
 * Current monitoring state for every device. Used by the recovery endpoint
 * (`GET /network-monitoring/status`) that clients call after (re)connecting,
 * since the backend remains the monitoring source of truth.
 */
export async function findStatus(): Promise<NetworkStatusRow[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: networkDevices.id,
      name: networkDevices.name,
      deviceType: networkDevices.deviceType,
      ipAddress: networkDevices.ipAddress,
      roomId: networkDevices.roomId,
      status: networkDevices.status,
      consecutiveFailures: networkDevices.consecutiveFailures,
      lastPingAt: networkDevices.lastPingAt,
      lastSuccessAt: networkDevices.lastSuccessAt,
      lastStatusChangeAt: networkDevices.lastStatusChangeAt,
      offlineStartedAt: networkDevices.offlineStartedAt,
      isActive: networkDevices.isActive,
      roomName: rooms.name,
      roomCode: rooms.code,
      roomFloorName: floors.name,
      roomBuildingName: buildings.name,
      roomSiteName: sites.name,
    })
    .from(networkDevices)
    .leftJoin(rooms, eq(networkDevices.roomId, rooms.id))
    .leftJoin(floors, eq(rooms.floorId, floors.id))
    .leftJoin(buildings, eq(floors.buildingId, buildings.id))
    .leftJoin(sites, eq(buildings.siteId, sites.id))
    .orderBy(asc(networkDevices.name));
  return rows.map((r) => {
    const location = [r.roomSiteName, r.roomBuildingName, r.roomFloorName, r.roomName]
      .filter((v): v is string => Boolean(v))
      .join(' / ');
    return {
      id: r.id as string,
      name: r.name as string,
      deviceType: r.deviceType as string,
      ipAddress: r.ipAddress as string,
      roomId: r.roomId as string,
      roomName: (r.roomName as string | null) ?? null,
      roomCode: (r.roomCode as string | null) ?? null,
      location: location || null,
      status: r.status as string,
      consecutiveFailures: r.consecutiveFailures as number,
      lastPingAt: (r.lastPingAt as Date | null) ?? null,
      lastSuccessAt: (r.lastSuccessAt as Date | null) ?? null,
      lastStatusChangeAt: (r.lastStatusChangeAt as Date | null) ?? null,
      offlineStartedAt: (r.offlineStartedAt as Date | null) ?? null,
      isActive: r.isActive as boolean,
    };
  });
}

export interface EventFilters {
  page?: number;
  limit?: number;
  deviceId?: string;
  roomId?: string;
  deviceType?: string;
  status?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

export interface NetworkEventRow {
  id: string;
  networkDeviceId: string;
  eventType: string;
  startedAt: Date;
  resolvedAt: Date | null;
  durationSeconds: number | null;
  createdAt: Date;
  deviceName: string;
  deviceType: string;
  ipAddress: string;
  roomId: string;
  roomName: string | null;
  roomCode: string | null;
  location: string | null;
  currentStatus: string;
}

/**
 * Incident history (one row per OFFLINE period). Recovery does NOT create a new
 * row; it fills `resolved_at`/`duration_seconds` on the existing incident. A
 * single row therefore renders as two timeline states (CONNECTION_LOST then
 * RESTORED).
 */
export async function findEvents(filters: EventFilters) {
  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const offset = (page - 1) * limit;
  const conditions: SQL[] = [];

  if (filters.deviceId) conditions.push(eq(networkConnectionEvents.networkDeviceId, sql`${filters.deviceId}::uuid`));
  if (filters.roomId) conditions.push(eq(networkDevices.roomId, sql`${filters.roomId}::uuid`));
  if (filters.deviceType) conditions.push(eq(networkDevices.deviceType, sql`${filters.deviceType}::varchar`));
  if (filters.search) {
    const p = `%${filters.search}%`;
    conditions.push(
      sql`(${networkDevices.name} ILIKE ${p} OR ${networkDevices.ipAddress} ILIKE ${p})`,
    );
  }
  // "status" here refers to the incident state as rendered in the timeline.
  if (filters.status === 'OFFLINE') conditions.push(isNull(networkConnectionEvents.resolvedAt));
  if (filters.status === 'ONLINE') conditions.push(sql`${networkConnectionEvents.resolvedAt} IS NOT NULL`);
  if (filters.from) conditions.push(gte(networkConnectionEvents.startedAt, filters.from));
  if (filters.to) conditions.push(lte(networkConnectionEvents.startedAt, filters.to));

  const where = conditions.length ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: networkConnectionEvents.id,
      networkDeviceId: networkConnectionEvents.networkDeviceId,
      eventType: networkConnectionEvents.eventType,
      startedAt: networkConnectionEvents.startedAt,
      resolvedAt: networkConnectionEvents.resolvedAt,
      durationSeconds: networkConnectionEvents.durationSeconds,
      createdAt: networkConnectionEvents.createdAt,
      deviceName: networkDevices.name,
      deviceType: networkDevices.deviceType,
      ipAddress: networkDevices.ipAddress,
      roomId: networkDevices.roomId,
      currentStatus: networkDevices.status,
      roomName: rooms.name,
      roomCode: rooms.code,
      roomFloorName: floors.name,
      roomBuildingName: buildings.name,
      roomSiteName: sites.name,
    })
    .from(networkConnectionEvents)
    .innerJoin(networkDevices, eq(networkConnectionEvents.networkDeviceId, networkDevices.id))
    .leftJoin(rooms, eq(networkDevices.roomId, rooms.id))
    .leftJoin(floors, eq(rooms.floorId, floors.id))
    .leftJoin(buildings, eq(floors.buildingId, buildings.id))
    .leftJoin(sites, eq(buildings.siteId, sites.id))
    .where(where)
    .orderBy(desc(networkConnectionEvents.startedAt))
    .limit(limit)
    .offset(offset);

  const totalResult = await db
    .select({ value: count() })
    .from(networkConnectionEvents)
    .innerJoin(networkDevices, eq(networkConnectionEvents.networkDeviceId, networkDevices.id))
    .where(where);
  const total = Number(totalResult[0]?.value ?? 0);

  const data = rows.map((r) => {
    const location = [r.roomSiteName, r.roomBuildingName, r.roomFloorName, r.roomName]
      .filter((v): v is string => Boolean(v))
      .join(' / ');
    return {
      id: r.id as string,
      networkDeviceId: r.networkDeviceId as string,
      eventType: r.eventType as string,
      startedAt: r.startedAt as Date,
      resolvedAt: (r.resolvedAt as Date | null) ?? null,
      durationSeconds: (r.durationSeconds as number | null) ?? null,
      createdAt: r.createdAt as Date,
      deviceName: r.deviceName as string,
      deviceType: r.deviceType as string,
      ipAddress: r.ipAddress as string,
      roomId: r.roomId as string,
      roomName: (r.roomName as string | null) ?? null,
      roomCode: (r.roomCode as string | null) ?? null,
      location: location || null,
      currentStatus: r.currentStatus as string,
    } satisfies NetworkEventRow;
  });

  return {
    data,
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

/** Incidents that are still active (`resolved_at IS NULL`). */
export async function findActiveIncidents() {
  const db = getDb();
  const rows = await db
    .select({
      id: networkConnectionEvents.id,
      networkDeviceId: networkConnectionEvents.networkDeviceId,
      eventType: networkConnectionEvents.eventType,
      startedAt: networkConnectionEvents.startedAt,
      resolvedAt: networkConnectionEvents.resolvedAt,
      durationSeconds: networkConnectionEvents.durationSeconds,
      createdAt: networkConnectionEvents.createdAt,
      deviceName: networkDevices.name,
      deviceType: networkDevices.deviceType,
      ipAddress: networkDevices.ipAddress,
      roomId: networkDevices.roomId,
      currentStatus: networkDevices.status,
      roomName: rooms.name,
      roomCode: rooms.code,
      roomFloorName: floors.name,
      roomBuildingName: buildings.name,
      roomSiteName: sites.name,
    })
    .from(networkConnectionEvents)
    .innerJoin(networkDevices, eq(networkConnectionEvents.networkDeviceId, networkDevices.id))
    .leftJoin(rooms, eq(networkDevices.roomId, rooms.id))
    .leftJoin(floors, eq(rooms.floorId, floors.id))
    .leftJoin(buildings, eq(floors.buildingId, buildings.id))
    .leftJoin(sites, eq(buildings.siteId, sites.id))
    .where(isNull(networkConnectionEvents.resolvedAt))
    .orderBy(desc(networkConnectionEvents.startedAt));

  return rows.map((r) => {
    const location = [r.roomSiteName, r.roomBuildingName, r.roomFloorName, r.roomName]
      .filter((v): v is string => Boolean(v))
      .join(' / ');
    return {
      id: r.id as string,
      networkDeviceId: r.networkDeviceId as string,
      eventType: r.eventType as string,
      startedAt: r.startedAt as Date,
      resolvedAt: (r.resolvedAt as Date | null) ?? null,
      durationSeconds: (r.durationSeconds as number | null) ?? null,
      createdAt: r.createdAt as Date,
      deviceName: r.deviceName as string,
      deviceType: r.deviceType as string,
      ipAddress: r.ipAddress as string,
      roomId: r.roomId as string,
      roomName: (r.roomName as string | null) ?? null,
      roomCode: (r.roomCode as string | null) ?? null,
      location: location || null,
      currentStatus: r.currentStatus as string,
    } satisfies NetworkEventRow;
  });
}

/** Aggregate counts for the monitoring summary. */
export async function findSummary() {
  const db = getDb();
  const rows = await db
    .select({ status: networkDevices.status, isActive: networkDevices.isActive })
    .from(networkDevices);
  const summary = { total: rows.length, online: 0, offline: 0, unknown: 0, active: 0 };
  for (const row of rows) {
    if (row.isActive) summary.active += 1;
    if (row.status === 'ONLINE') summary.online += 1;
    else if (row.status === 'OFFLINE') summary.offline += 1;
    else summary.unknown += 1;
  }
  return summary;
}
