import { describe, it, expect, vi } from 'vitest';
import { OnvifClient } from '@/lib/onvif/client';
import { OnvifError } from '@/lib/onvif/errors';
import { buildEnvelope, parseXml, extractBody, extractFault } from '@/lib/onvif/soap';
import { stripUriCredentials, classifyStreamType, parseFps } from '@/modules/cctv/cctv.helpers';

const DEVICE_INFO_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Body>
    <tds:GetDeviceInformationResponse xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
      <tds:Manufacturer>Hikvision</tds:Manufacturer>
      <tds:Model>DS-7216HGHI</tds:Model>
      <tds:FirmwareVersion>V3.4.0</tds:FirmwareVersion>
      <tds:SerialNumber>SN-12345</tds:SerialNumber>
      <tds:HardwareId>88</tds:HardwareId>
    </tds:GetDeviceInformationResponse>
  </s:Body>
</s:Envelope>`;

const AUTH_FAULT_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Body>
    <s:Fault>
      <s:Code><s:Value>s:Sender</s:Value><s:Subcode><s:Value>ter:NotAuthorized</s:Value></s:Subcode></s:Code>
      <s:Reason><s:Text xml:lang="en">Sender not Authorized</s:Text></s:Reason>
    </s:Fault>
  </s:Body>
</s:Envelope>`;

const PROFILES_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope">
  <s:Body>
    <trt:GetProfilesResponse xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
      <trt:Profiles token="Profile_1" fixed="true">
        <tt:Name>mainStream</tt:Name>
        <tt:VideoSourceConfiguration token="VSC1">
          <tt:Name>VideoSource</tt:Name>
          <tt:SourceToken>VideoSource_1</tt:SourceToken>
        </tt:VideoSourceConfiguration>
        <tt:VideoEncoderConfiguration token="VEC1">
          <tt:Encoding>H264</tt:Encoding>
          <tt:Resolution><tt:Width>1920</tt:Width><tt:Height>1080</tt:Height></tt:Resolution>
          <tt:RateControl><tt:FrameRateLimit>25</tt:FrameRateLimit></tt:RateControl>
        </tt:VideoEncoderConfiguration>
      </trt:Profiles>
      <trt:Profiles token="Profile_2" fixed="true">
        <tt:Name>subStream</tt:Name>
        <tt:VideoSourceConfiguration token="VSC1">
          <tt:SourceToken>VideoSource_1</tt:SourceToken>
        </tt:VideoSourceConfiguration>
        <tt:VideoEncoderConfiguration token="VEC2">
          <tt:Encoding>H264</tt:Encoding>
          <tt:Resolution><tt:Width>640</tt:Width><tt:Height>480</tt:Height></tt:Resolution>
        </tt:VideoEncoderConfiguration>
      </trt:Profiles>
    </trt:GetProfilesResponse>
  </s:Body>
</s:Envelope>`;

function mockFetch(body: string, status = 200) {
  return vi.fn(async () => new Response(body, { status, headers: { 'Content-Type': 'application/soap+xml' } })) as unknown as typeof fetch;
}

function client(fetchImpl: typeof fetch) {
  return new OnvifClient({
    host: '192.168.2.10',
    port: 80,
    credentials: { username: 'admin', password: 'secret' },
    fetchImpl,
    timeoutMs: 1000,
  });
}

describe('ONVIF soap helpers', () => {
  it('parses a SOAP envelope and extracts the body', () => {
    const parsed = parseXml(DEVICE_INFO_RESPONSE);
    const body = extractBody(parsed);
    expect(body).toBeTruthy();
    expect(body!.GetDeviceInformationResponse.Manufacturer).toBe('Hikvision');
  });

  it('extracts an authentication fault', () => {
    const body = extractBody(parseXml(AUTH_FAULT_RESPONSE));
    const fault = extractFault(body);
    expect(fault).toMatch(/NotAuthorized/i);
  });

  it('builds a WS-Security envelope without leaking the password as plaintext', () => {
    const envelope = buildEnvelope({ username: 'admin', password: 'secret' }, '<tds:GetDeviceInformation/>');
    expect(envelope).toContain('PasswordDigest');
    expect(envelope).not.toContain('<Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">secret');
  });
});

describe('OnvifClient', () => {
  it('returns device information on success', async () => {
    const c = client(mockFetch(DEVICE_INFO_RESPONSE));
    const info = await c.getDeviceInformation();
    expect(info).toEqual({
      manufacturer: 'Hikvision',
      model: 'DS-7216HGHI',
      firmwareVersion: 'V3.4.0',
      serialNumber: 'SN-12345',
      hardwareId: '88',
    });
  });

  it('maps a SOAP auth fault to AUTHENTICATION_FAILED', async () => {
    const c = client(mockFetch(AUTH_FAULT_RESPONSE));
    await expect(c.getDeviceInformation()).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
  });

  it('maps HTTP 401 to AUTHENTICATION_FAILED', async () => {
    const c = client(mockFetch('', 401));
    await expect(c.getDeviceInformation()).rejects.toMatchObject({ code: 'AUTHENTICATION_FAILED' });
  });

  it('maps HTTP 404 to ONVIF_UNAVAILABLE', async () => {
    const c = client(mockFetch('', 404));
    await expect(c.getDeviceInformation()).rejects.toMatchObject({ code: 'ONVIF_UNAVAILABLE' });
  });

  it('maps a refused connection to PORT_UNREACHABLE', async () => {
    const impl = vi.fn(async () => {
      const e = new Error('connect ECONNREFUSED') as Error & { code?: string };
      e.code = 'ECONNREFUSED';
      throw e;
    }) as unknown as typeof fetch;
    const c = client(impl);
    await expect(c.getDeviceInformation()).rejects.toMatchObject({ code: 'PORT_UNREACHABLE' });
  });

  it('maps a host-unreachable error to DEVICE_UNREACHABLE', async () => {
    const impl = vi.fn(async () => {
      const e = new Error('no route') as Error & { code?: string };
      e.code = 'EHOSTUNREACH';
      throw e;
    }) as unknown as typeof fetch;
    const c = client(impl);
    await expect(c.getDeviceInformation()).rejects.toMatchObject({ code: 'DEVICE_UNREACHABLE' });
  });

  it('maps an aborted request to CONNECTION_TIMEOUT', async () => {
    const impl = vi.fn(async () => {
      const e = new Error('aborted') as Error;
      e.name = 'AbortError';
      throw e;
    }) as unknown as typeof fetch;
    const c = client(impl);
    await expect(c.getDeviceInformation()).rejects.toMatchObject({ code: 'CONNECTION_TIMEOUT' });
  });

  it('parses profiles including H.264 codec and resolution', async () => {
    const c = client(mockFetch(PROFILES_RESPONSE));
    const profiles = await c.getProfiles();
    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toMatchObject({
      token: 'Profile_1',
      name: 'mainStream',
      videoSourceToken: 'VideoSource_1',
      encoding: 'H264',
      resolution: '1920x1080',
      fps: 25,
    });
    expect(profiles[1]).toMatchObject({ token: 'Profile_2', name: 'subStream', videoSourceToken: 'VideoSource_1' });
  });
});

describe('OnvifError taxonomy', () => {
  it('provides a readable label', () => {
    expect(new OnvifError('AUTHENTICATION_FAILED').label).toBe('Authentication failed');
    expect(new OnvifError('DEVICE_UNREACHABLE').label).toBe('Device unreachable');
  });
});

describe('cctv helpers', () => {
  it('strips embedded credentials from RTSP URIs', () => {
    expect(stripUriCredentials('rtsp://admin:pass@10.0.0.5:554/Streaming/Channels/101')).toBe(
      'rtsp://10.0.0.5:554/Streaming/Channels/101',
    );
    expect(stripUriCredentials(null)).toBeNull();
  });

  it('classifies main/sub stream profiles without assuming numbering', () => {
    expect(classifyStreamType('mainStream', 'H264', null, 0)).toBe('MAIN');
    expect(classifyStreamType('subStream', 'H264', null, 1)).toBe('SUB');
    expect(classifyStreamType(null, 'H264', null, 0)).toBe('MAIN');
    expect(classifyStreamType('Third', 'H264', null, 2)).toBe('OTHER');
  });

  it('parses fps safely', () => {
    expect(parseFps(25)).toBe(25);
    expect(parseFps('30')).toBe(30);
    expect(parseFps(null)).toBeNull();
    expect(parseFps('abc')).toBeNull();
  });
});
