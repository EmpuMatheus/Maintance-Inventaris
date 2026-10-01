import { describe, it, expect } from 'vitest';
import {
  resolveIntegrationProtocol,
  resolveDeviceProtocol,
  isHikvision,
} from '@/modules/cctv/integration/protocol';
import {
  fromIsapiError,
  fromOnvifError,
  toIntegrationError,
  IntegrationError,
} from '@/lib/integration/errors';
import { IsapiError } from '@/lib/isapi/errors';
import { OnvifError } from '@/lib/onvif/errors';
import { XmeyeOnvifProvider } from '@/modules/cctv/integration/onvif.provider';
import type { CctvOnvifClient } from '@/modules/cctv/integration/onvif-client';

describe('integration protocol resolution (provider selection)', () => {
  it('selects ISAPI for Hikvision devices', () => {
    expect(resolveIntegrationProtocol({ brand: 'Hikvision', deviceType: 'DVR' })).toBe('ISAPI');
    expect(resolveIntegrationProtocol({ brand: 'HIKVISION', deviceType: 'NVR' })).toBe('ISAPI');
    expect(resolveIntegrationProtocol({ brand: null, model: 'DS-7216HGHI-K1' })).toBe('ISAPI');
    expect(isHikvision({ brand: 'Hikvision' })).toBe(true);
  });

  it('selects ONVIF for XMEye devices', () => {
    expect(resolveIntegrationProtocol({ brand: 'XMEye', deviceType: 'NVR' })).toBe('ONVIF');
    expect(resolveIntegrationProtocol({ brand: 'XM', deviceType: 'NVR' })).toBe('ONVIF');
    expect(resolveIntegrationProtocol({ brand: 'xiong mai' })).toBe('ONVIF');
    expect(isHikvision({ brand: 'XMEye' })).toBe(false);
  });

  it('defaults to ONVIF for unknown vendors (generic standard)', () => {
    expect(resolveIntegrationProtocol({ brand: 'Generic', deviceType: 'DVR' })).toBe('ONVIF');
    expect(resolveIntegrationProtocol({ brand: null, deviceType: 'DVR' })).toBe('ONVIF');
  });

  it('prefers the persisted protocol over re-derivation (sticky)', () => {
    // Auto-filled brand must not switch a persisted ONVIF device to ISAPI.
    expect(
      resolveDeviceProtocol({ integrationProtocol: 'ONVIF', brand: 'Hikvision', deviceType: 'DVR' }),
    ).toBe('ONVIF');
    expect(
      resolveDeviceProtocol({ integrationProtocol: 'ISAPI', brand: 'XMEye', deviceType: 'NVR' }),
    ).toBe('ISAPI');
    // Legacy rows with no persisted value fall back to vendor derivation.
    expect(resolveDeviceProtocol({ brand: 'Hikvision' })).toBe('ISAPI');
  });

  it('handles invalid configuration gracefully (empty object -> ONVIF)', () => {
    expect(resolveIntegrationProtocol({})).toBe('ONVIF');
  });
});

describe('integration error normalisation', () => {
  it('maps ISAPI errors to the neutral taxonomy', () => {
    expect(fromIsapiError(new IsapiError('DEVICE_UNREACHABLE')).code).toBe('DEVICE_UNREACHABLE');
    expect(fromIsapiError(new IsapiError('CONNECTION_TIMEOUT')).code).toBe('CONNECTION_TIMEOUT');
    expect(fromIsapiError(new IsapiError('AUTHENTICATION_FAILED')).code).toBe('AUTHENTICATION_FAILED');
    expect(fromIsapiError(new IsapiError('ISAPI_UNAVAILABLE')).code).toBe('ISAPI_UNAVAILABLE');
    expect(fromIsapiError(new IsapiError('ISAPI_SERVICE_ERROR')).code).toBe('PROTOCOL_SERVICE_ERROR');
    expect(fromIsapiError(new IsapiError('INVALID_RESPONSE')).code).toBe('INVALID_RESPONSE');
  });

  it('maps ONVIF errors to the neutral taxonomy', () => {
    expect(fromOnvifError(new OnvifError('PORT_UNREACHABLE')).code).toBe('ONVIF_UNAVAILABLE');
    expect(fromOnvifError(new OnvifError('ONVIF_SERVICE_ERROR')).code).toBe('PROTOCOL_SERVICE_ERROR');
    expect(fromOnvifError(new OnvifError('AUTHENTICATION_FAILED')).code).toBe('AUTHENTICATION_FAILED');
  });

  it('coerces unknown errors and passes through IntegrationError', () => {
    expect(toIntegrationError(new Error('boom')).code).toBe('UNKNOWN_ERROR');
    const known = new IntegrationError('DEVICE_UNREACHABLE');
    expect(toIntegrationError(known)).toBe(known);
    expect(toIntegrationError(new IsapiError('ISAPI_UNAVAILABLE')).code).toBe('ISAPI_UNAVAILABLE');
  });
});

/** Fake ONVIF client with two video sources, one carrying main+sub profiles. */
class FakeOnvif implements CctvOnvifClient {
  async getDeviceInformation() {
    return { manufacturer: 'XMEye', model: 'NVR-8', firmwareVersion: '1.0', serialNumber: 'S', hardwareId: 'H' };
  }
  async getServices() {
    return [{ namespace: 'http://www.onvif.org/ver10/media/wsdl', xAddr: 'http://host/onvif/media_service' }];
  }
  async getVideoSources() {
    return [
      { token: 'VS_1', sourceToken: null, name: 'Cam 1', resolution: null },
      { token: 'VS_2', sourceToken: null, name: 'Cam 2', resolution: null },
    ];
  }
  async getProfiles() {
    return [
      { token: 'P1', name: 'mainStream', videoSourceToken: 'VS_1', videoSourceName: null, encoderToken: null, encoding: 'H264', resolution: '1920x1080', fps: 25 },
      { token: 'P2', name: 'subStream', videoSourceToken: 'VS_1', videoSourceName: null, encoderToken: null, encoding: 'H264', resolution: '640x480', fps: 15 },
      { token: 'P3', name: 'mainStream', videoSourceToken: 'VS_2', videoSourceName: null, encoderToken: null, encoding: 'H265', resolution: '2560x1440', fps: 30 },
    ];
  }
  async getStreamUri(token: string) {
    return { uri: `rtsp://10.0.0.9:554/onvif/profile/${token}` };
  }
}

describe('XmeyeOnvifProvider', () => {
  it('exposes the ONVIF protocol', () => {
    const provider = new XmeyeOnvifProvider(new FakeOnvif());
    expect(provider.protocol).toBe('ONVIF');
  });

  it('groups profiles by video source (not profile count)', async () => {
    const provider = new XmeyeOnvifProvider(new FakeOnvif());
    const channels = await provider.discoverChannels();
    expect(channels).toHaveLength(2);
    expect(channels[0].externalId).toBe('VS_1');
    expect(channels[0].technicalName).toBe('Cam 1');
    expect(channels[0].profiles).toHaveLength(2);
    expect(channels[1].profiles).toHaveLength(1);
  });

  it('returns device information', async () => {
    const provider = new XmeyeOnvifProvider(new FakeOnvif());
    const info = await provider.getDeviceInformation();
    expect(info.manufacturer).toBe('XMEye');
    expect(info.model).toBe('NVR-8');
  });

  it('resolves RTSP targets from ONVIF stream URIs', async () => {
    const provider = new XmeyeOnvifProvider(new FakeOnvif());
    const targets = await provider.resolveRtspTargets({
      channel: 1,
      kinds: ['main', 'sub'],
      storedProfiles: [
        { profileToken: 'P1', streamUri: 'rtsp://10.0.0.9:554/onvif/profile/P1', streamType: 'MAIN', isMainStream: true },
        { profileToken: 'P2', streamUri: 'rtsp://10.0.0.9:554/onvif/profile/P2', streamType: 'SUB', isMainStream: false },
      ],
    });
    expect(targets.map((t) => t.uri)).toEqual([
      'rtsp://10.0.0.9:554/onvif/profile/P1',
      'rtsp://10.0.0.9:554/onvif/profile/P2',
    ]);
    // Never a Hikvision path.
    expect(targets.every((t) => !t.path)).toBe(true);
  });

  it('resolves a single credential-free stream source for Live View', async () => {
    const provider = new XmeyeOnvifProvider(new FakeOnvif());
    const source = await provider.resolveStreamSource({
      channel: 1,
      kind: 'main',
      storedProfiles: [
        { profileToken: 'P1', streamUri: 'rtsp://admin:pass@10.0.0.9:554/onvif/profile/P1', streamType: 'MAIN', isMainStream: true },
      ],
    });
    expect(source.uri).toBe('rtsp://10.0.0.9:554/onvif/profile/P1');
    expect(source.uri).not.toContain('admin');
    expect(source.path).toBeUndefined();
  });
});
