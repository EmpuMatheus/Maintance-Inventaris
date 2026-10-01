import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './auth';
import { assetSubcategories } from './master-data';

/**
 * CCTV device types. Deliberately generic so a Hikvision DVR, an XMEye
 * recorder or any ONVIF-compliant recorder can be modelled. No brand/model is
 * hard-coded anywhere in the schema.
 */
export const CCTV_DEVICE_TYPES = ['DVR', 'NVR', 'RECORDER'] as const;
export type CctvDeviceType = (typeof CCTV_DEVICE_TYPES)[number];

/** Connection state, owned by the backend (Test Connection / Sync). */
export const CCTV_DEVICE_STATUSES = ['ONLINE', 'OFFLINE', 'UNKNOWN'] as const;
export type CctvDeviceStatus = (typeof CCTV_DEVICE_STATUSES)[number];

/**
 * Channel technical state.
 * - ONLINE / OFFLINE / UNKNOWN: derived from ONVIF stream availability.
 * - MISSING: the channel previously existed on the device but was not returned
 *   by the latest sync. Channels are never deleted by sync; they are marked.
 */
export const CCTV_CHANNEL_STATUSES = ['ONLINE', 'OFFLINE', 'UNKNOWN', 'MISSING'] as const;
export type CctvChannelStatus = (typeof CCTV_CHANNEL_STATUSES)[number];

/** ONVIF media profiles can expose a main and one or more sub streams. */
export const CCTV_STREAM_TYPES = ['MAIN', 'SUB', 'OTHER'] as const;
export type CctvStreamType = (typeof CCTV_STREAM_TYPES)[number];

/**
 * Device integration protocol. Derived by the backend from the device
 * vendor/type — never chosen manually:
 * - Hikvision DVR/NVR/Recorder -> ISAPI
 * - XMEye NVR / other ONVIF recorders -> ONVIF
 */
export const CCTV_INTEGRATION_PROTOCOLS = ['ISAPI', 'ONVIF'] as const;
export type CctvIntegrationProtocol = (typeof CCTV_INTEGRATION_PROTOCOLS)[number];

export const cctvDevices = pgTable(
  'cctv_devices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 150 }).notNull(),
    // LEGACY: historical recorder/camera discriminator. Kept for backward
    // compatibility, but the CCTV behaviour (protocol/discovery) is now driven
    // by `subcategoryId`, never by this column.
    deviceType: varchar('device_type', { length: 50 }).notNull().default('DVR'),
    // Source of truth for CCTV behaviour. Points at a Master Data subcategory
    // whose name is CCTV, DVR or NVR. Nullable for legacy rows created before
    // this column existed; protocol then falls back to brand/model derivation.
    subcategoryId: uuid('subcategory_id').references(() => assetSubcategories.id, {
      onDelete: 'set null',
    }),
    brand: varchar('brand', { length: 150 }),
    model: varchar('model', { length: 150 }),
    // Derived protocol, persisted for display/filtering. Null for legacy rows
    // created before this column existed; resolved on read when null.
    integrationProtocol: varchar('integration_protocol', { length: 20 }),
    ipAddress: varchar('ip_address', { length: 45 }).notNull(),
    // ONVIF/HTTP management port.
    port: integer('port').notNull().default(80),
    // RTSP streaming port. Kept separate from the ONVIF port because a device
    // may expose ONVIF on 80 while streaming on 554 (or any custom port).
    rtspPort: integer('rtsp_port').notNull().default(554),
    username: varchar('username', { length: 150 }),
    // AES-256-GCM ciphertext (see src/lib/crypto/secret-box.ts). Never returned
    // in list/detail responses, never logged, never written to the audit diff.
    passwordEncrypted: text('password_encrypted'),
    location: varchar('location', { length: 255 }),
    description: text('description'),
    status: varchar('status', { length: 50 }).notNull().default('UNKNOWN'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    // Short, sanitized reason for the latest failed connection attempt.
    lastError: varchar('last_error', { length: 500 }),
    // Technical information retrieved from ONVIF GetDeviceInformation.
    manufacturer: varchar('manufacturer', { length: 150 }),
    firmwareVersion: varchar('firmware_version', { length: 150 }),
    serialNumber: varchar('serial_number', { length: 150 }),
    hardwareId: varchar('hardware_id', { length: 150 }),
    onvifServices: jsonb('onvif_services'),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'cctv_devices_device_type_check',
      sql`${table.deviceType} in ('DVR', 'NVR', 'RECORDER')`,
    ),
    check(
      'cctv_devices_status_check',
      sql`${table.status} in ('ONLINE', 'OFFLINE', 'UNKNOWN')`,
    ),
    check(
      'cctv_devices_integration_protocol_check',
      sql`${table.integrationProtocol} IS NULL OR ${table.integrationProtocol} in ('ISAPI', 'ONVIF')`,
    ),
    check('cctv_devices_port_range_check', sql`${table.port} > 0 AND ${table.port} <= 65535`),
    check(
      'cctv_devices_rtsp_port_range_check',
      sql`${table.rtspPort} > 0 AND ${table.rtspPort} <= 65535`,
    ),
    // One active device per address:port pair.
    uniqueIndex('cctv_devices_active_endpoint_unique')
      .on(table.ipAddress, table.port)
      .where(sql`${table.isActive} = true`),
    index('cctv_devices_status_idx').on(table.status),
    index('cctv_devices_is_active_idx').on(table.isActive),
    index('cctv_devices_subcategory_id_idx').on(table.subcategoryId),
  ],
);

export const cctvChannels = pgTable(
  'cctv_channels',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => cctvDevices.id, { onDelete: 'cascade' }),
    channelNumber: integer('channel_number').notNull(),
    // ONVIF VideoSource token used as the sync identity for a channel. Null
    // when the device does not expose video source tokens.
    deviceChannelId: varchar('device_channel_id', { length: 255 }),
    // Technical name reported by the device (may be null — never fabricated).
    technicalName: varchar('technical_name', { length: 255 }),
    // Operational (BBP-owned) fields. Never overwritten by sync.
    name: varchar('name', { length: 150 }).notNull().default('Belum diatur'),
    location: varchar('location', { length: 255 }),
    description: text('description'),
    displayOrder: integer('display_order').notNull().default(0),
    // Technical fields sourced from the device.
    cameraIp: varchar('camera_ip', { length: 45 }),
    status: varchar('status', { length: 50 }).notNull().default('UNKNOWN'),
    isActive: boolean('is_active').default(true).notNull(),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'cctv_channels_status_check',
      sql`${table.status} in ('ONLINE', 'OFFLINE', 'UNKNOWN', 'MISSING')`,
    ),
    check('cctv_channels_channel_number_positive', sql`${table.channelNumber} > 0`),
    check('cctv_channels_display_order_nonnegative', sql`${table.displayOrder} >= 0`),
    uniqueIndex('cctv_channels_device_channel_unique').on(table.deviceId, table.channelNumber),
    index('cctv_channels_device_id_idx').on(table.deviceId),
    index('cctv_channels_status_idx').on(table.status),
  ],
);

/**
 * Live View session. The streaming gateway (MediaMTX) is stateless per session:
 * a session maps a CCTV channel + stream kind to a gateway path. Only the
 * backend holds the credential-bearing RTSP source; the browser receives a
 * credential-free, same-origin playback endpoint.
 */
export const CCTV_LIVE_STREAM_KINDS = ['MAIN', 'SUB'] as const;
export type CctvLiveStreamKind = (typeof CCTV_LIVE_STREAM_KINDS)[number];

export const CCTV_LIVE_SESSION_STATUSES = ['ACTIVE', 'STOPPED'] as const;
export type CctvLiveSessionStatus = (typeof CCTV_LIVE_SESSION_STATUSES)[number];

export const cctvLiveSessions = pgTable(
  'cctv_live_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => cctvDevices.id, { onDelete: 'cascade' }),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => cctvChannels.id, { onDelete: 'cascade' }),
    // Gateway path name (opaque, random). Never derived from a credential.
    gatewayPath: varchar('gateway_path', { length: 120 }).notNull(),
    streamKind: varchar('stream_kind', { length: 10 }).notNull().default('MAIN'),
    status: varchar('status', { length: 20 }).notNull().default('ACTIVE'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // Refreshed while a viewer keeps the session alive; the reaper closes
    // sessions whose TTL has elapsed.
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    stoppedAt: timestamp('stopped_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'cctv_live_sessions_stream_kind_check',
      sql`${table.streamKind} in ('MAIN', 'SUB')`,
    ),
    check(
      'cctv_live_sessions_status_check',
      sql`${table.status} in ('ACTIVE', 'STOPPED')`,
    ),
    uniqueIndex('cctv_live_sessions_gateway_path_unique').on(table.gatewayPath),
    index('cctv_live_sessions_device_id_idx').on(table.deviceId),
    index('cctv_live_sessions_status_idx').on(table.status),
    index('cctv_live_sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const cctvStreamProfiles = pgTable(
  'cctv_stream_profiles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    channelId: uuid('channel_id')
      .notNull()
      .references(() => cctvChannels.id, { onDelete: 'cascade' }),
    profileToken: varchar('profile_token', { length: 255 }).notNull(),
    profileName: varchar('profile_name', { length: 255 }),
    streamType: varchar('stream_type', { length: 50 }).notNull().default('MAIN'),
    // ONVIF GetStreamUri result, stored WITHOUT embedded credentials.
    streamUri: text('stream_uri'),
    videoCodec: varchar('video_codec', { length: 50 }),
    resolution: varchar('resolution', { length: 50 }),
    fps: integer('fps'),
    isMainStream: boolean('is_main_stream').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check(
      'cctv_stream_profiles_stream_type_check',
      sql`${table.streamType} in ('MAIN', 'SUB', 'OTHER')`,
    ),
    check(
      'cctv_stream_profiles_fps_nonnegative',
      sql`${table.fps} IS NULL OR ${table.fps} >= 0`,
    ),
    uniqueIndex('cctv_stream_profiles_channel_profile_unique').on(
      table.channelId,
      table.profileToken,
    ),
    index('cctv_stream_profiles_channel_id_idx').on(table.channelId),
  ],
);
