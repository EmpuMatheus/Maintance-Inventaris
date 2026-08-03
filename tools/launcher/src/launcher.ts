/**
 * Office Inventory desktop launcher.
 *
 * Bundled by esbuild into a single CommonJS file and injected into a Node SEA
 * executable (Office Inventory.exe). Uses only Node built-ins so the bundle is
 * self-contained.
 *
 * Responsibilities:
 *  - single instance (lock file + health-based detection)
 *  - read/validate config.json
 *  - start the production backend, wait for /health, open the browser
 *  - monitor the backend and restart it if it crashes
 *  - graceful shutdown + daily rotating launcher logs
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  type WriteStream,
} from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

type SeaModule = { isSea?: () => boolean };

let isSea = false;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- node:sea is only reachable via require()
  const sea = require('node:sea') as SeaModule;
  isSea = sea.isSea?.() ?? false;
} catch {
  isSea = false;
}

const APP_DIR = isSea ? path.dirname(process.execPath) : path.resolve(process.cwd());

/**
 * Writable data directory. When installed under Program Files the app dir may
 * not be writable by a standard user, so config/logs/storage move to
 * %LOCALAPPDATA%\Office Inventory. Otherwise the portable layout (app dir) is
 * used.
 */
function resolveDataDir(): string {
  const pf = (process.env.ProgramFiles || 'C:\\Program Files').toLowerCase();
  const pf86 = (process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)').toLowerCase();
  const appDir = APP_DIR.toLowerCase();
  if (appDir.startsWith(pf) || appDir.startsWith(pf86)) {
    return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Office Inventory');
  }
  return APP_DIR;
}

const DATA_DIR = resolveDataDir();
const CONFIG_PATH = path.join(DATA_DIR, 'config.json');
const LOCK_PATH = path.join(DATA_DIR, '.office-inventory.lock');
const LOG_DIR = path.join(DATA_DIR, 'logs');
const STORAGE_DIR = path.join(DATA_DIR, 'storage');
const BACKEND_ENTRY = path.join(APP_DIR, 'apps', 'api', 'dist', 'server.cjs');
const SPA_DIR = path.join(APP_DIR, 'apps', 'web', 'dist');
const URL_ROOT = (port: number) => `http://localhost:${port}`;

interface BackupConfig {
  enabled: boolean;
  intervalMinutes: number;
  retentionDays: number;
}

interface SapConfig {
  enabled: boolean;
  url: string;
  username: string;
  password: string;
}

interface LauncherConfig {
  port: number;
  autoStart: boolean;
  browser: string;
  logLevel: string;
  nodePath: string;
  jwtSecret?: string;
  database: { url: string };
  sap: SapConfig;
  backup: BackupConfig;
}

const DEFAULT_CONFIG: LauncherConfig = {
  port: 3000,
  autoStart: true,
  browser: 'default',
  logLevel: 'info',
  nodePath: '',
  database: { url: '' },
  sap: { enabled: false, url: '', username: '', password: '' },
  backup: { enabled: false, intervalMinutes: 1440, retentionDays: 14 },
};

function deepMerge<T>(base: T, override: Partial<T> | undefined): T {
  const out: Record<string, unknown> = Array.isArray(base)
    ? [...(base as unknown[])]
    : { ...(base as Record<string, unknown>) };
  if (override && typeof override === 'object') {
    const baseRecord = base as Record<string, unknown>;
    const overrideRecord = override as Record<string, unknown>;
    for (const key of Object.keys(overrideRecord)) {
      const baseValue = baseRecord[key];
      const overrideValue = overrideRecord[key];
      if (
        baseValue &&
        overrideValue &&
        typeof baseValue === 'object' &&
        typeof overrideValue === 'object' &&
        !Array.isArray(baseValue)
      ) {
        out[key] = deepMerge(baseValue, overrideValue);
      } else if (overrideValue !== undefined) {
        out[key] = overrideValue;
      }
    }
  }
  return out as T;
}

function dateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

class RotatingLog {
  private stream: WriteStream | null = null;
  private currentDate = '';

  constructor(
    private readonly dir: string,
    private readonly prefix: string,
    private readonly retentionDays = 30,
  ) {
    mkdirSync(dir, { recursive: true });
    this.ensureStream();
    this.prune();
  }

  private ensureStream(): void {
    const today = dateKey();
    if (!this.stream || today !== this.currentDate) {
      if (this.stream) this.stream.end();
      this.currentDate = today;
      this.stream = createWriteStream(path.join(this.dir, `${this.prefix}-${today}.log`), { flags: 'a' });
    }
  }

  private prune(): void {
    try {
      const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
      for (const file of readdirSync(this.dir)) {
        const match = /^(?:launcher|launcher-backend)-(\d{4}-\d{2}-\d{2})\.log$/.exec(file);
        if (match && new Date(`${match[1]}T00:00:00Z`).getTime() < cutoff) {
          rmSync(path.join(this.dir, file), { force: true });
        }
      }
    } catch {
      // best-effort pruning
    }
  }

  private write(level: string, message: string): void {
    const line = `[${new Date().toISOString()}] ${level.toUpperCase()} ${message}\n`;
    this.ensureStream();
    this.stream?.write(line);
    console.log(message);
  }

  info(message: string): void {
    this.write('info', message);
  }

  warn(message: string): void {
    this.write('warn', message);
  }

  error(message: string): void {
    this.write('error', message);
  }
}

function die(log: RotatingLog, message: string): never {
  log.error(`ERROR: ${message}`);
  console.error(message);
  process.exit(1);
}

function loadConfig(log: RotatingLog): LauncherConfig {
  const templatePath = path.join(APP_DIR, 'config.template.json');
  let base: LauncherConfig = DEFAULT_CONFIG;
  if (existsSync(templatePath)) {
    try {
      base = deepMerge(DEFAULT_CONFIG, JSON.parse(readFileSync(templatePath, 'utf8')) as Partial<LauncherConfig>);
    } catch {
      // ignore malformed template
    }
  }

  let userConfig: Partial<LauncherConfig> | undefined;
  if (existsSync(CONFIG_PATH)) {
    try {
      userConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Partial<LauncherConfig>;
    } catch (error) {
      die(log, `config.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const merged = deepMerge(base, userConfig);

  if (!Number.isInteger(merged.port) || merged.port < 1 || merged.port > 65535) {
    die(log, 'config.json "port" must be an integer between 1 and 65535.');
  }
  if (!merged.database?.url || !String(merged.database.url).startsWith('postgres')) {
    die(log, 'config.json "database.url" is required (postgresql://user:pass@host:5432/db).');
  }
  if (!merged.jwtSecret) {
    merged.jwtSecret = randomBytes(32).toString('hex');
  }

  try {
    writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
  } catch (error) {
    die(log, `Cannot write config.json: ${error instanceof Error ? error.message : String(error)}`);
  }
  return merged;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(log: RotatingLog): boolean {
  if (existsSync(LOCK_PATH)) {
    try {
      const info = JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as { pid?: number };
      if (info.pid && isPidAlive(info.pid)) {
        return false;
      }
    } catch {
      // stale/corrupt lock — overwrite
    }
  }
  writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  log.info('Single-instance lock acquired.');
  return true;
}

function releaseLock(): void {
  try {
    rmSync(LOCK_PATH, { force: true });
  } catch {
    // ignore
  }
}

function fetchHealth(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/v1/health', timeout: 2500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function fetchReady(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/v1/health/ready', timeout: 2500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForHealth(port: number, timeoutMs: number, log: RotatingLog): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let announced = false;
  while (Date.now() < deadline) {
    if (await fetchHealth(port)) return true;
    if (!announced) {
      log.info('Waiting for backend to become ready...');
      announced = true;
    }
    await sleep(600);
  }
  return false;
}

function openBrowser(port: number, browser: string): void {
  const url = URL_ROOT(port);
  const windir = process.env.windir || 'C:\\Windows';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const cmd = path.join(windir, 'System32', 'cmd.exe');

  if (!browser || browser === 'default') {
    spawn(cmd, ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
    return;
  }
  if (browser === 'chrome') {
    spawn(path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'), [url], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return;
  }
  if (browser === 'edge') {
    spawn(path.join(programFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'), [url], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return;
  }
  // custom executable path
  spawn(browser, [url], { detached: true, stdio: 'ignore' }).unref();
}

let child: ChildProcess | null = null;
let stopping = false;
let restartAttempts = 0;
let log: RotatingLog | null = null;

function backendEnv(config: LauncherConfig): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'production',
    APP_ENV: 'production',
    PORT: String(config.port),
    DATABASE_URL: config.database.url,
    CORS_ORIGIN: URL_ROOT(config.port),
    LOG_LEVEL: config.logLevel,
    JWT_SECRET: config.jwtSecret as string,
    SERVE_SPA_DIR: SPA_DIR,
    STORAGE_ROOT: STORAGE_DIR,
    PARENT_PID: String(process.pid),
    BACKUP_INTERVAL_MINUTES: config.backup.enabled ? String(config.backup.intervalMinutes) : '0',
    BACKUP_DATABASE_RETENTION_DAYS: String(config.backup.retentionDays),
    BACKUP_UPLOADS_RETENTION_DAYS: String(config.backup.retentionDays),
    SAP_ENABLED: config.sap.enabled ? 'true' : 'false',
    SAP_URL: config.sap.url,
    SAP_USERNAME: config.sap.username,
    SAP_PASSWORD: config.sap.password,
  };
}

function startBackend(config: LauncherConfig, logger: RotatingLog): void {
  const nodeBinary = config.nodePath || 'node';
  logger.info(`Starting backend: ${nodeBinary} ${BACKEND_ENTRY}`);
  const proc = spawn(nodeBinary, [BACKEND_ENTRY], {
    cwd: APP_DIR,
    env: backendEnv(config),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout?.on('data', (data: Buffer) => {
    const line = String(data).trimEnd();
    if (line) logger.info(`[backend] ${line}`);
  });
  proc.stderr?.on('data', (data: Buffer) => {
    const line = String(data).trimEnd();
    if (line) logger.error(`[backend] ${line}`);
  });
  proc.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      logger.error(
        `Node.js was not found. Install Node.js 20+ or set the full path in config.json "nodePath". (${nodeBinary})`,
      );
    } else {
      logger.error(`Failed to start backend: ${error.message}`);
    }
    stopping = true;
    releaseLock();
    process.exit(1);
  });
  proc.on('exit', (code, signal) => {
    child = null;
    if (stopping) return;
    const reason = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
    logger.error(`Backend exited (${reason}). Restarting...`);
    scheduleRestart(config);
  });

  child = proc;
}

function scheduleRestart(config: LauncherConfig): void {
  if (stopping || !log) return;
  const delay = Math.min(15000, 1000 * 2 ** Math.min(restartAttempts, 4));
  restartAttempts += 1;
  log.warn(`Restarting backend in ${Math.round(delay / 1000)}s (attempt ${restartAttempts})...`);
  setTimeout(() => {
    if (stopping) return;
    log.info('Starting backend...');
    startBackend(config, log as RotatingLog);
  }, delay);
}

async function main(): Promise<void> {
  const logger = new RotatingLog(LOG_DIR, 'launcher', 30);
  log = logger;

  logger.info('============================================');
  logger.info('Office Inventory - Desktop Launcher');
  logger.info(`App directory: ${APP_DIR}`);
  logger.info(`Data directory: ${DATA_DIR}`);
  logger.info('============================================');

  const config = loadConfig(logger);
  logger.info(`Configured port: ${config.port}`);

  if (await fetchHealth(config.port)) {
    logger.info('Office Inventory is already running. Opening the browser...');
    if (config.autoStart) openBrowser(config.port, config.browser);
    return;
  }
  if (!acquireLock(logger)) {
    logger.warn('Another launcher instance is running. Opening the browser...');
    if (config.autoStart) openBrowser(config.port, config.browser);
    return;
  }

  if (!existsSync(BACKEND_ENTRY)) {
    releaseLock();
    die(logger, `Backend bundle not found: ${BACKEND_ENTRY}. Run "npm run build:launcher" first.`);
  }
  if (!existsSync(path.join(SPA_DIR, 'index.html'))) {
    logger.warn('Web build not found — the API will start but the UI may be unavailable. Run "npm run build:launcher".');
  }

  logger.info('Starting backend...');
  startBackend(config, logger);

  const healthy = await waitForHealth(config.port, 60_000, logger);
  if (!healthy) {
    logger.error(
      'Backend did not become healthy in time. Verify the database in config.json and review the logs directory.',
    );
    return;
  }
  logger.info(`Backend is ready at ${URL_ROOT(config.port)}`);
  restartAttempts = 0;

  const ready = await fetchReady(config.port);
  if (!ready) {
    logger.warn('Database is not reachable — check "database.url" in config.json.');
  }

  if (config.autoStart) {
    openBrowser(config.port, config.browser);
    logger.info(`Opening browser at ${URL_ROOT(config.port)}`);
  }

  logger.info('Running. Close this window or press Ctrl+C to stop.');
}

function shutdown(signal: string): void {
  stopping = true;
  log?.info(`Received ${signal}. Shutting down...`);
  if (child) {
    child.kill('SIGTERM');
    setTimeout(() => {
      if (child) child.kill('SIGKILL');
    }, 5000).unref();
  }
  setTimeout(() => {
    releaseLock();
    process.exit(0);
  }, 400).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('exit', () => {
  if (!stopping) releaseLock();
});

void main();
