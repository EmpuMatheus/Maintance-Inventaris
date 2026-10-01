import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { env, streamingGatewayConfig } from '@/config/env';
import { logger } from '@/lib/logger';

/**
 * FFmpeg ingest normalizer.
 *
 * Some devices (e.g. Hikvision DVRs) serve H.264 that MediaMTX mis-parses: the
 * device advertises `packetization-mode=0` while sending FU-A, and MediaMTX's
 * packetization-mode remuxer emits a corrupted SPS, so the gateway reports a
 * bogus track (16x16, invalid profile) and browsers decode zero frames.
 *
 * The normalizer runs a managed FFmpeg that:
 *   - pulls the RTSP source (credentials injected server-side),
 *   - re-encodes to a browser-safe H.264 (baseline, no B-frames, keyframe GoP),
 *   - publishes it into the local MediaMTX gateway (which then serves WebRTC/HLS).
 *
 * This keeps MediaMTX as the streaming gateway (architecture unchanged); FFmpeg
 * is only an ingest adapter. The credential-bearing URL lives solely in this
 * process's argv on the server and is never logged, persisted, or sent to the
 * gateway configuration.
 */

const BINARY_NAME = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

/** Directory where a bundled FFmpeg binary may be dropped. */
export function ffmpegDir(): string {
  return path.join(env.storageRoot, 'gateway');
}

/** Resolves the FFmpeg binary: explicit env, bundled, workspace, then PATH. */
export function resolveFfmpegBinaryPath(): string | null {
  const explicit = streamingGatewayConfig.ffmpegBinary?.trim();
  if (explicit) return existsSync(explicit) ? explicit : null;
  const bundled = path.join(ffmpegDir(), BINARY_NAME);
  if (existsSync(bundled)) return bundled;
  const local = path.resolve(process.cwd(), 'gateway', BINARY_NAME);
  if (existsSync(local)) return local;
  // Fall back to PATH resolution by the OS when spawning.
  return BINARY_NAME;
}

/** True when an FFmpeg binary is available (explicit, bundled, or on PATH). */
export function isFfmpegAvailable(): boolean {
  const resolved = resolveFfmpegBinaryPath();
  if (!resolved) return false;
  // A bare command name is assumed to be on PATH; an absolute path must exist.
  return resolved === BINARY_NAME || existsSync(resolved);
}

interface IngestProcess {
  pathName: string;
  child: ChildProcess;
  startedAt: number;
}

/** Minimal child surface the manager needs; lets tests inject a fake. */
export interface IngestChild {
  kill(signal?: NodeJS.Signals): boolean;
  killed?: boolean;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  stderr: { on(event: string, listener: (data: Buffer) => void): unknown } | null;
}

export type IngestFactory = (binary: string, args: string[]) => IngestChild;

function defaultIngestFactory(binary: string, args: string[]): IngestChild {
  return spawn(binary, args, {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  }) as unknown as IngestChild;
}

let ingestFactory: IngestFactory = defaultIngestFactory;

/** Overrides the FFmpeg spawner. Intended for dependency injection/tests. */
export function setIngestFactory(factory: IngestFactory): void {
  ingestFactory = factory;
}

/** Restores the default FFmpeg spawner. */
export function resetIngestFactory(): void {
  ingestFactory = defaultIngestFactory;
}

const processes = new Map<string, IngestProcess>();

/** Builds the FFmpeg argument list for a gateway path. Never logged verbatim. */
export function buildIngestArgs(sourceUrl: string, gatewayPath: string): string[] {
  const gop = streamingGatewayConfig.ingestGop;
  const bitrate = streamingGatewayConfig.ingestVideoBitrate?.trim();
  const rtspBase = streamingGatewayConfig.rtspUrl.replace(/\/+$/, '');
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    '-rtsp_transport',
    'tcp',
    // Tolerant timestamping/probing: Hikvision streams can start mid-GOP and
    // arrive with non-monotonic timestamps. genpts + a longer probe window let
    // FFmpeg lock onto the stream instead of dropping it as invalid.
    '-fflags',
    '+genpts',
    '-analyzeduration',
    '10000000',
    '-probesize',
    '10000000',
    '-i',
    sourceUrl,
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-tune',
    'zerolatency',
    '-profile:v',
    'baseline',
    '-bf',
    '0',
    '-g',
    String(gop),
    '-pix_fmt',
    'yuv420p',
  ];
  if (bitrate) args.push('-b:v', bitrate);
  args.push(
    '-an',
    '-f',
    'rtsp',
    '-rtsp_transport',
    'tcp',
    `${rtspBase}/${gatewayPath}`,
  );
  return args;
}

/** Starts (or restarts) an ingest process for a gateway path. */
export function startIngest(pathName: string, sourceUrl: string): void {
  stopIngest(pathName);

  const binary = resolveFfmpegBinaryPath();
  if (!binary) {
    throw new Error('FFmpeg binary not found for stream normalization.');
  }

  const args = buildIngestArgs(sourceUrl, pathName);
  const child = ingestFactory(binary, args);

  // FFmpeg banners can echo the input URL (with credentials). We log only a
  // generic message, never the child's stderr.
  child.stderr?.on('data', () => {
    // intentionally ignored
  });
  child.on('error', (error) => {
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'ENOENT') {
      logger.warn({ path: pathName }, 'FFmpeg ingest binary could not be executed.');
    } else {
      logger.warn({ path: pathName, code: err.code }, 'FFmpeg ingest failed to start.');
    }
    processes.delete(pathName);
  });
  child.on('exit', (code, signal) => {
    const current = processes.get(pathName);
    if (current?.child === child) processes.delete(pathName);
    if (code !== 0 && code !== null && !signal) {
      logger.warn({ path: pathName, code }, 'FFmpeg ingest exited.');
    }
  });

  processes.set(pathName, { pathName, child: child as unknown as ChildProcess, startedAt: Date.now() });
}

/** Stops the ingest process for a gateway path, if any. */
export function stopIngest(pathName: string): void {
  const proc = processes.get(pathName);
  if (!proc) return;
  processes.delete(pathName);
  try {
    proc.child.kill('SIGTERM');
    setTimeout(() => {
      try {
        if (!proc.child.killed) proc.child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, 3000).unref();
  } catch {
    // ignore
  }
}

/** Stops every ingest process. Used on shutdown and on session teardown. */
export function stopAllIngests(): void {
  for (const pathName of Array.from(processes.keys())) stopIngest(pathName);
}

export function isIngestRunning(pathName: string): boolean {
  return processes.has(pathName);
}

export function activeIngestCount(): number {
  return processes.size;
}
