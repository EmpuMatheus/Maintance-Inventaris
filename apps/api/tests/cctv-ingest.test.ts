import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  buildIngestArgs,
  isFfmpegAvailable,
  resolveFfmpegBinaryPath,
  describeFfmpegResolution,
  verifyFfmpegExecutable,
  ffmpegUnavailableReason,
  setFfmpegBinaryOverride,
  setIngestFactory,
  resetIngestFactory,
  startIngest,
  stopIngest,
  stopAllIngests,
  isIngestRunning,
  activeIngestCount,
} from '@/lib/streaming/ingest';

/**
 * The ingest normalizer turns a device stream MediaMTX cannot repackage into a
 * browser-safe H.264 published into the gateway. These tests assert the command
 * shape, credential handling, and lifecycle without spawning a real FFmpeg.
 */

describe('buildIngestArgs', () => {
  const src = 'rtsp://admin:secret@10.0.0.1:554/Streaming/channels/102';

  it('re-encodes to browser-safe H.264 (baseline, no B-frames, GoP set)', () => {
    const args = buildIngestArgs(src, 'bbp_test');
    const joined = args.join(' ');
    expect(joined).toContain('-c:v libx264');
    expect(joined).toContain('-profile:v baseline');
    expect(joined).toContain('-bf 0');
    expect(joined).toContain('-tune zerolatency');
    // Input is the credential-bearing source; output is the local gateway path.
    expect(args).toContain(src);
    expect(joined).toContain('rtsp://127.0.0.1:8554/bbp_test');
  });

  it('keeps the credential only in argv (never in a separate config/log arg)', () => {
    const args = buildIngestArgs(src, 'bbp_test');
    // Exactly one argument contains the credential-bearing URL.
    const withCred = args.filter((a) => a.includes('secret'));
    expect(withCred).toHaveLength(1);
  });
});

describe('resolveFfmpegBinaryPath / isFfmpegAvailable', () => {
  afterEach(() => setFfmpegBinaryOverride(undefined));

  it('does not report a bare command name as available on its own', () => {
    // Point resolution at a tool that cannot exist, so no accidental binary is
    // found and the false positive from a bare name is impossible.
    setFfmpegBinaryOverride(null);
    expect(resolveFfmpegBinaryPath()).toBeNull();
    expect(isFfmpegAvailable()).toBe(false);
  });

  it('reports availability only for an actually executable binary', () => {
    // process.execPath is a real, executable file on every platform.
    setFfmpegBinaryOverride(process.execPath);
    expect(resolveFfmpegBinaryPath()).toBe(process.execPath);
    expect(isFfmpegAvailable()).toBe(true);
  });

  it('treats a configured but non-existent path as unavailable', () => {
    setFfmpegBinaryOverride(path.join(os.tmpdir(), 'definitely-not-ffmpeg-' + Date.now()));
    expect(resolveFfmpegBinaryPath()).toBeNull();
    expect(isFfmpegAvailable()).toBe(false);
  });

  it('does not treat a directory as an installed binary', () => {
    setFfmpegBinaryOverride(os.tmpdir());
    expect(resolveFfmpegBinaryPath()).toBeNull();
  });

  it('reports candidates and a reason when nothing resolves', () => {
    setFfmpegBinaryOverride(null);
    const resolution = describeFfmpegResolution();
    expect(resolution.path).toBeNull();
    expect(resolution.candidates.length).toBeGreaterThan(0);
    expect(ffmpegUnavailableReason()).toBeTruthy();
  });

  it('resolves a Windows-style path containing spaces when the file exists', () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'ffmpeg with spaces '));
    const file = path.join(dir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
    writeFileSync(file, 'stub');
    if (process.platform !== 'win32') chmodSync(file, 0o755);
    try {
      setFfmpegBinaryOverride(file);
      expect(resolveFfmpegBinaryPath()).toBe(file);
      expect(describeFfmpegResolution().source).toBe('override');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('verifyFfmpegExecutable (-version)', () => {
  it('returns true when the binary executes with exit code 0', () => {
    expect(verifyFfmpegExecutable('/anything', () => ({ status: 0 }))).toBe(true);
  });

  it('returns false when the binary exits non-zero', () => {
    expect(verifyFfmpegExecutable('/anything', () => ({ status: 1 }))).toBe(false);
  });

  it('returns false on a spawn error (ENOENT)', () => {
    const error = Object.assign(new Error('spawn ffmpeg ENOENT'), { code: 'ENOENT' });
    expect(verifyFfmpegExecutable('/missing/ffmpeg', () => ({ status: null, error }))).toBe(false);
  });

  it('returns false when the runner throws', () => {
    expect(
      verifyFfmpegExecutable('/missing/ffmpeg', () => {
        throw Object.assign(new Error('boom'), { code: 'EACCES' });
      }),
    ).toBe(false);
  });
});

describe('FFmpeg ingest lifecycle (fake factory)', () => {
  const spawns: { args: string[]; killed: boolean }[] = [];

  beforeEach(() => {
    spawns.length = 0;
    // A real, executable "binary" so startIngest resolves one without a device.
    setFfmpegBinaryOverride(process.execPath);
    setIngestFactory((binary, args) => {
      const record = { args: [...args, `--binary=${binary}`], killed: false };
      spawns.push(record);
      return {
        kill: () => {
          record.killed = true;
          return true;
        },
        killed: false,
        on: () => undefined,
        stderr: null,
      } as never;
    });
  });

  afterEach(() => {
    stopAllIngests();
    resetIngestFactory();
    setFfmpegBinaryOverride(undefined);
  });

  it('starts one process per path and replaces an existing one', () => {
    startIngest('p1', 'rtsp://u:p@host/1');
    expect(isIngestRunning('p1')).toBe(true);
    expect(activeIngestCount()).toBe(1);

    startIngest('p1', 'rtsp://u:p@host/1');
    expect(activeIngestCount()).toBe(1); // restarted, not duplicated
    expect(spawns[0].killed).toBe(true);
  });

  it('stops a process and reports it as no longer running', () => {
    startIngest('p2', 'rtsp://u:p@host/2');
    stopIngest('p2');
    expect(isIngestRunning('p2')).toBe(false);
    expect(activeIngestCount()).toBe(0);
  });

  it('stops every ingest process on shutdown', () => {
    startIngest('a', 'rtsp://u:p@host/a');
    startIngest('b', 'rtsp://u:p@host/b');
    expect(activeIngestCount()).toBe(2);
    stopAllIngests();
    expect(activeIngestCount()).toBe(0);
  });

  it('refuses to start when no FFmpeg binary can be resolved', () => {
    setFfmpegBinaryOverride(null);
    expect(() => startIngest('p3', 'rtsp://u:p@host/3')).toThrow(/FFmpeg binary not found/i);
    expect(isIngestRunning('p3')).toBe(false);
  });
});
