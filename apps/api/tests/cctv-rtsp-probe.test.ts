import { describe, it, expect } from 'vitest';
import {
  buildFfmpegProbeArgs,
  parseProgressFrameCount,
  classifyFfmpegProbe,
  buildAuthorizedRtspUrl,
  runFfmpegProbe,
  FfmpegRtspProbe,
} from '@/modules/cctv/cctv.rtsp-probe';
import type { RtspProbeChild, RtspProbeSpawn } from '@/modules/cctv/cctv.rtsp-probe';

/**
 * The FFmpeg probe verifies a stream by decoding frames, not just by DESCRIBE.
 * These tests cover the pure arg builder/parser/classifier and the process
 * lifecycle with an injected spawner (no real FFmpeg / device needed).
 */

describe('buildFfmpegProbeArgs', () => {
  it('opens RTSP over TCP, bounds the read, uses a null sink, and emits progress on stdout', () => {
    const args = buildFfmpegProbeArgs('rtsp://admin:secret@10.0.0.1:554/Streaming/channels/102', {
      probeDurationMs: 2000,
      timeoutMs: 8000,
    });
    const joined = args.join(' ');
    expect(joined).toContain('-rtsp_transport tcp');
    expect(joined).toContain('-progress pipe:1');
    expect(joined).toContain('-max_error_rate 1.0');
    expect(joined).toContain('-f null -');
    expect(args).toContain('-t');
    expect(args).toContain('-timeout');
    // Never writes a media file.
    expect(joined).not.toMatch(/\.(mp4|mkv|ts|avi)/);
    // The credential-bearing URL is the input and is present only as the -i value.
    expect(args.filter((a) => a.includes('secret'))).toHaveLength(1);
  });
});

describe('parseProgressFrameCount', () => {
  it('returns the maximum frame value', () => {
    expect(parseProgressFrameCount('frame=0\nfps=0\nframe=12\nprogress=continue\nframe=25\nprogress=end\n')).toBe(25);
  });

  it('returns 0 when no frames were produced', () => {
    expect(parseProgressFrameCount('progress=end\n')).toBe(0);
  });
});

describe('classifyFfmpegProbe', () => {
  it('is a success (null) when frames decoded', () => {
    expect(classifyFfmpegProbe({ stderr: 'anything', decodedFrames: 5, timedOut: false })).toBeNull();
  });

  it('maps 401 to AUTHENTICATION_FAILED', () => {
    const e = classifyFfmpegProbe({ stderr: 'method DESCRIBE failed: 401 Unauthorized', decodedFrames: 0, timedOut: false });
    expect(e?.code).toBe('AUTHENTICATION_FAILED');
  });

  it('maps connection refused to RTSP_UNAVAILABLE', () => {
    expect(classifyFfmpegProbe({ stderr: 'Connection refused', decodedFrames: 0, timedOut: false })?.code).toBe('RTSP_UNAVAILABLE');
  });

  it('maps 404 to STREAM_UNAVAILABLE', () => {
    expect(classifyFfmpegProbe({ stderr: 'method DESCRIBE failed: 404 Not Found', decodedFrames: 0, timedOut: false })?.code).toBe('STREAM_UNAVAILABLE');
  });

  it('maps a probe timeout to CONNECTION_TIMEOUT', () => {
    expect(classifyFfmpegProbe({ stderr: '', decodedFrames: 0, timedOut: true })?.code).toBe('CONNECTION_TIMEOUT');
  });

  it('maps reachable-but-undecodable to STREAM_NO_MEDIA', () => {
    expect(classifyFfmpegProbe({ stderr: 'some non-fatal decode warning', decodedFrames: 0, timedOut: false })?.code).toBe('STREAM_NO_MEDIA');
  });
});

describe('buildAuthorizedRtspUrl', () => {
  it('embeds the credential for the server-side probe only', () => {
    const url = buildAuthorizedRtspUrl(
      { scheme: 'rtsp://', host: '10.0.0.1', port: 554, pathWithQuery: '/Streaming/channels/102' },
      { username: 'admin', password: 'pw' },
    );
    expect(url).toBe('rtsp://admin:pw@10.0.0.1:554/Streaming/channels/102');
  });

  it('omits the credential section when there is no username', () => {
    const url = buildAuthorizedRtspUrl(
      { scheme: 'rtsp://', host: '10.0.0.1', port: 554, pathWithQuery: '/x' },
      { username: '', password: '' },
    );
    expect(url).toBe('rtsp://10.0.0.1:554/x');
  });
});

/* -------------------------------------------------------------------------- */
/* Injected spawner: simulates FFmpeg close with progress + stderr.           */
/* -------------------------------------------------------------------------- */

function fakeSpawn(outcome: { stdout?: string; stderr?: string }): RtspProbeSpawn {
  return (): RtspProbeChild => {
    const stdoutListeners: Array<(d: Buffer) => void> = [];
    const stderrListeners: Array<(d: Buffer) => void> = [];
    let closeListener: (() => void) | null = null;
    setTimeout(() => {
      if (outcome.stdout) stdoutListeners.forEach((l) => l(Buffer.from(outcome.stdout!)));
      if (outcome.stderr) stderrListeners.forEach((l) => l(Buffer.from(outcome.stderr!)));
      closeListener?.();
    }, 1);
    return {
      kill: () => true,
      killed: false,
      stdout: { on: (_e: string, l: (d: Buffer) => void) => { stdoutListeners.push(l); return undefined; } },
      stderr: { on: (_e: string, l: (d: Buffer) => void) => { stderrListeners.push(l); return undefined; } },
      on: (e: string, l: (...a: unknown[]) => void) => { if (e === 'close') closeListener = l as () => void; return undefined; },
    } as unknown as RtspProbeChild;
  };
}

describe('runFfmpegProbe (injected spawn)', () => {
  const base = {
    host: '10.0.0.1',
    port: 554,
    credentials: { username: '', password: '' },
    timeoutMs: 2000,
    probeDurationMs: 800,
  };

  it('resolves success with the decoded frame count', async () => {
    const res = await runFfmpegProbe('ffmpeg', 'rtsp://x', {
      ...base,
      spawnImpl: fakeSpawn({ stdout: 'frame=7\nframe=20\nprogress=end\n' }),
    });
    expect(res.statusCode).toBe(200);
    expect(res.decodedFrames).toBe(20);
    expect(res.authenticated).toBe(true);
  });

  it('rejects with AUTHENTICATION_FAILED on 401', async () => {
    await expect(
      runFfmpegProbe('ffmpeg', 'rtsp://x', {
        ...base,
        spawnImpl: fakeSpawn({ stderr: 'method DESCRIBE failed: 401 Unauthorized' }),
      }),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
  });

  it('rejects with STREAM_NO_MEDIA when reachable but no frames', async () => {
    await expect(
      runFfmpegProbe('ffmpeg', 'rtsp://x', {
        ...base,
        spawnImpl: fakeSpawn({ stderr: 'non-fatal warning' }),
      }),
    ).rejects.toMatchObject({ code: 'STREAM_NO_MEDIA' });
  });
});

describe('FfmpegRtspProbe routing', () => {
  it('describe() probes host:port + path', async () => {
    let seenArgs: string[] = [];
    const spawnImpl: RtspProbeSpawn = (_b, a) => {
      seenArgs = a;
      return fakeSpawn({ stdout: 'frame=3\nprogress=end\n' })('', []);
    };
    const probe = new FfmpegRtspProbe({
      host: '10.0.0.9',
      port: 554,
      credentials: { username: 'admin', password: 'pw' },
      timeoutMs: 2000,
      probeDurationMs: 500,
      spawnImpl,
    });
    const res = await probe.describe('/Streaming/channels/201');
    expect(res.decodedFrames).toBe(3);
    const inputUrl = seenArgs[seenArgs.indexOf('-i') + 1];
    expect(inputUrl).toBe('rtsp://admin:pw@10.0.0.9:554/Streaming/channels/201');
  });
});
