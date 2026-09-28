import { pgTable, uuid, varchar, integer, boolean, timestamp, index, uniqueIndex, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { rooms } from './master-data';
import { assets } from './assets';

export const NETWORK_DEVICE_STATUSES = ['ONLINE', 'OFFLINE', 'UNKNOWN'] as const;
export type NetworkDeviceStatus = (typeof NETWORK_DEVICE_STATUSES)[number];

export const NETWORK_CONNECTION_EVENT_TYPES = ['CONNECTION_LOST'] as const;
export type NetworkConnectionEventType = (typeof NETWORK_CONNECTION_EVENT_TYPES)[number];

export const networkDevices = pgTable(
  'network_devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    deviceType: varchar('device_type', { length: 150 }).notNull().default(''),
    hostname: varchar('hostname', { length: 150 }),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    macAddress: varchar('mac_address', { length: 100 }),
    roomId: uuid('room_id')
      .notNull()
      .references(() => rooms.id),
    assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 50 }).notNull().default('UNKNOWN'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    lastPingAt: timestamp('last_ping_at', { withTimezone: true }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastStatusChangeAt: timestamp('last_status_change_at', { withTimezone: true }),
    offlineStartedAt: timestamp('offline_started_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('network_devices_status_check', sql`${table.status} in ('ONLINE', 'OFFLINE', 'UNKNOWN')`),
    check(
      'network_devices_consecutive_failures_nonnegative',
      sql`${table.consecutiveFailures} >= 0`,
    ),
    check('network_devices_offline_status_consistency', sql`(
      (${table.status} = 'OFFLINE' AND ${table.offlineStartedAt} IS NOT NULL)
      OR (${table.status} <> 'OFFLINE' AND ${table.offlineStartedAt} IS NULL)
    )`),
    uniqueIndex('network_devices_active_ip_unique')
      .on(table.ipAddress)
      .where(sql`${table.isActive} = true`),
    index('network_devices_status_idx').on(table.status),
    index('network_devices_room_id_idx').on(table.roomId),
    // Business rule: one Asset can be linked to at most one Network Device.
    uniqueIndex('network_devices_asset_id_unique')
      .on(table.assetId)
      .where(sql`${table.assetId} IS NOT NULL`),
  ],
);

export const networkConnectionEvents = pgTable(
  'network_connection_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    networkDeviceId: uuid('network_device_id')
      .notNull()
      .references(() => networkDevices.id),
    eventType: varchar('event_type', { length: 50 }).notNull().default('CONNECTION_LOST'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    durationSeconds: integer('duration_seconds'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'network_connection_events_event_type_check',
      sql`${table.eventType} in ('CONNECTION_LOST')`,
    ),
    check('network_connection_events_active_consistency', sql`(
      (${table.resolvedAt} IS NULL AND ${table.durationSeconds} IS NULL)
      OR (${table.resolvedAt} IS NOT NULL AND ${table.durationSeconds} IS NOT NULL)
    )`),
    check(
      'network_connection_events_duration_nonnegative',
      sql`${table.durationSeconds} IS NULL OR ${table.durationSeconds} >= 0`,
    ),
    uniqueIndex('network_connection_events_single_active_incident_unique')
      .on(table.networkDeviceId)
      .where(sql`${table.resolvedAt} IS NULL`),
    index('network_connection_events_device_started_idx').on(table.networkDeviceId, table.startedAt),
    index('network_connection_events_resolved_at_idx').on(table.resolvedAt),
  ],
);
