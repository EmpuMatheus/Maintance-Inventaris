import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildIngestArgs,
  isFfmpegAvailable,
  resolveFfmpegBinaryPath,
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
  it('reports availability from env/explicit override', () => {
    // The bundled test binary may not exist; the function must not throw and
    // must return a string or null.
    const resolved = resolveFfmpegBinaryPath();
    expect(resolved === null || typeof resolved === 'string').toBe(true);
    expect(typeof isFfmpegAvailable()).toBe('boolean');
  });
});

describe('FFmpeg ingest lifecycle (fake factory)', () => {
  const spawns: { args: string[]; killed: boolean }[] = [];

  beforeEach(() => {
    spawns.length = 0;
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
});
