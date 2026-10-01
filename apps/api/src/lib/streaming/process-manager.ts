import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { env, streamingGatewayConfig } from '@/config/env';
import { logger } from '@/lib/logger';

/**
 * Supervises the MediaMTX streaming-gateway process.
 *
 * The gateway is a single, dependency-free binary. This manager:
 *  - writes a minimal config (Control API + RTSP/WebRTC/HLS listeners) that
 *    binds to loopback and pins RTSP to TCP for stability,
 *  - spawns the process and restarts it with backoff if it crashes,
 *  - never logs the generated config (it holds no secrets, but paths do not
 *    belong in logs either).
 *
 * The binary is looked up (in order) from `CCTV_GATEWAY_BINARY`, the bundled
 * `<storage>/gateway/` folder, then the system PATH. When it cannot be found,
 * startup logs a clear warning and Live View degrades gracefully.
 */

const BINARY_NAME = process.platform === 'win32' ? 'mediamtx.exe' : 'mediamtx';

export function gatewayDir(): string {
  return path.join(env.storageRoot, 'gateway');
}

export function resolveGatewayBinaryPath(): string | null {
  const explicit = streamingGatewayConfig.binary?.trim();
  if (explicit) return existsSync(explicit) ? explicit : null;
  // Bundled at runtime (release/desktop or storage root).
  const bundled = path.join(gatewayDir(), BINARY_NAME);
  if (existsSync(bundled)) return bundled;
  // Workspace-local copy produced by `npm run fetch:gateway` (dev server cwd is
  // apps/api, so `gateway/` resolves to apps/api/gateway).
  const local = path.resolve(process.cwd(), 'gateway', BINARY_NAME);
  if (existsSync(local)) return local;
  // Fall back to PATH resolution by the OS when spawning.
  return BINARY_NAME;
}

interface Endpoint {
  host: string;
  port: number;
}

function parseEndpoint(url: string, fallbackPort: number): Endpoint {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || '127.0.0.1',
      port: parsed.port ? Number(parsed.port) : fallbackPort,
    };
  } catch {
    return { host: '127.0.0.1', port: fallbackPort };
  }
}

/** Builds the YAML config consumed by MediaMTX. Contains no credentials. */
export function buildGatewayConfig(): string {
  const api = parseEndpoint(streamingGatewayConfig.apiUrl, 9997);
  const webrtc = parseEndpoint(streamingGatewayConfig.webrtcUrl, 8889);
  const hls = parseEndpoint(streamingGatewayConfig.hlsUrl, 8888);
  const rtsp = parseEndpoint(streamingGatewayConfig.rtspUrl, 8554);

  // Only the protocols Live View needs are enabled; the rest are turned off so
  // the gateway binds the fewest ports and generates no stray key material.
  return [
    'logLevel: error',
    'logDestinations: [stdout]',
    'readTimeout: 10s',
    'writeTimeout: 10s',
    '',
    'api: yes',
    `apiAddress: ${api.host}:${api.port}`,
    '',
    'rtsp: yes',
    `rtspAddress: ${rtsp.host}:${rtsp.port}`,
    'rtspTransports: [tcp]',
    '',
    'webrtc: yes',
    `webrtcAddress: ${webrtc.host}:${webrtc.port}`,
    `webrtcLocalUDPAddress: ${webrtc.host}:${streamingGatewayConfig.mediaUdpPort}`,
    'webrtcIPsFromInterfaces: true',
    'webrtcAdditionalHosts: [127.0.0.1]',
    '',
    'hls: yes',
    `hlsAddress: ${hls.host}:${hls.port}`,
    'hlsVariant: mpegts',
    '',
    'rtmp: no',
    'srt: no',
    'moq: no',
    'playback: no',
    '',
    'paths: {}',
    '',
  ].join('\n');
}

let child: ChildProcess | null = null;
let restartTimer: NodeJS.Timeout | null = null;
let restartAttempts = 0;
let stopping = false;
let started = false;

function writeConfig(): string {
  const dir = gatewayDir();
  mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, 'mediamtx.yml');
  writeFileSync(configPath, buildGatewayConfig(), 'utf8');
  return configPath;
}

function startProcess(): void {
  const binary = resolveGatewayBinaryPath();
  if (!binary) {
    logger.warn(
      'Streaming gateway binary not found. Live View is unavailable until it is installed (see scripts/fetch-streaming-gateway.mjs).',
    );
    return;
  }

  let configPath: string;
  try {
    configPath = writeConfig();
  } catch (error) {
    logger.error({ error }, 'Failed to write streaming gateway config');
    return;
  }

  const proc = spawn(binary, [configPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  proc.stdout?.on('data', (data: Buffer) => {
    const line = String(data).trimEnd();
    if (line) logger.debug({ gateway: line }, 'streaming gateway');
  });
  proc.stderr?.on('data', (data: Buffer) => {
    const line = String(data).trimEnd();
    if (line) logger.warn({ gateway: line }, 'streaming gateway');
  });
  proc.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      logger.warn('Streaming gateway binary could not be executed; Live View is unavailable.');
    } else {
      logger.error({ error }, 'Streaming gateway failed to start');
    }
    child = null;
  });
  proc.on('exit', (code, signal) => {
    child = null;
    if (stopping) return;
    const reason = signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`;
    logger.warn(`Streaming gateway exited (${reason}); restarting.`);
    scheduleRestart();
  });

  child = proc;
  logger.info({ binary }, 'Streaming gateway started');
}

function scheduleRestart(): void {
  if (stopping) return;
  const delay = Math.min(15000, 1000 * 2 ** Math.min(restartAttempts, 4));
  restartAttempts += 1;
  restartTimer = setTimeout(() => {
    if (stopping) return;
    startProcess();
  }, delay);
  restartTimer.unref();
}

/** Starts the managed gateway. Safe to call once; repeated calls are ignored. */
export function startStreamingGateway(): void {
  if (started || !streamingGatewayConfig.enabled || !streamingGatewayConfig.managed) return;
  started = true;
  stopping = false;
  restartAttempts = 0;
  startProcess();
}

/** Stops the managed gateway and cancels any pending restart. */
export function stopStreamingGateway(): void {
  stopping = true;
  started = false;
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  if (child) {
    const proc = child;
    child = null;
    try {
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 3000).unref();
    } catch {
      // ignore
    }
  }
}

/** True when a managed gateway process is currently running. */
export function isGatewayProcessRunning(): boolean {
  return child !== null;
}
