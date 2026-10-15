import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
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

/**
 * True when `candidate` is a regular file that is executable by this process.
 * `X_OK` alone is not enough on Windows, where it behaves like `F_OK` and would
 * accept a directory; `statSync().isFile()` rejects directories and placeholders.
 */
function isExecutableFile(candidate: string): boolean {
  try {
    if (!statSync(candidate).isFile()) return false;
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Resolves a bare binary name against the OS PATH. Returns null when absent. */
function resolveOnPath(name: string): string | null {
  const dirs = (process.env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const dir of dirs) {
    const candidate = path.join(dir, name);
    if (isExecutableFile(candidate)) return candidate;
  }
  return null;
}

/** Where the resolved FFmpeg was found (for diagnostics). */
export type FfmpegResolutionSource = 'env' | 'bundled' | 'workspace' | 'path' | 'override' | 'none';

export interface FfmpegResolution {
  path: string | null;
  source: FfmpegResolutionSource;
  /** Candidates checked, in order. Paths only — never credentials. */
  candidates: string[];
  /** Why an explicitly configured binary was rejected, when applicable. */
  note?: string;
}

let ffmpegBinaryOverride: string | null | undefined;

/** Overrides FFmpeg binary resolution. Intended for tests (undefined restores). */
export function setFfmpegBinaryOverride(value: string | null | undefined): void {
  ffmpegBinaryOverride = value;
}

/**
 * Resolves the FFmpeg binary with full provenance:
 *   1. `CCTV_FFMPEG_BINARY` (explicit)
 *   2. bundled `<storageRoot>/gateway/ffmpeg[.exe]`
 *   3. workspace `<cwd>/gateway/ffmpeg[.exe]` (dev copy from `fetch:gateway`)
 *   4. the OS PATH
 * A candidate counts only when the file exists and is executable, so a
 * directory or placeholder is never mistaken for an installed binary.
 */
export function describeFfmpegResolution(): FfmpegResolution {
  const candidates: string[] = [];

  if (ffmpegBinaryOverride !== undefined) {
    candidates.push(ffmpegBinaryOverride ?? '(test override: none)');
    if (ffmpegBinaryOverride && isExecutableFile(ffmpegBinaryOverride)) {
      return { path: ffmpegBinaryOverride, source: 'override', candidates };
    }
    return { path: null, source: 'none', candidates, note: 'test override did not resolve to an executable file' };
  }

  const explicit = streamingGatewayConfig.ffmpegBinary?.trim();
  if (explicit) {
    candidates.push(explicit);
    if (isExecutableFile(explicit)) return { path: explicit, source: 'env', candidates };
    return {
      path: null,
      source: 'none',
      candidates,
      note: 'CCTV_FFMPEG_BINARY is set but is not an executable file',
    };
  }

  const bundled = path.join(ffmpegDir(), BINARY_NAME);
  candidates.push(bundled);
  if (isExecutableFile(bundled)) return { path: bundled, source: 'bundled', candidates };

  // The dev/workspace copy produced by `npm run fetch:gateway`. Anchored to the
  // process working directory, which npm workspace scripts pin to apps/api.
  const workspace = path.resolve(process.cwd(), 'gateway', BINARY_NAME);
  candidates.push(workspace);
  if (isExecutableFile(workspace)) return { path: workspace, source: 'workspace', candidates };

  candidates.push(`PATH (${BINARY_NAME})`);
  const onPath = resolveOnPath(BINARY_NAME);
  if (onPath) return { path: onPath, source: 'path', candidates };

  return { path: null, source: 'none', candidates };
}

/** Resolves the FFmpeg binary path, or null when no executable is present. */
export function resolveFfmpegBinaryPath(): string | null {
  return describeFfmpegResolution().path;
}

/** True when an FFmpeg binary is available (explicit, bundled, workspace, PATH). */
export function isFfmpegAvailable(): boolean {
  return resolveFfmpegBinaryPath() !== null;
}

/**
 * Verifies a resolved binary can actually be executed by running `-version`.
 * Spawning with an argument array (no shell) keeps Windows paths with spaces
 * safe and surfaces spawn errors (ENOENT/EACCES) as `false` rather than a throw.
 */
export function verifyFfmpegExecutable(
  binary: string,
  run: (
    bin: string,
  ) => { status: number | null; error?: NodeJS.ErrnoException } = (bin) =>
    spawnSync(bin, ['-version'], { windowsHide: true, stdio: 'ignore' }),
): boolean {
  try {
    const result = run(binary);
    return !result.error && result.status === 0;
  } catch {
    return false;
  }
}

/** Human-readable reason FFmpeg is unavailable, for UI/diagnostic messages. */
export function ffmpegUnavailableReason(): string {
  const resolution = describeFfmpegResolution();
  if (resolution.note) return resolution.note;
  return `checked ${resolution.candidates.join(', ')}`;
}

/**
 * Logs the resolved streaming binaries at startup. Reports the path and the
 * reason when a check fails, and never logs credentials.
 */
export function logStreamingDiagnostics(): void {
  // The gateway binary is managed separately; log its presence for context.
  logger.info(
    { cwd: process.cwd(), storageRoot: env.storageRoot, gatewayDir: ffmpegDir() },
    'Streaming diagnostics',
  );

  const resolution = describeFfmpegResolution();
  if (!resolution.path) {
    logger.warn(
      { candidates: resolution.candidates, note: resolution.note },
      'FFmpeg not found: Live View normalizer and the Test RTSP decode probe are unavailable. ' +
        'Run "npm run fetch:gateway" or set CCTV_FFMPEG_BINARY to an executable path.',
    );
    return;
  }

  if (verifyFfmpegExecutable(resolution.path)) {
    logger.info(
      { path: resolution.path, source: resolution.source },
      'FFmpeg resolved and executable (-version OK)',
    );
  } else {
    logger.warn(
      { path: resolution.path, source: resolution.source },
      'FFmpeg was found but could not be executed (-version failed); Live View and the decode probe will fail.',
    );
  }
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
