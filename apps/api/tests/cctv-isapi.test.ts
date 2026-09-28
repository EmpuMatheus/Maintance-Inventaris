import { describe, it, expect, vi } from 'vitest';
import { IsapiClient } from '@/lib/isapi';
import { IsapiError, mapIsapiNetworkError } from '@/lib/isapi/errors';
import { HikvisionIsapiProvider, parseHikvisionStreamId } from '@/modules/cctv/integration/hikvision.provider';

const DEVICE_INFO_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<DeviceInfo xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <deviceName>DVR-LOBBY</deviceName>
  <deviceID>SN-ISAPI-123</deviceID>
  <model>DS-7216HGHI-K1</model>
  <serialNumber>SN-ISAPI-123</serialNumber>
  <firmwareVersion>V4.30.000</firmwareVersion>
  <manufacturer>Hikvision</manufacturer>
</DeviceInfo>`;

const CHANNELS_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<StreamingChannelList xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <StreamingChannel>
    <id>101</id>
    <channelName>Camera 1</channelName>
    <enabled>true</enabled>
    <Transport><rtspPortNo>554</rtspPortNo></Transport>
  </StreamingChannel>
  <StreamingChannel>
    <id>102</id>
    <channelName>Camera 1</channelName>
    <enabled>true</enabled>
  </StreamingChannel>
  <StreamingChannel>
    <id>201</id>
    <channelName>Camera 2</channelName>
    <enabled>true</enabled>
  </StreamingChannel>
</StreamingChannelList>`;

function mockFetch(body: string, status = 200, headers: Record<string, string> = {}) {
  return vi.fn(
    async () => new Response(body, { status, headers: { 'Content-Type': 'application/xml', ...headers } }),
  ) as unknown as typeof fetch;
}

function client(fetchImpl: typeof fetch) {
  return new IsapiClient({
    host: '192.168.2.10',
    port: 80,
    credentials: { username: 'admin', password: 'secret' },
    fetchImpl,
    timeoutMs: 1000,
  });
}

describe('Hikvision streaming id parsing', () => {
  it('parses channel and stream digit', () => {
    expect(parseHikvisionStreamId('101')).toEqual({ channel: 1, streamDigit: '01' });
    expect(parseHikvisionStreamId('102')).toEqual({ channel: 1, streamDigit: '02' });
    expect(parseHikvisionStreamId('1601')).toEqual({ channel: 16, streamDigit: '01' });
    expect(parseHikvisionStreamId('abc')).toBeNull();
    expect(parseHikvisionStreamId('0')).toBeNull();
  });
});

describe('IsapiClient', () => {
  it('returns device information on success', async () => {
    const c = client(mockFetch(DEVICE_INFO_RESPONSE));
    const info = await c.getDeviceInformation();
    expect(info).toEqual({
      manufacturer: 'Hikvision',
      model: 'DS-7216HGHI-K1',
      firmwareVersion: 'V4.30.000',
      serialNumber: 'SN-ISAPI-123',
      hardwareId: 'SN-ISAPI-123',
      deviceName: 'DVR-LOBBY',
    });
  });

  it('answers a digest challenge and does not send plaintext credentials', async () => {
    const calls: Array<{ auth?: string }> = [];
    const impl = vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      calls.push({ auth });
      if (!auth) {
        return new Response('', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Digest realm="IP Camera", nonce="abc", qop="auth"' },
        });
      }
      return new Response(DEVICE_INFO_RESPONSE, { status: 200 });
    }) as unknown as typeof fetch;

    const c = client(impl);
    const info = await c.getDeviceInformation();
    expect(info.model).toBe('DS-7216HGHI-K1');
    expect(calls[0].auth).toBeUndefined();
    expect(calls[1].auth).toMatch(/^Digest /);
    expect(calls[1].auth).not.toContain('secret');
  });

  it('maps HTTP 401 with no digest challenge to AUTHENTICATION_FAILED', async () => {
    const c = client(mockFetch('', 401, { 'WWW-Authenticate': 'Basic realm="cam"' }));
    await expect(c.getDeviceInformation()).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
  });

  it('maps a rejected digest (second 401) to AUTHENTICATION_FAILED', async () => {
    const impl = vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (!auth) {
        return new Response('', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Digest realm="cam", nonce="n"' },
        });
      }
      return new Response('', { status: 401 });
    }) as unknown as typeof fetch;
    const c = client(impl);
    await expect(c.getDeviceInformation()).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
  });

  it('maps HTTP 404 to ISAPI_UNAVAILABLE', async () => {
    const c = client(mockFetch('', 404));
    await expect(c.getDeviceInformation()).rejects.toMatchObject({ code: 'ISAPI_UNAVAILABLE' });
  });

  it('discovers streaming channels from /ISAPI/Streaming/channels', async () => {
    const c = client(mockFetch(CHANNELS_RESPONSE));
    const channels = await c.getStreamingChannels();
    expect(channels).toHaveLength(3);
    expect(channels[0]).toMatchObject({ id: '101', channelName: 'Camera 1', enabled: true });
  });

  it('falls back to ContentMgmt/StreamingProxy when Streaming/channels is absent', async () => {
    const impl = vi.fn(async (url: string) => {
      if (String(url).includes('/ContentMgmt/StreamingProxy/channels')) {
        return new Response(CHANNELS_RESPONSE, { status: 200 });
      }
      return new Response('', { status: 404 });
    }) as unknown as typeof fetch;
    const c = client(impl);
    const channels = await c.getStreamingChannels();
    expect(channels.map((ch) => ch.id)).toEqual(['101', '102', '201']);
  });

  it('classifies a refused connection as ISAPI_UNAVAILABLE', async () => {
    const impl = vi.fn(async () => {
      const e = new Error('connect ECONNREFUSED') as Error & { code?: string };
      e.code = 'ECONNREFUSED';
      throw e;
    }) as unknown as typeof fetch;
    const c = client(impl);
    await expect(c.getDeviceInformation()).rejects.toMatchObject({ code: 'ISAPI_UNAVAILABLE' });
  });

  it('maps an aborted request to CONNECTION_TIMEOUT', async () => {
    const impl = vi.fn(async () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    }) as unknown as typeof fetch;
    const c = client(impl);
    await expect(c.getDeviceInformation()).rejects.toMatchObject({ code: 'CONNECTION_TIMEOUT' });
  });
});

describe('IsapiError taxonomy', () => {
  it('provides readable labels', () => {
    expect(new IsapiError('DEVICE_UNREACHABLE').label).toBe('Device unreachable');
    expect(new IsapiError('ISAPI_UNAVAILABLE').label).toBe('ISAPI unavailable');
  });

  it('maps network errors', () => {
    expect(mapIsapiNetworkError(Object.assign(new Error('x'), { code: 'EHOSTUNREACH' })).code).toBe(
      'DEVICE_UNREACHABLE',
    );
    expect(mapIsapiNetworkError(Object.assign(new Error('x'), { code: 'ECONNRESET' })).code).toBe(
      'ISAPI_UNAVAILABLE',
    );
  });
});

describe('HikvisionIsapiProvider', () => {
  it('groups stream ids by physical channel (1..N from device data)', async () => {
    const provider = new HikvisionIsapiProvider(client(mockFetch(CHANNELS_RESPONSE)));
    const channels = await provider.discoverChannels();
    expect(channels).toHaveLength(2);
    expect(channels[0].channelNumber).toBe(1);
    expect(channels[0].externalId).toBe('1');
    expect(channels[0].technicalName).toBe('Camera 1');
    expect(channels[0].profiles).toHaveLength(2);
    expect(channels[0].profiles.map((p) => p.streamType)).toEqual(['MAIN', 'SUB']);
    expect(channels[1].channelNumber).toBe(2);
  });

  it('resolves Hikvision RTSP path targets', async () => {
    const provider = new HikvisionIsapiProvider(client(mockFetch(CHANNELS_RESPONSE)));
    const targets = await provider.resolveRtspTargets({
      channel: 2,
      kinds: ['main', 'sub'],
      storedProfiles: [],
    });
    expect(targets.map((t) => t.path)).toEqual([
      '/Streaming/channels/201',
      '/Streaming/channels/202',
    ]);
  });

  it('maps ISAPI auth failure through getDeviceInformation', async () => {
    const provider = new HikvisionIsapiProvider(client(mockFetch('', 401, { 'WWW-Authenticate': 'Basic' })));
    await expect(provider.getDeviceInformation()).rejects.toMatchObject({
      code: 'AUTHENTICATION_FAILED',
    });
  });
});
