import { spawn } from 'node:child_process';
import { RtspError } from '@/lib/rtsp/errors';
import { isFfmpegAvailable, resolveFfmpegBinaryPath } from '@/lib/streaming/ingest';
import { logger } from '@/lib/logger';
import type { RtspCredentials, RtspProbeResult } from '@/lib/rtsp/types';

/**
 * FFmpeg-based RTSP probe.
 *
 * Some devices (notably Hikvision) accept a digest handshake that our minimal
 * `RtspProbeClient` cannot reproduce, yet FFmpeg/VLC can read the stream. Since
 * Live View already uses FFmpeg as the ingest adapter, the most faithful probe
 * of "can this device stream?" is to run FFmpeg the SAME way: open RTSP over
 * TCP, decode a short window of media to a null sink, and report success only
 * when frames were actually decoded.
 *
 * This proves more than an RTSP `DESCRIBE 200`:
 *   1. TCP reachability
 *   2. authentication
 *   3. stream present (SDP)
 *   4. media actually decoded
 *
 * Security: the credential-bearing URL lives only in the spawned process argv.
 * It is never logged, persisted, or returned. Only the credential-free label is
 * surfaced in the result.
 */

/** Outcome of a decode probe; a superset of the transport-only probe result. */
export interface RtspDecodeProbeResult extends RtspProbeResult {
  decodedFrames: number;
  durationMs: number;
}

export interface FfmpegProbeConfig {
  host: string;
  port: number;
  credentials: RtspCredentials;
  /** Wall-clock timeout for the whole probe in milliseconds. */
  timeoutMs: number;
  /** How long to let FFmpeg read/decode media (probe window), in milliseconds. */
  probeDurationMs: number;
  /** Injectable spawner (tests). Defaults to node:child_process.spawn. */
  spawnImpl?: RtspProbeSpawn;
}

/** Minimal child surface the probe needs; lets tests inject a fake. */
export interface RtspProbeChild {
  kill(signal?: NodeJS.Signals): boolean;
  killed?: boolean;
  stdout: { on(event: string, listener: (data: Buffer) => void): unknown } | null;
  stderr: { on(event: string, listener: (data: Buffer) => void): unknown } | null;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
}

export type RtspProbeSpawn = (binary: string, args: string[]) => RtspProbeChild;

function defaultSpawn(binary: string, args: string[]): RtspProbeChild {
  return spawn(binary, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  }) as unknown as RtspProbeChild;
}

/** Builds the FFmpeg argument list. The URL may embed credentials. */
export function buildFfmpegProbeArgs(
  url: string,
  options: { probeDurationMs: number; timeoutMs: number },
): string[] {
  const durationSec = Math.max(0.5, options.probeDurationMs / 1000).toFixed(2);
  // The socket I/O timeout must comfortably exceed the probe window: some DVRs
  // (Hikvision) are slow to deliver the first frames after authentication.
  const socketTimeoutMs = Math.max(options.timeoutMs, options.probeDurationMs + 5000);
  const rwTimeoutUs = String(Math.max(1, Math.round(socketTimeoutMs)) * 1000);
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-nostdin',
    // Machine-readable progress on stdout so we can count decoded frames.
    '-progress',
    'pipe:1',
    // Do not abort early on decode errors. Some embedded DVRs (e.g. Hikvision)
    // emit a stream that decodes with artifacts; FFmpeg's default error-rate
    // limit aborts after a few bad frames even though the stream is playable.
    // The probe only needs to prove that media decodes, so tolerate errors.
    '-max_error_rate',
    '1.0',
    '-rtsp_transport',
    'tcp',
    // `-timeout` is the RTSP demuxer / socket I/O timeout in microseconds.
    // (`-rw_timeout` is protocol-level and missing from some builds.)
    '-timeout',
    rwTimeoutUs,
    '-i',
    url,
    '-t',
    durationSec,
    '-an',
    '-f',
    'null',
    '-',
  ];
}

/** Parses the maximum `frame=` value from FFmpeg `-progress` output. */
export function parseProgressFrameCount(progressText: string): number {
  let max = 0;
  for (const line of progressText.split(/\r?\n/)) {
    const m = /^frame=(\d+)\s*$/.exec(line.trim());
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

/**
 * Classifies an FFmpeg failure into the RTSP error taxonomy. Returns `null`
 * when the probe produced decodable frames (success).
 */
export function classifyFfmpegProbe(input: {
  stderr: string;
  decodedFrames: number;
  timedOut: boolean;
}): RtspError | null {
  const { stderr, decodedFrames, timedOut } = input;
  if (decodedFrames > 0) return null;

  const text = stderr.toLowerCase();
  if (/401|403|unauthorized|authentication/i.test(text)) {
    return new RtspError('AUTHENTICATION_FAILED');
  }
  if (/connection refused|econnrefused/i.test(text)) {
    return new RtspError('RTSP_UNAVAILABLE');
  }
  if (/no route to host|name or service not known|nodename nor servname|temporary failure in name resolution/i.test(text)) {
    return new RtspError('DEVICE_UNREACHABLE');
  }
  if (/404|not found|stream not found/i.test(text)) {
    return new RtspError('STREAM_UNAVAILABLE');
  }
  if (timedOut || /timed? out|timeout/i.test(text)) {
    return new RtspError('CONNECTION_TIMEOUT');
  }
  if (/no such|invalid data found|could not find codec|server returned 4\d\d/i.test(text)) {
    return new RtspError('STREAM_UNAVAILABLE');
  }
  if (text.trim().length === 0) {
    // No error, yet no frames: the connection was accepted but nothing usable
    // arrived in the probe window.
    return new RtspError('STREAM_NO_MEDIA');
  }
  // Any other error with no frames: the stream is present but not decodable.
  return new RtspError('STREAM_NO_MEDIA');
}

/** Strips embedded credentials from a URL for safe logging/labels. */
function safeLabel(url: string): string {
  try {
    const u = new URL(url);
    u.username = '';
    u.password = '';
    return u.toString();
  } catch {
    return url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@]*@/i, '$1');
  }
}

/** Injects the stored credential into an RTSP URL (server-side only). */
export function buildAuthorizedRtspUrl(
  target: { scheme: string; host: string; port: number; pathWithQuery: string },
  credentials: RtspCredentials,
): string {
  // Accept 'rtsp', 'rtsp:', 'rtsp://' and normalise to '<scheme>://'.
  const scheme = target.scheme.replace(/:?\/*$/, '');
  const auth = credentials.username
    ? `${encodeURIComponent(credentials.username)}:${encodeURIComponent(credentials.password)}@`
    : '';
  return `${scheme}://${auth}${target.host}:${target.port}${target.pathWithQuery}`;
}

/** Runs one FFmpeg decode probe against a full RTSP URL. */
export function runFfmpegProbe(
  binary: string,
  url: string,
  config: FfmpegProbeConfig,
): Promise<RtspDecodeProbeResult> {
  const spawnImpl = config.spawnImpl ?? defaultSpawn;
  const args = buildFfmpegProbeArgs(url, {
    probeDurationMs: config.probeDurationMs,
    timeoutMs: config.timeoutMs,
  });

  const startedAt = Date.now();
  return new Promise<RtspDecodeProbeResult>((resolve, reject) => {
    let child: RtspProbeChild;
    try {
      child = spawnImpl(binary, args);
    } catch (error) {
      reject(new RtspError('RTSP_UNAVAILABLE', (error as Error)?.message));
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;

    // Hard stop well beyond the socket timeout so a hung device cannot leak a
    // probe process, while still allowing slow starts to complete.
    const hardStopMs = Math.max(config.timeoutMs, config.probeDurationMs + 5000) + 6000;
    const killTimer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
    }, hardStopMs);

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      fn();
    };

    child.stdout?.on('data', (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString();
    });
    child.on('error', (error) => {
      const err = error as NodeJS.ErrnoException;
      finish(() => {
        if (err.code === 'ENOENT') reject(new RtspError('RTSP_UNAVAILABLE'));
        else reject(new RtspError('UNKNOWN_ERROR', err.message));
      });
    });
    child.on('close', () => {
      finish(() => {
        const decodedFrames = parseProgressFrameCount(stdout);
        const failure = classifyFfmpegProbe({ stderr, decodedFrames, timedOut });
        if (failure) {
          // Never log the raw FFmpeg stderr (it can echo the credential URL).
          logger.debug?.({ host: config.host, port: config.port, code: failure.code, label: safeLabel(url) }, 'RTSP FFmpeg probe failed');
          reject(failure);
          return;
        }
        resolve({
          statusCode: 200,
          latencyMs: Date.now() - startedAt,
          authenticated: true,
          decodedFrames,
          durationMs: Date.now() - startedAt,
        });
      });
    });
  });
}

/**
 * FFmpeg-backed probe satisfying the CCTV service's `CctvRtspClient` shape.
 * `describe(path)` probes `rtsp://host:port{path}`; `describeUri(uri)` probes a
 * device-provided URI on its own host/port.
 */
export class FfmpegRtspProbe {
  constructor(private readonly config: FfmpegProbeConfig) {}

  async describe(path: string): Promise<RtspProbeResult> {
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = buildAuthorizedRtspUrl(
      { scheme: 'rtsp://', host: this.config.host, port: this.config.port, pathWithQuery: p },
      this.config.credentials,
    );
    return this.run(url);
  }

  async describeUri(uri: string): Promise<RtspProbeResult> {
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      throw new RtspError('STREAM_UNAVAILABLE');
    }
    if (parsed.protocol !== 'rtsp:' && parsed.protocol !== 'rtsps:') {
      throw new RtspError('STREAM_UNAVAILABLE');
    }
    const scheme = parsed.protocol === 'rtsps:' ? 'rtsps://' : 'rtsp://';
    const host = parsed.hostname;
    const port = parsed.port ? Number(parsed.port) : 554;
    const pathWithQuery = `${parsed.pathname}${parsed.search}`;
    const url = buildAuthorizedRtspUrl({ scheme, host, port, pathWithQuery }, this.config.credentials);
    return this.run(url);
  }

  private run(url: string): Promise<RtspDecodeProbeResult> {
    const binary = resolveFfmpegBinaryPath();
    if (!binary) throw new RtspError('RTSP_UNAVAILABLE');
    return runFfmpegProbe(binary, url, this.config);
  }
}

/** True when an FFmpeg decode probe can run in this environment. */
export function isFfmpegRtspProbeAvailable(): boolean {
  return isFfmpegAvailable();
}
