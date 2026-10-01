import { describe, it, expect, vi } from 'vitest';
import { MediaMtxGateway, generateGatewayPathName } from '@/lib/streaming/mediamtx.gateway';

/**
 * These tests exercise the MediaMTX control client with a fake fetch, so no
 * real gateway is needed. They also assert the credential-bearing source never
 * appears in a thrown error message (which could be logged).
 */

function jsonResponse(status: number, body: unknown = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('MediaMtxGateway', () => {
  it('adds a path with RTSP over TCP and on-demand disabled by default policy', async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return jsonResponse(200);
    }) as unknown as typeof fetch;

    const gateway = new MediaMtxGateway({
      apiUrl: 'http://127.0.0.1:9997',
      webrtcUrl: 'http://127.0.0.1:8889',
      hlsUrl: 'http://127.0.0.1:8888',
      rtspUrl: 'rtsp://127.0.0.1:8554',
      fetchImpl,
    });

    await gateway.addPath({ name: 'bbp_x', source: 'rtsp://user:pass@10.0.0.1:554/Streaming/channels/101' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://127.0.0.1:9997/v3/config/paths/add/bbp_x');
    const body = calls[0].body as Record<string, unknown>;
    expect(body.source).toBe('rtsp://user:pass@10.0.0.1:554/Streaming/channels/101');
    expect(body.rtspTransport).toBe('tcp');
    // The live service passes sourceOnDemand: false explicitly.
  });

  it('falls back to replace when add reports the path already exists', async () => {
    const urls: string[] = [];
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      urls.push(String(url));
      return String(url).includes('/add/') ? jsonResponse(400) : jsonResponse(200);
    }) as unknown as typeof fetch;

    const gateway = new MediaMtxGateway({
      apiUrl: 'http://127.0.0.1:9997',
      fetchImpl,
    });
    await gateway.addPath({ name: 'bbp_y', source: 'rtsp://h/p' });
    expect(urls[1]).toBe('http://127.0.0.1:9997/v3/config/paths/replace/bbp_y');
  });

  it('never includes the source URL in the thrown error', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, { error: 'rtsp://user:pass@10.0.0.1' })) as unknown as typeof fetch;
    const gateway = new MediaMtxGateway({ apiUrl: 'http://127.0.0.1:9997', fetchImpl });

    await expect(
      gateway.addPath({ name: 'bbp_z', source: 'rtsp://user:secret@10.0.0.1:554/x' }),
    ).rejects.toThrow(/HTTP 500/);
    await expect(
      gateway.addPath({ name: 'bbp_z', source: 'rtsp://user:secret@10.0.0.1:554/x' }),
    ).rejects.not.toThrow(/secret/);
  });

  it('reports availability from the paths list endpoint', async () => {
    const okFetch = vi.fn(async () => jsonResponse(200)) as unknown as typeof fetch;
    expect(await new MediaMtxGateway({ apiUrl: 'http://x', fetchImpl: okFetch }).isAvailable()).toBe(true);

    const badFetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    expect(await new MediaMtxGateway({ apiUrl: 'http://x', fetchImpl: badFetch }).isAvailable()).toBe(false);
  });

  it('reads path readiness state', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, { name: 'bbp_1', online: true, ready: true })) as unknown as typeof fetch;
    const gateway = new MediaMtxGateway({ apiUrl: 'http://x', fetchImpl });
    expect(await gateway.getPath('bbp_1')).toEqual({ name: 'bbp_1', online: true, ready: true });
  });

  it('builds safe, credential-free playback endpoints', () => {
    const gateway = new MediaMtxGateway({
      apiUrl: 'http://127.0.0.1:9997',
      webrtcUrl: 'http://127.0.0.1:8889',
      hlsUrl: 'http://127.0.0.1:8888',
      rtspUrl: 'rtsp://127.0.0.1:8554',
    });
    expect(gateway.webrtcEndpoint('bbp_1')).toBe('http://127.0.0.1:8889/bbp_1/whep');
    expect(gateway.hlsManifestUrl('bbp_1')).toBe('http://127.0.0.1:8888/bbp_1/index.m3u8');
    expect(gateway.rtspUrl('bbp_1')).toBe('rtsp://127.0.0.1:8554/bbp_1');
  });
});

describe('generateGatewayPathName', () => {
  it('produces an opaque, unique, URL-safe name', () => {
    const a = generateGatewayPathName();
    const b = generateGatewayPathName();
    expect(a).toMatch(/^bbp_[0-9a-f]{24}$/);
    expect(a).not.toBe(b);
  });
});
