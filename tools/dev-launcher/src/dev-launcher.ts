/**
 * Office Inventory Developer Launcher (OfficeInventoryDev.exe).
 *
 * For developers only. Bundled by esbuild into a single CommonJS file and
 * injected into a Node SEA executable. Uses only Node built-ins.
 *
 * Responsibilities:
 *  - detect Node.js / npm / PostgreSQL and validate .env
 *  - install dependencies automatically when node_modules is missing
 *  - start the backend (`npm run dev:api`) and wait for /health
 *  - start the frontend (`npm run dev:web`) and wait for the Vite server
 *  - open the browser to the Vite URL and a built-in control panel
 *  - control panel: live status, streaming logs, restart backend/frontend, stop all
 *  - single instance + rotating daily logs under logs/
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
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
import net from 'node:net';
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

const IS_WINDOWS = process.platform === 'win32';
const npm = IS_WINDOWS ? 'npm.cmd' : 'npm';

function findRepoRoot(): string {
  if (!isSea) return process.cwd();
  let dir = path.dirname(process.execPath);
  for (let i = 0; i < 6; i += 1) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { workspaces?: unknown };
        if (pkg.workspaces) return dir;
      } catch {
        // ignore malformed package.json
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.dirname(process.execPath);
}

const REPO = findRepoRoot();
const LOCK_PATH = path.join(REPO, '.dev-launcher.lock');
const LOG_DIR = path.join(REPO, 'logs');
const CONFIG_PATH = path.join(REPO, 'dev.config.json');
const ENV_PATH = path.join(REPO, '.env');

interface DevConfig {
  controlPort: number;
  apiPort: number;
  webPort: number;
  autoOpenBrowser: boolean;
  installTimeoutMs: number;
}

const DEFAULT_CONFIG: DevConfig = {
  controlPort: 3900,
  apiPort: 3000,
  webPort: 5173,
  autoOpenBrowser: true,
  installTimeoutMs: 15 * 60 * 1000,
};

function loadDevConfig(): DevConfig {
  let user: Partial<DevConfig> | undefined;
  if (existsSync(CONFIG_PATH)) {
    try {
      user = JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) as Partial<DevConfig>;
    } catch {
      // ignore malformed config
    }
  }
  const merged: DevConfig = { ...DEFAULT_CONFIG, ...user };
  merged.controlPort = Number(merged.controlPort) || DEFAULT_CONFIG.controlPort;
  merged.apiPort = Number(merged.apiPort) || DEFAULT_CONFIG.apiPort;
  merged.webPort = Number(merged.webPort) || DEFAULT_CONFIG.webPort;
  return merged;
}

const config = loadDevConfig();
const API_PORT = config.apiPort;
const WEB_PORT = config.webPort;
const CONTROL_PORT = config.controlPort;
const HEALTH_URL = `http://127.0.0.1:${API_PORT}/api/v1/health`;
const VITE_URL = `http://localhost:${WEB_PORT}`;
const CONTROL_URL = `http://localhost:${CONTROL_PORT}`;

// ---------------- rotating log + live broadcast ----------------

type SseClient = { res: http.ServerResponse };
const sseClients = new Set<SseClient>();
let logStream: WriteStream | null = null;
let logDate = '';

function dateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function ensureLogStream(): void {
  mkdirSync(LOG_DIR, { recursive: true });
  const today = dateKey();
  if (!logStream || today !== logDate) {
    if (logStream) logStream.end();
    logDate = today;
    logStream = createWriteStream(path.join(LOG_DIR, `dev-launcher-${today}.log`), { flags: 'a' });
    pruneLogs();
  }
}

function pruneLogs(): void {
  try {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const file of readdirSync(LOG_DIR)) {
      const match = /^dev-launcher-(\d{4}-\d{2}-\d{2})\.log$/.exec(file);
      if (match && new Date(`${match[1]}T00:00:00Z`).getTime() < cutoff) {
        rmSync(path.join(LOG_DIR, file), { force: true });
      }
    }
  } catch {
    // best effort
  }
}

interface LogEntry {
  at: string;
  level: string;
  source: string;
  message: string;
}

function emit(entry: LogEntry): void {
  const line = `[${entry.at}] ${entry.level.toUpperCase()} ${entry.source ? `[${entry.source}] ` : ''}${entry.message}`;
  ensureLogStream();
  logStream?.write(`${line}\n`);
  console.log(line);
  const payload = `data: ${JSON.stringify(entry)}\n\n`;
  for (const client of sseClients) {
    client.res.write(payload);
  }
}

const info = (source: string, message: string) => emit({ at: new Date().toISOString(), level: 'info', source, message });
const warn = (source: string, message: string) => emit({ at: new Date().toISOString(), level: 'warn', source, message });
const error = (source: string, message: string) => emit({ at: new Date().toISOString(), level: 'error', source, message });

// ---------------- environment detection ----------------

async function detectNode(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('node', ['--version']);
    proc.stdout?.once('data', (d) => {
      info('node', `Node.js ${String(d).trim()}`);
      resolve(true);
    });
    proc.on('error', () => {
      error('node', 'Node.js was not found on PATH.');
      resolve(false);
    });
  });
}

async function detectNpm(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn(npm, ['--version'], { shell: IS_WINDOWS });
    proc.stdout?.once('data', (d) => {
      info('npm', `npm ${String(d).trim()}`);
      resolve(true);
    });
    proc.on('error', () => {
      error('npm', 'npm was not found on PATH.');
      resolve(false);
    });
  });
}

function parseEnvFile(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(ENV_PATH)) return out;
  for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line.trim());
    if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function detectPostgres(): Promise<'ok' | 'down'> {
  const envFile = parseEnvFile();
  const raw = envFile.DATABASE_URL || process.env.DATABASE_URL || '';
  if (!raw) return 'down';
  try {
    const url = new URL(raw);
    const host = url.hostname || 'localhost';
    const port = Number(url.port) || 5432;
    const ok = await new Promise<boolean>((resolve) => {
      const socket = net.connect({ host, port, timeout: 2000 });
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
      socket.once('timeout', () => { socket.destroy(); resolve(false); });
    });
    info('postgres', ok ? `PostgreSQL reachable at ${host}:${port}` : `PostgreSQL NOT reachable at ${host}:${port}`);
    return ok ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

function validateEnv(): string[] {
  const problems: string[] = [];
  if (!existsSync(ENV_PATH)) {
    problems.push('No .env file found — copy .env.example to .env and configure it.');
  } else {
    const envFile = parseEnvFile();
    if (!envFile.DATABASE_URL) problems.push('.env is missing DATABASE_URL.');
  }
  for (const problem of problems) warn('env', problem);
  if (problems.length === 0) info('env', '.env validated.');
  return problems;
}

async function ensureDependencies(): Promise<boolean> {
  const nodeModules = path.join(REPO, 'node_modules');
  if (existsSync(nodeModules)) {
    info('deps', 'node_modules found — skipping install.');
    return true;
  }
  info('deps', 'node_modules missing — installing dependencies (this can take a while)...');
  return new Promise((resolve) => {
    const proc = spawn(npm, ['install'], { cwd: REPO, shell: IS_WINDOWS, stdio: ['ignore', 'pipe', 'pipe'] });
    proc.stdout?.on('data', (d: Buffer) => info('install', String(d).trimEnd()));
    proc.stderr?.on('data', (d: Buffer) => warn('install', String(d).trimEnd()));
    proc.on('error', (e) => { error('deps', `npm install failed to start: ${e.message}`); resolve(false); });
    proc.on('exit', (code) => {
      if (code === 0) {
        info('deps', 'npm install completed.');
        resolve(true);
      } else {
        error('deps', `npm install exited with code ${code ?? 'unknown'}.`);
        resolve(false);
      }
    });
  });
}

// ---------------- child process management ----------------

type ProcState = 'stopped' | 'starting' | 'running' | 'error';
interface ManagedProcess {
  proc: ChildProcess | null;
  state: ProcState;
  pid: number | null;
  owned: boolean;
}
const backend: ManagedProcess = { proc: null, state: 'stopped', pid: null, owned: false };
const frontend: ManagedProcess = { proc: null, state: 'stopped', pid: null, owned: false };
let stopping = false;
let postgresState: 'ok' | 'down' = 'down';
let envProblems: string[] = [];

function killTree(pid: number): void {
  if (IS_WINDOWS) {
    try {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    } catch {
      // ignore
    }
  } else {
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      // ignore
    }
  }
}

function startCommand(
  spec: { name: string; cmd: string; args: string[] },
  setState: (state: ProcState) => void,
  getCurrent: () => ChildProcess | null,
): ChildProcess {
  info(spec.name, `Starting: ${spec.cmd} ${spec.args.join(' ')}`);
  setState('starting');
  const proc = spawn(spec.cmd, spec.args, {
    cwd: REPO,
    shell: IS_WINDOWS,
    detached: !IS_WINDOWS,
    env: { ...process.env, PORT: String(API_PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.stdout?.on('data', (d: Buffer) => info(spec.name, String(d).trimEnd()));
  proc.stderr?.on('data', (d: Buffer) => error(spec.name, String(d).trimEnd()));
  proc.on('error', (e) => {
    if (getCurrent() !== proc) return; // a newer process has replaced this one
    error(spec.name, `Failed to start: ${e.message}`);
    setState('error');
  });
  proc.on('exit', (code, signal) => {
    if (stopping || getCurrent() !== proc) return; // stale exit event from a replaced process
    warn(spec.name, `Exited (${signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`}).`);
    setState('stopped');
  });
  return proc;
}

function startBackend(): void {
  if (backend.proc) return;
  backend.owned = true;
  backend.proc = startCommand({ name: 'backend', cmd: npm, args: ['run', 'dev:api'] }, (s) => { backend.state = s; }, () => backend.proc);
}

function stopBackend(): void {
  if (backend.proc?.pid) killTree(backend.proc.pid);
  backend.proc = null;
  backend.pid = null;
  backend.owned = false;
  if (!stopping) backend.state = 'stopped';
}

function restartBackend(): void {
  if (!backend.owned) {
    warn('backend', 'Backend is not managed by this launcher (started externally) — cannot restart it.');
    return;
  }
  info('backend', 'Restarting backend...');
  stopBackend();
  startBackend();
}

function startFrontend(): void {
  if (frontend.proc) return;
  frontend.owned = true;
  frontend.proc = startCommand({ name: 'frontend', cmd: npm, args: ['run', 'dev:web'] }, (s) => { frontend.state = s; }, () => frontend.proc);
}

function stopFrontend(): void {
  if (frontend.proc?.pid) killTree(frontend.proc.pid);
  frontend.proc = null;
  frontend.pid = null;
  frontend.owned = false;
  if (!stopping) frontend.state = 'stopped';
}

function restartFrontend(): void {
  if (!frontend.owned) {
    warn('frontend', 'Frontend is not managed by this launcher (started externally) — cannot restart it.');
    return;
  }
  info('frontend', 'Restarting frontend...');
  stopFrontend();
  startFrontend();
}

function stopAll(): void {
  stopping = true;
  info('system', 'Stopping all processes...');
  stopBackend();
  stopFrontend();
  releaseLock();
  info('system', 'Stopped.');
  process.exit(0);
}

// ---------------- health checks ----------------

function fetch(url: string, timeoutMs = 2000): Promise<number> {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const req = http.get(
      { host: parsed.hostname, port: parsed.port, path: parsed.pathname, timeout: timeoutMs },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on('error', () => resolve(0));
    req.on('timeout', () => {
      req.destroy();
      resolve(0);
    });
  });
}

/** True when the TCP port accepts connections (protocol-agnostic readiness). */
function tcpAlive(port: number, timeoutMs = 2000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port, timeout: timeoutMs });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForHealth(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await fetch(HEALTH_URL)) === 200) return true;
    await sleep(700);
  }
  return false;
}

async function waitForWeb(timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await tcpAlive(WEB_PORT)) return true;
    await sleep(700);
  }
  return false;
}

// ---------------- browser ----------------

function openBrowser(url: string): void {
  if (IS_WINDOWS) {
    const cmd = path.join(process.env.windir || 'C:\\Windows', 'System32', 'cmd.exe');
    spawn(cmd, ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
}

// ---------------- single instance ----------------

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireLock(): boolean {
  if (existsSync(LOCK_PATH)) {
    try {
      const info = JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as { pid?: number };
      if (info.pid && isPidAlive(info.pid)) return false;
    } catch {
      // stale lock
    }
  }
  writeFileSync(LOCK_PATH, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return true;
}

function releaseLock(): void {
  try {
    rmSync(LOCK_PATH, { force: true });
  } catch {
    // ignore
  }
}

// ---------------- status ----------------

async function currentStatus() {
  const backendHealth = (await fetch(HEALTH_URL, 1500)) === 200;
  const webUp = await tcpAlive(WEB_PORT, 1500);
  if (backend.proc && backend.state === 'starting' && backendHealth) backend.state = 'running';
  if (frontend.proc && frontend.state === 'starting' && webUp) frontend.state = 'running';
  return {
    repo: REPO,
    nodeVersion: process.version,
    apiPort: API_PORT,
    webPort: WEB_PORT,
    postgres: postgresState,
    envValid: envProblems.length === 0,
    backend: {
      state: backend.state,
      pid: backend.proc?.pid ?? null,
      owned: backend.owned,
      health: backendHealth,
    },
    frontend: {
      state: frontend.state,
      pid: frontend.proc?.pid ?? null,
      owned: frontend.owned,
      httpOk: webUp,
    },
    viteUrl: VITE_URL,
    controlUrl: CONTROL_URL,
  };
}

// ---------------- control panel ----------------

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Office Inventory - Developer Launcher</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: system-ui, Segoe UI, sans-serif; background: #0f172a; color: #e2e8f0; }
  header { padding: 16px 24px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  header h1 { font-size: 16px; margin: 0; }
  .badge { padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .badge.ok { background: #14532d; color: #86efac; }
  .badge.bad { background: #7f1d1d; color: #fecaca; }
  .badge.idle { background: #334155; color: #94a3b8; }
  main { display: grid; grid-template-columns: 1fr; gap: 16px; padding: 16px 24px; }
  @media (min-width: 900px) { main { grid-template-columns: 320px 1fr; } }
  .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 16px; }
  .card h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .04em; color: #94a3b8; margin: 0 0 12px; }
  .proc { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #334155; }
  .proc:last-child { border-bottom: 0; }
  .row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  button { background: #3b82f6; color: #fff; border: 0; padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; }
  button:hover { background: #2563eb; }
  button.danger { background: #dc2626; }
  button.danger:hover { background: #b91c1c; }
  button.ghost { background: #334155; }
  button.ghost:hover { background: #475569; }
  a.link { color: #60a5fa; }
  #logs { height: 420px; overflow-y: auto; background: #0b1220; border: 1px solid #334155; border-radius: 8px; padding: 10px; font: 12px/1.5 Consolas, monospace; white-space: pre-wrap; }
  #logs .info { color: #94a3b8; }
  #logs .warn { color: #fbbf24; }
  #logs .error { color: #f87171; }
  .muted { color: #64748b; font-size: 12px; }
</style>
</head>
<body>
<header>
  <h1>Office Inventory — Developer Launcher</h1>
  <span class="badge idle" id="nodeBadge">Node …</span>
  <span class="badge idle" id="pgBadge">PostgreSQL …</span>
  <span class="badge idle" id="envBadge">.env …</span>
</header>
<main>
  <div>
    <div class="card">
      <h2>Services</h2>
      <div class="proc"><span>Backend (API)</span><span><span class="badge idle" id="backendBadge">…</span></span></div>
      <div class="proc"><span>Frontend (Vite)</span><span><span class="badge idle" id="frontendBadge">…</span></span></div>
      <div class="muted" id="pids"></div>
      <div class="row">
        <button onclick="action('restart-backend')">Restart Backend</button>
        <button class="ghost" onclick="action('restart-frontend')">Restart Frontend</button>
        <button class="danger" onclick="action('stop')">Stop All</button>
      </div>
      <div class="row">
        <a class="link" href="${VITE_URL}" target="_blank" rel="noopener">Open Application ↗</a>
      </div>
    </div>
    <div class="card" style="margin-top:16px">
      <h2>Details</h2>
      <div class="muted" id="repoLine"></div>
      <div class="muted">API health: <span id="healthLine">…</span></div>
      <div class="muted">Vite HTTP: <span id="webLine">…</span></div>
    </div>
  </div>
  <div class="card">
    <h2>Logs (live)</h2>
    <div id="logs"></div>
  </div>
</main>
<script>
  const $ = (id) => document.getElementById(id);
  const logsEl = $('logs');
  function setBadge(id, text, cls) { const el = $(id); el.textContent = text; el.className = 'badge ' + cls; }
  async function action(name) { try { await fetch('/api/action/' + name, { method: 'POST' }); } catch {} }
  async function refresh() {
    try {
      const r = await fetch('/api/status');
      const s = await r.json();
      setBadge('nodeBadge', 'Node ' + s.nodeVersion, 'ok');
      setBadge('pgBadge', s.postgres === 'ok' ? 'PostgreSQL OK' : 'PostgreSQL DOWN', s.postgres === 'ok' ? 'ok' : 'bad');
      setBadge('envBadge', s.envValid ? '.env OK' : '.env issues', s.envValid ? 'ok' : 'bad');
      const b = s.backend;
      setBadge('backendBadge', b.state.toUpperCase() + (b.health ? ' ✓' : ''), b.health ? 'ok' : (b.state === 'running' || b.state === 'starting' ? 'idle' : 'bad'));
      const f = s.frontend;
      setBadge('frontendBadge', f.state.toUpperCase() + (f.httpOk ? ' ✓' : ''), f.httpOk ? 'ok' : (f.state === 'running' || f.state === 'starting' ? 'idle' : 'bad'));
      $('pids').textContent = 'backend pid: ' + (b.pid ?? '-') + (b.owned ? '' : ' (external)') + ' · frontend pid: ' + (f.pid ?? '-') + (f.owned ? '' : ' (external)');
      $('repoLine').textContent = s.repo;
      $('healthLine').textContent = b.health ? '200 OK' : 'unreachable';
      $('webLine').textContent = f.httpOk ? '200 OK' : 'unreachable';
    } catch {}
  }
  function appendLog(entry) {
    const div = document.createElement('div');
    div.className = entry.level;
    const t = new Date(entry.at).toLocaleTimeString();
    div.textContent = '[' + t + '] ' + (entry.source ? '[' + entry.source + '] ' : '') + entry.message;
    logsEl.appendChild(div);
    logsEl.scrollTop = logsEl.scrollHeight;
  }
  const es = new EventSource('/events');
  es.onmessage = (e) => { try { appendLog(JSON.parse(e.data)); } catch {} };
  refresh();
  setInterval(refresh, 2000);
</script>
</body>
</html>`;

function startControlServer(): Promise<boolean> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url || '/';
      if (req.method === 'POST' && url.startsWith('/api/action/')) {
        const actionName = url.split('/').pop();
        void handleAction(actionName, res);
        return;
      }
      if (req.method === 'GET' && url === '/api/status') {
        void (async () => {
          const status = await currentStatus();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(status));
        })();
        return;
      }
      if (req.method === 'GET' && url === '/events') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });
        res.write('retry: 2000\n\n');
        const client = { res };
        sseClients.add(client);
        req.on('close', () => sseClients.delete(client));
        return;
      }
      if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(DASHBOARD_HTML);
        return;
      }
      res.writeHead(404);
      res.end('Not found');
    });

    server.on('error', () => resolve(false));
    server.listen(CONTROL_PORT, '127.0.0.1', () => {
      info('control', `Control panel available at ${CONTROL_URL}`);
      resolve(true);
    });
  });
}

async function handleAction(name: string, res: http.ServerResponse): Promise<void> {
  switch (name) {
    case 'restart-backend':
      restartBackend();
      break;
    case 'restart-frontend':
      restartFrontend();
      break;
    case 'stop':
      stopAll();
      break;
    default:
      res.writeHead(404);
      res.end('Unknown action');
      return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, action: name }));
}

// ---------------- main ----------------

async function main(): Promise<void> {
  info('system', '============================================');
  info('system', 'Office Inventory - Developer Launcher');
  info('system', `Repository: ${REPO}`);
  info('system', `API : http://localhost:${API_PORT}  Web: ${VITE_URL}  Control: ${CONTROL_URL}`);
  info('system', '============================================');

  const lockOk = acquireLock();
  if (!lockOk) {
    error('system', 'Another developer launcher instance is already running.');
    if (config.autoOpenBrowser) openBrowser(CONTROL_URL);
    process.exit(1);
  }

  const controlUp = await startControlServer();
  if (!controlUp) {
    error('system', `Control panel port ${CONTROL_PORT} is already in use — another launcher may be running.`);
    releaseLock();
    process.exit(1);
  }

  const [nodeOk, npmOk] = [await detectNode(), await detectNpm()];
  if (!nodeOk || !npmOk) {
    error('system', 'Node.js and npm are required. Install Node.js 20+ and retry.');
    releaseLock();
    process.exit(1);
  }

  envProblems = validateEnv();
  postgresState = await detectPostgres();

  const depsOk = await ensureDependencies();
  if (!depsOk) {
    error('system', 'Dependency installation failed. Fix the errors above and restart the launcher.');
  }

  // Backend: reuse a backend that is already serving /health (e.g. a stale dev
  // server) instead of crashing with EADDRINUSE.
  const backendAlreadyUp = (await fetch(HEALTH_URL, 1500)) === 200;
  if (backendAlreadyUp) {
    backend.state = 'running';
    backend.owned = false;
    info('backend', `A backend is already running on port ${API_PORT} — reusing it.`);
  } else {
    startBackend();
    info('system', `Waiting for backend at ${HEALTH_URL}...`);
    const backendOk = await waitForHealth(120_000);
    if (backendOk) {
      backend.state = 'running';
      info('backend', 'Backend is healthy.');
    } else {
      backend.state = 'error';
      error('backend', 'Backend did not become healthy in time.');
    }
  }

  if (depsOk && envProblems.length === 0) {
    // Frontend: reuse an already-listening Vite server if present.
    if (await tcpAlive(WEB_PORT, 1500)) {
      frontend.state = 'running';
      frontend.owned = false;
      info('frontend', `A frontend server is already running on port ${WEB_PORT} — reusing it.`);
    } else {
      startFrontend();
      info('system', `Waiting for frontend at ${VITE_URL}...`);
      const webOk = await waitForWeb(120_000);
      if (webOk) {
        frontend.state = 'running';
        info('frontend', 'Frontend is ready.');
      } else {
        frontend.state = 'error';
        error('frontend', 'Frontend did not become ready in time.');
      }
    }
  }

  if (config.autoOpenBrowser) {
    openBrowser(VITE_URL);
    openBrowser(CONTROL_URL);
    info('system', `Opened ${VITE_URL} and ${CONTROL_URL} in the browser.`);
  }

  info('system', 'Running. Use the control panel to restart services or Stop All.');
  info('system', 'Close this window or press Ctrl+C to stop.');
}

function shutdown(): void {
  stopping = true;
  info('system', 'Shutting down...');
  stopBackend();
  stopFrontend();
  releaseLock();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('exit', () => {
  if (!stopping) releaseLock();
});

void main();
