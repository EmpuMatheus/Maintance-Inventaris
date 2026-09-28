import { OnvifError, mapNetworkError, isAuthFault } from './errors';
import {
  buildEnvelope,
  parseXml,
  extractBody,
  extractFault,
  textOf,
  asArray,
} from './soap';
import type {
  OnvifClientConfig,
  OnvifCredentials,
  OnvifDeviceInformation,
  OnvifMediaProfile,
  OnvifServiceInfo,
  OnvifStreamUri,
  OnvifVideoSource,
} from './types';

/**
 * Minimal ONVIF client over plain HTTP SOAP.
 *
 * Implements just the operations the CCTV feature needs:
 *  - GetDeviceInformation (device + test connection)
 *  - GetServices / GetCapabilities (ONVIF service endpoints)
 *  - GetVideoSources, GetProfiles, GetStreamUri (channel sync)
 *
 * This is a standalone, transport-only layer. It knows nothing about the
 * database, DVR/NVR brands, or business rules. The CCTV service composes it.
 */
export class OnvifClient {
  private readonly baseUrl: string;
  private readonly credentials: OnvifCredentials;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: OnvifClientConfig) {
    this.credentials = config.credentials;
    this.timeoutMs = config.timeoutMs ?? 8000;
    this.fetchImpl = config.fetchImpl ?? fetch;
    const scheme = config.https ? 'https' : 'http';
    this.baseUrl = `${scheme}://${config.host}:${config.port}`;
  }

  private async request(
    path: string,
    innerXml: string,
    withSecurity = true,
  ): Promise<Record<string, any>> {
    const body = buildEnvelope(this.credentials, innerXml, withSecurity);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8; action="http://www.onvif.org/ver10/device/wsdl/GetDeviceInformation"',
        },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      throw mapNetworkError(error);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      // Some devices use the HTTP status to signal auth failures.
      if (response.status === 401 || response.status === 403) {
        throw new OnvifError('AUTHENTICATION_FAILED');
      }
      if (response.status === 404) {
        throw new OnvifError('ONVIF_UNAVAILABLE');
      }
      throw new OnvifError('ONVIF_SERVICE_ERROR', `ONVIF service returned HTTP ${response.status}`);
    }

    let xmlText: string;
    try {
      xmlText = await response.text();
    } catch (error) {
      throw mapNetworkError(error);
    }

    const parsed = parseXml(xmlText);
    const bodyObj = extractBody(parsed);
    if (!bodyObj) {
      throw new OnvifError('INVALID_RESPONSE', 'ONVIF response body is empty');
    }

    const fault = extractFault(bodyObj);
    if (fault) {
      if (isAuthFault(fault)) {
        throw new OnvifError('AUTHENTICATION_FAILED', fault, fault);
      }
      throw new OnvifError('ONVIF_SERVICE_ERROR', fault, fault);
    }

    return bodyObj;
  }

  /** ONVIF GetDeviceInformation. */
  async getDeviceInformation(): Promise<OnvifDeviceInformation> {
    const body = await this.request(
      '/onvif/device_service',
      '<tds:GetDeviceInformation/>',
      true,
    );
    const info = (body.GetDeviceInformationResponse ?? {}) as Record<string, unknown>;
    return {
      manufacturer: textOf(info.Manufacturer),
      model: textOf(info.Model),
      firmwareVersion: textOf(info.FirmwareVersion),
      serialNumber: textOf(info.SerialNumber),
      hardwareId: textOf(info.HardwareId),
    };
  }

  /** Lists ONVIF service endpoints exposed by the device. */
  async getServices(): Promise<OnvifServiceInfo[]> {
    try {
      const body = await this.request('/onvif/device_service', '<tds:GetServices><IncludeCapability>true</IncludeCapability></tds:GetServices>', true);
      const services = (body.GetServicesResponse?.Service ?? []) as unknown;
      return asArray(services).map((s) => {
        const node = s as Record<string, unknown>;
        return {
          namespace: textOf(node.Namespace) ?? '',
          xAddr: textOf(node.XAddr) ?? '',
        };
      });
    } catch (error) {
      if (error instanceof OnvifError && error.code === 'ONVIF_SERVICE_ERROR') {
        return [];
      }
      throw error;
    }
  }

  /** Returns the media service XAddr, preferring the standard ONVIF media namespace. */
  private async resolveMediaPath(): Promise<string> {
    try {
      const services = await this.getServices();
      const media = services.find((s) =>
        /\/ver(10|20)\/media\/wsdl/.test(s.namespace) && s.xAddr,
      );
      if (media?.xAddr) {
        return new URL(media.xAddr).pathname;
      }
    } catch {
      // fall through to the conventional path
    }
    return '/onvif/media_service';
  }

  /** ONVIF GetVideoSources (identity of each physical camera/channel). */
  async getVideoSources(): Promise<OnvifVideoSource[]> {
    const path = await this.resolveMediaPath();
    const body = await this.request(path, '<trt:GetVideoSources/>', true);
    const sources = (body.GetVideoSourcesResponse?.VideoSources ?? []) as unknown;
    return asArray(sources).map((s) => {
      const node = s as Record<string, any>;
      const resolution = node.Resolution as Record<string, unknown> | undefined;
      return {
        token: textOf(node['@_token']) ?? textOf(node.token) ?? '',
        sourceToken: textOf(node.SourceToken) ?? null,
        name: textOf(node.Name) ?? null,
        resolution: resolution ? textOf(resolution.Width) + 'x' + textOf(resolution.Height) : null,
      };
    });
  }

  /** ONVIF GetProfiles (media profiles, each potentially a main/sub stream). */
  async getProfiles(): Promise<OnvifMediaProfile[]> {
    const path = await this.resolveMediaPath();
    const body = await this.request(path, '<trt:GetProfiles/>', true);
    const profiles = (body.GetProfilesResponse?.Profiles ?? []) as unknown;
    return asArray(profiles).map((p) => {
      const node = p as Record<string, any>;
      const videoSourceConfig = (node.VideoSourceConfiguration ?? {}) as Record<string, any>;
      const videoEncoderConfig = (node.VideoEncoderConfiguration ?? {}) as Record<string, any>;
      const encoderResolution = videoEncoderConfig.Resolution as Record<string, unknown> | undefined;
      const rateControl = videoEncoderConfig.RateControl as Record<string, unknown> | undefined;
      return {
        token: textOf(node['@_token']) ?? textOf(node.token) ?? '',
        name: textOf(node.Name) ?? null,
        videoSourceToken: textOf(videoSourceConfig.SourceToken) ?? null,
        videoSourceName: textOf(videoSourceConfig.Name) ?? null,
        encoderToken: textOf(videoEncoderConfig['@_token']) ?? null,
        encoding: textOf(videoEncoderConfig.Encoding) ?? null,
        resolution: encoderResolution
          ? textOf(encoderResolution.Width) + 'x' + textOf(encoderResolution.Height)
          : null,
        fps: rateControl?.FrameRateLimit ? Number(textOf(rateControl.FrameRateLimit)) : null,
      };
    });
  }

  /** ONVIF GetStreamUri for a single media profile token. */
  async getStreamUri(profileToken: string): Promise<OnvifStreamUri> {
    const path = await this.resolveMediaPath();
    const inner = `<trt:GetStreamUri><StreamSetup><Stream xmlns="http://www.onvif.org/ver10/schema">RTP-Unicast</Stream><Transport><Protocol>RTSP</Protocol></Transport></StreamSetup><ProfileToken>${profileToken}</ProfileToken></trt:GetStreamUri>`;
    const body = await this.request(path, inner, true);
    const mediaUri = (body.GetStreamUriResponse?.MediaUri ?? {}) as Record<string, unknown>;
    return { uri: textOf(mediaUri.Uri) ?? null };
  }
}
