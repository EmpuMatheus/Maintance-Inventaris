import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

const cwd = process.cwd();
dotenv.config({ path: path.resolve(cwd, '.env') });
dotenv.config({ path: path.resolve(cwd, '../../.env') });

/**
 * Storage root.
 *
 * The desktop launcher always sets `STORAGE_ROOT` (it may point into
 * %LOCALAPPDATA% when installed under Program Files). Otherwise the storage
 * folder is resolved from the working directory, which is `apps/api` for the
 * tsx dev server, `npm run start:prod` and the test runner:
 *   apps/api/../../storage == `<repo>/storage`
 */
const storageRoot = process.env.STORAGE_ROOT
  ? path.resolve(process.env.STORAGE_ROOT)
  : path.resolve(cwd, '../../storage');

/**
 * Coerces an environment string into a boolean. Only `true`, `1`, `yes` and
 * `on` (case-insensitive) count as true, so `HTTPS_ENABLED=false` stays false.
 */
function boolFromEnv(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
}

/**
 * Parses the TRUST_PROXY setting into the format Express expects:
 * `false`/`true` booleans, a hop count number, or a string such as `loopback`.
 */
function parseTrustProxy(value: string): boolean | string | number {
  const v = value.trim();
  if (!v || v === 'false') return false;
  if (v === 'true') return true;
  const n = Number(v);
  if (!Number.isNaN(n)) return n;
  return v;
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_ENV: z.enum(['development', 'production', 'test']).optional(),
  PORT: z.coerce.number().default(3000),
  API_PREFIX: z.string().default('/api/v1'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),
  REQUEST_BODY_LIMIT: z.string().default('2mb'),
  SCHEDULE_PROCESS_INTERVAL_MINUTES: z.coerce.number().default(60),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().default('dev-secret-change-in-production'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  BASE_URL: z.string().default(''),
  TRUST_PROXY: z.string().default('false'),
  HTTPS_ENABLED: z.string().optional(),
  HTTPS_KEY: z.string().default(''),
  HTTPS_CERT: z.string().default(''),
  COOKIE_SECURE: z.string().optional(),
  LOG_DIR: z.string().default('logs'),
  LOG_RETENTION_DAYS: z.coerce.number().default(30),
  BACKUP_DIR: z.string().default('backups'),
  BACKUP_DATABASE_RETENTION_DAYS: z.coerce.number().default(14),
  BACKUP_UPLOADS_RETENTION_DAYS: z.coerce.number().default(14),
  BACKUP_INTERVAL_MINUTES: z.coerce.number().default(0),
  PG_DUMP_PATH: z.string().default(''),
  PROD_ADMIN_USERNAME: z.string().default('admin'),
  PROD_ADMIN_PASSWORD: z.string().default(''),
  PROD_ADMIN_NAME: z.string().default('Production Administrator'),
  APP_VERSION: z.string().default('1.0.0'),
  APP_BUILD_TIME: z.string().default(''),
  SERVE_SPA_DIR: z.string().default(''),
  NETWORK_MONITORING_INTERVAL_MINUTES: z.coerce.number().default(2),
  CCTV_CREDENTIAL_KEY: z.string().default(''),
  CCTV_ONVIF_TIMEOUT_MS: z.coerce.number().default(8000),
  CCTV_ISAPI_TIMEOUT_MS: z.coerce.number().default(8000),
  CCTV_RTSP_TIMEOUT_MS: z.coerce.number().default(8000),
  // How long the FFmpeg-based Test RTSP probe reads/decodes media for.
  CCTV_RTSP_PROBE_DURATION_MS: z.coerce.number().int().min(500).default(2500),
  // Streaming gateway (MediaMTX). The gateway is an internal process; browsers
  // never reach it directly, the API proxies WebRTC (WHEP) and HLS requests.
  CCTV_GATEWAY_ENABLED: z.string().optional(),
  CCTV_GATEWAY_MANAGED: z.string().optional(),
  CCTV_GATEWAY_BINARY: z.string().default(''),
  CCTV_GATEWAY_API_URL: z.string().default('http://127.0.0.1:9997'),
  CCTV_GATEWAY_WEBRTC_URL: z.string().default('http://127.0.0.1:8889'),
  CCTV_GATEWAY_HLS_URL: z.string().default('http://127.0.0.1:8888'),
  CCTV_GATEWAY_RTSP_URL: z.string().default('rtsp://127.0.0.1:8554'),
  CCTV_GATEWAY_MEDIA_UDP_PORT: z.coerce.number().int().min(1).max(65535).default(8189),
  // Ingest mode:
  //  - passthrough: MediaMTX pulls RTSP directly (its built-in client).
  //  - normalize:   the API runs a managed FFmpeg that pulls RTSP and republishes
  //                 a browser-safe H.264 (baseline, no B-frames) to MediaMTX.
  //                 Required for devices whose streams MediaMTX cannot repackage
  //                 (Hikvision H.264 High with B-frames / H.265 main streams).
  CCTV_GATEWAY_INGEST_MODE: z.enum(['passthrough', 'normalize']).default('normalize'),
  CCTV_FFMPEG_BINARY: z.string().default(''),
  CCTV_INGEST_GOP: z.coerce.number().int().min(1).default(30),
  CCTV_INGEST_VIDEO_BITRATE: z.string().default(''),
  // Live-session TTL is a SAFETY net only: an active viewer renews it via the
  // heartbeat endpoint. Kept comfortably above the heartbeat interval so a
  // throttled/backgrounded tab never loses its stream mid-view.
  CCTV_LIVE_SESSION_TTL_SECONDS: z.coerce.number().int().min(15).default(300),
  CCTV_LIVE_SESSION_MAX: z.coerce.number().int().min(1).default(16),
  CCTV_LIVE_READY_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
  ANALYTICS_RECALC_INTERVAL_MINUTES: z.coerce.number().default(1440),
  ANALYTICS_WEIGHT_AGE: z.coerce.number().default(20),
  ANALYTICS_WEIGHT_MAINTENANCE: z.coerce.number().default(20),
  ANALYTICS_WEIGHT_FAILURE_RATIO: z.coerce.number().default(15),
  ANALYTICS_WEIGHT_CONDITION: z.coerce.number().default(20),
  ANALYTICS_WEIGHT_DOWNTIME: z.coerce.number().default(10),
  ANALYTICS_WEIGHT_TICKETS: z.coerce.number().default(10),
  ANALYTICS_WEIGHT_CRITICAL_EVENTS: z.coerce.number().default(5),
  ANALYTICS_EXPECTED_LIFESPAN_YEARS: z.coerce.number().default(7),
  ANALYTICS_FAILURE_THRESHOLD: z.coerce.number().default(3),
  ANALYTICS_TICKET_THRESHOLD: z.coerce.number().default(3),
  ANALYTICS_FAILURE_WINDOW_DAYS: z.coerce.number().default(90),
  ANALYTICS_REPLACE_IMMEDIATE_HEALTH: z.coerce.number().default(35),
  ANALYTICS_REPLACE_SOON_HEALTH: z.coerce.number().default(50),
  ANALYTICS_REPAIR_HEALTH: z.coerce.number().default(65),
  ANALYTICS_REPLACE_COST_RATIO: z.coerce.number().default(0.5),
});

const raw = process.env;
const parsed = envSchema.safeParse(raw);

if (!parsed.success) {
  console.error('Environment validation failed:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;
const appEnv = (data.APP_ENV ?? data.NODE_ENV) as 'development' | 'production' | 'test';
const isProduction = appEnv === 'production';

/**
 * Production fail-fast: reject insecure/dev defaults before the server boots.
 * Development and test keep their convenient defaults.
 */
if (isProduction) {
  const issues: string[] = [];
  if (!raw.JWT_SECRET || raw.JWT_SECRET === 'dev-secret-change-in-production' || raw.JWT_SECRET.length < 32) {
    issues.push('JWT_SECRET (set a random secret of at least 32 characters)');
  }
  if (!raw.CORS_ORIGIN) {
    issues.push('CORS_ORIGIN (must be an explicit allowlist in production)');
  }
  if (issues.length > 0) {
    console.error(`Environment validation failed (production): missing ${issues.join(', ')}.`);
    process.exit(1);
  }
}

const corsOrigins = data.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const httpsEnabled = boolFromEnv(raw.HTTPS_ENABLED);
const cookieSecure = httpsEnabled || boolFromEnv(raw.COOKIE_SECURE);

/**
 * Streaming gateway switches. The gateway is enabled by default (it is the only
 * supported Live View path). `CCTV_GATEWAY_MANAGED` controls whether the API
 * spawns and supervises the process, or expects one to already be running.
 */
const gatewayEnabled = boolFromEnv(raw.CCTV_GATEWAY_ENABLED, true);
const gatewayManaged = boolFromEnv(raw.CCTV_GATEWAY_MANAGED, true);

export const analyticsConfig = {
  recalcIntervalMinutes: data.ANALYTICS_RECALC_INTERVAL_MINUTES,
  weights: {
    age: data.ANALYTICS_WEIGHT_AGE,
    maintenance: data.ANALYTICS_WEIGHT_MAINTENANCE,
    failureRatio: data.ANALYTICS_WEIGHT_FAILURE_RATIO,
    condition: data.ANALYTICS_WEIGHT_CONDITION,
    downtime: data.ANALYTICS_WEIGHT_DOWNTIME,
    tickets: data.ANALYTICS_WEIGHT_TICKETS,
    criticalEvents: data.ANALYTICS_WEIGHT_CRITICAL_EVENTS,
  },
  expectedLifespanYears: data.ANALYTICS_EXPECTED_LIFESPAN_YEARS,
  failureThreshold: data.ANALYTICS_FAILURE_THRESHOLD,
  ticketThreshold: data.ANALYTICS_TICKET_THRESHOLD,
  failureWindowDays: data.ANALYTICS_FAILURE_WINDOW_DAYS,
  replaceImmediateHealth: data.ANALYTICS_REPLACE_IMMEDIATE_HEALTH,
  replaceSoonHealth: data.ANALYTICS_REPLACE_SOON_HEALTH,
  repairHealth: data.ANALYTICS_REPAIR_HEALTH,
  replaceCostRatio: data.ANALYTICS_REPLACE_COST_RATIO,
} as const;

export const streamingGatewayConfig = {
  enabled: gatewayEnabled,
  managed: gatewayManaged,
  binary: data.CCTV_GATEWAY_BINARY,
  apiUrl: data.CCTV_GATEWAY_API_URL,
  webrtcUrl: data.CCTV_GATEWAY_WEBRTC_URL,
  hlsUrl: data.CCTV_GATEWAY_HLS_URL,
  rtspUrl: data.CCTV_GATEWAY_RTSP_URL,
  mediaUdpPort: data.CCTV_GATEWAY_MEDIA_UDP_PORT,
  ingestMode: data.CCTV_GATEWAY_INGEST_MODE,
  ffmpegBinary: data.CCTV_FFMPEG_BINARY,
  ingestGop: data.CCTV_INGEST_GOP,
  ingestVideoBitrate: data.CCTV_INGEST_VIDEO_BITRATE,
  sessionTtlSeconds: data.CCTV_LIVE_SESSION_TTL_SECONDS,
  maxSessions: data.CCTV_LIVE_SESSION_MAX,
  readyTimeoutMs: data.CCTV_LIVE_READY_TIMEOUT_MS,
} as const;

export const env = {
  ...data,
  appEnv,
  isProduction,
  isDevelopment: appEnv === 'development',
  corsOrigins,
  storageRoot,
  httpsEnabled,
  cookieSecure,
  trustProxy: parseTrustProxy(data.TRUST_PROXY),
  logDir: path.resolve(storageRoot, data.LOG_DIR),
  backupDatabaseDir: path.resolve(storageRoot, data.BACKUP_DIR, 'database'),
  backupUploadsDir: path.resolve(storageRoot, data.BACKUP_DIR, 'uploads'),
} as const;
