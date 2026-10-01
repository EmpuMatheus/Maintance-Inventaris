import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { PassThrough } from 'node:stream';
import type { Request, Response } from 'express';
import postgres from 'postgres';
import { env } from '@/config/env';
import * as svc from '@/modules/cctv/cctv.service';
import * as repo from '@/modules/cctv/cctv.repository';
import * as live from '@/modules/cctv/cctv.live.service';
import * as liveCtrl from '@/modules/cctv/cctv.live.controller';
import { setStreamingGatewayFactory, resetStreamingGatewayFactory } from '@/lib/streaming';
import type { StreamingGateway, GatewayPathConfig } from '@/lib/streaming/types';

const sql = postgres(env.DATABASE_URL, { max: 1 });
const RUN = Date.now().toString(36);

let deviceId: string;
let channelId: string;
let liveSessionId: string;
let fakeGateway: FakeGateway;

/** Fake gateway with a fixed WHEP/HLS base so URL rewriting is deterministic. */
class FakeGateway implements StreamingGateway {
  readonly paths = new Map<string, GatewayPathConfig>();
  async isAvailable() {
    return true;
  }
  async addPath(config: GatewayPathConfig) {
    this.paths.set(config.name, config);
  }
  async removePath(name: string) {
    this.paths.delete(name);
  }
  async getPath(name: string) {
    return this.paths.has(name) ? { name, online: true, ready: true } : null;
  }
  webrtcEndpoint(name: string) {
    return `http://127.0.0.1:8889/${name}/whep`;
  }
  hlsManifestUrl(name: string) {
    return `http://127.0.0.1:8888/${name}/index.m3u8`;
  }
  rtspUrl(name: string) {
    return `rtsp://127.0.0.1:8554/${name}`;
  }
}

/** Minimal Express response double: a real Writable with header/status helpers. */
function mockRes() {
  const res = new PassThrough() as PassThrough & {
    statusCode: number;
    headers: Record<string, string>;
    body: unknown;
    setHeader: (k: string, v: string) => void;
    status: (code: number) => unknown;
    json: (payload: unknown) => unknown;
  };
  res.statusCode = 0;
  res.headers = {};
  res.body = null;
  res.setHeader = (k: string, v: string) => {
    res.headers[k.toLowerCase()] = v;
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: unknown) => {
    res.body = payload;
    res.end();
    return res;
  };
  return res;
}

function mockReq(overrides: Partial<Request>): Request {
  return {
    method: 'POST',
    url: '/',
    params: { id: liveSessionId },
    headers: {},
    body: undefined,
    [Symbol.asyncIterator]: async function* () {},
    ...overrides,
  } as unknown as Request;
}

beforeAll(async () => {
  const device = await svc.create({
    name: `QA Proxy Hikvision ${RUN}`,
    deviceType: 'DVR',
    brand: 'Hikvision',
    ipAddress: `10.66.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    port: 82,
    rtspPort: 554,
    username: 'admin',
    password: 'pw',
  });
  deviceId = device!.id as string;
  const channel = await repo.upsertChannelTechnical(deviceId, 1, {
    deviceChannelId: '1',
    technicalName: 'Cam 1',
    cameraIp: null,
    status: 'ONLINE',
    lastSyncAt: new Date(),
  });
  channelId = channel!.id as string;
});

afterAll(async () => {
  await sql`DELETE FROM cctv_devices WHERE id = ${deviceId}`;
  await sql.end();
});

beforeEach(async () => {
  await sql`DELETE FROM cctv_live_sessions WHERE device_id = ${deviceId}`;
  fakeGateway = new FakeGateway();
  setStreamingGatewayFactory(() => fakeGateway);
});

afterEach(() => {
  resetStreamingGatewayFactory();
  vi.restoreAllMocks();
});

describe('cctv live proxy - WHEP', () => {
  it('forwards signalling to the gateway path and rewrites Location to the API proxy', async () => {
    const view = await live.createLiveSession({ deviceId, channelId, streamKind: 'MAIN', userId: null });
    liveSessionId = view.id;
    // Point the stored session at our fixed path so assertions are stable.
    const row = await repo.findLiveSessionById(view.id);
    const realPath = row!.gatewayPath as string;

    const captured: string[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      captured.push(String(url));
      return new Response('answer-sdp', {
        status: 201,
        headers: { Location: `http://127.0.0.1:8889/${realPath}/whep/sess123` },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const req = mockReq({ method: 'POST', url: '/', headers: { 'content-type': 'application/sdp' }, body: Buffer.from('offer-sdp') });
    const res = mockRes();
    await liveCtrl.whepProxyController(req, res, () => {});

    const target = captured[captured.length - 1];
    // The proxy targets the media server (WHEP), never the control API.
    expect(target).not.toContain('/v3');
    expect(target).toContain(`/${realPath}/whep`);
    expect(res.statusCode).toBe(201);
    // The browser is told to continue through the API, never the loopback host.
    expect(res.headers['location']).toBe(`/api/v1/cctv/live-sessions/${view.id}/whep/sess123`);
    expect(res.headers['location']).not.toContain('127.0.0.1');
  });

  it('returns 404 for a nonexistent session before touching the gateway', async () => {
    liveSessionId = '00000000-0000-0000-0000-000000000000';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    let error: unknown;
    const req = mockReq({ method: 'POST', url: '/', body: Buffer.from('x') });
    await liveCtrl.whepProxyController(req, mockRes(), (e) => {
      error = e;
    });
    expect((error as { statusCode?: number })?.statusCode).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('cctv live proxy - HLS', () => {
  it('proxies the manifest request to the gateway HLS path', async () => {
    const view = await live.createLiveSession({ deviceId, channelId, streamKind: 'SUB', userId: null });
    liveSessionId = view.id;
    const row = await repo.findLiveSessionById(view.id);
    const realPath = row!.gatewayPath as string;

    const captured: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        captured.push(String(url));
        return new Response('#EXTM3U', { status: 200, headers: { 'content-type': 'application/vnd.apple.mpegurl' } });
      }),
    );

    const req = mockReq({ method: 'GET', url: '/', body: undefined });
    const res = mockRes();
    await liveCtrl.hlsProxyController(req, res, () => {});

    expect(captured[captured.length - 1]).toBe(`http://127.0.0.1:8888/${realPath}/index.m3u8`);
    expect(res.statusCode).toBe(200);
  });

  it('rejects non-GET methods', async () => {
    const req = mockReq({ method: 'POST', url: '/' });
    const res = mockRes();
    await liveCtrl.hlsProxyController(req, res, () => {});
    expect(res.statusCode).toBe(405);
  });

  it('answers MediaMTX HLS cookie challenge server-side (302 -> 200)', async () => {
    const view = await live.createLiveSession({ deviceId, channelId, streamKind: 'MAIN', userId: null });
    liveSessionId = view.id;
    const row = await repo.findLiveSessionById(view.id);
    const realPath = row!.gatewayPath as string;

    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        call += 1;
        if (call === 1) {
          return new Response(null, {
            status: 302,
            headers: {
              location: `/${realPath}/index.m3u8?cookieCheck=1`,
              'set-cookie': 'cookieCheck=1; HttpOnly; Secure; SameSite=None; Partitioned',
            },
          });
        }
        return new Response('#EXTM3U\n#EXTINF:1.0,\nseg0.ts\n', {
          status: 200,
          headers: { 'content-type': 'application/vnd.apple.mpegurl' },
        });
      }),
    );

    const req = mockReq({ method: 'GET', url: '/', body: undefined });
    const res = mockRes();
    const chunks: Buffer[] = [];
    res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
    await liveCtrl.hlsProxyController(req, res, () => {});
    await new Promise((r) => setTimeout(r, 50));

    expect(call).toBe(2); // followed the challenge
    expect(res.statusCode).toBe(200);
    expect(Buffer.concat(chunks).toString()).toContain('#EXTM3U');
  });
});
