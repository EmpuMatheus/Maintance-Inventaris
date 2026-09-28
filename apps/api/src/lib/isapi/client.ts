import { IsapiError, mapIsapiNetworkError } from './errors';
import { parseXml, textOf, asArray } from '@/lib/xml';
import { buildDigestAuthorization, parseDigestChallenge } from '@/lib/http-digest';
import type {
  IsapiClientConfig,
  IsapiCredentials,
  IsapiDeviceInformation,
  IsapiStreamingChannel,
} from './types';

/**
 * Minimal Hikvision ISAPI client over HTTP.
 *
 * Implements just the operations the CCTV feature needs:
 *  - GET /ISAPI/System/deviceInfo               (device information)
 *  - GET /ISAPI/Streaming/channels              (streaming channels / discovery)
 *  - GET /ISAPI/ContentMgmt/StreamingProxy/channels (fallback for some NVRs)
 *
 * Authentication is HTTP Digest only (same policy as the RTSP client). A Basic
 * challenge is treated as a failure rather than downgrading the credential.
 *
 * This is a standalone, transport-only layer. It knows nothing about the
 * database or business rules; the integration provider composes it.
 */
export class IsapiClient {
  private readonly baseUrl: string;
  private readonly credentials: IsapiCredentials;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: IsapiClientConfig) {
    this.credentials = config.credentials;
    this.timeoutMs = config.timeoutMs ?? 8000;
    this.fetchImpl = config.fetchImpl ?? fetch;
    const scheme = config.https ?? config.port === 443 ? 'https' : 'http';
    this.baseUrl = `${scheme}://${config.host}:${config.port}`;
  }

  /**
   * Performs a GET, handling the Digest handshake.
   *
   * `path` must include any query string (e.g. `/ISAPI/...channels?format=xml`).
   * The `WWW-Authenticate` challenge is parsed and answered with a digest
   * Authorization header; no credential is ever placed in the URL.
   */
  private async get(path: string): Promise<{ status: number; text: string }> {
    const first = await this.rawGet(path);
    if (first.status !== 401 && first.status !== 403) return first;

    const challenge = parseDigestChallenge(first.wwwAuthenticate);
    if (!challenge || challenge.scheme.toLowerCase() !== 'digest') {
      // No digest challenge (e.g. Basic only) — never downgrade.
      throw new IsapiError('AUTHENTICATION_FAILED');
    }

    const authorization = buildDigestAuthorization(
      this.credentials,
      { uri: path, method: 'GET' },
      challenge,
    );
    const second = await this.rawGet(path, authorization);
    if (second.status === 401 || second.status === 403) {
      throw new IsapiError('AUTHENTICATION_FAILED');
    }
    return second;
  }

  private async rawGet(
    path: string,
    authorization?: string,
  ): Promise<{ status: number; text: string; wwwAuthenticate: string | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: 'GET',
        headers: {
          Accept: 'application/xml, text/xml, */*',
          ...(authorization ? { Authorization: authorization } : {}),
        },
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timer);
      throw mapIsapiNetworkError(error);
    } finally {
      clearTimeout(timer);
    }

    let text = '';
    try {
      text = await response.text();
    } catch (error) {
      throw mapIsapiNetworkError(error);
    }

    return {
      status: response.status,
      text,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    };
  }

  /** Parses an ISAPI XML response body, mapping HTTP errors to IsapiError. */
  private parseResponse(result: { status: number; text: string }, path: string): Record<string, unknown> {
    if (result.status === 401 || result.status === 403) {
      throw new IsapiError('AUTHENTICATION_FAILED', undefined, result.status);
    }
    if (result.status === 404) {
      // The device does not expose this ISAPI endpoint.
      throw new IsapiError('ISAPI_UNAVAILABLE', `ISAPI endpoint not available: ${path}`, result.status);
    }
    if (result.status < 200 || result.status >= 300) {
      throw new IsapiError('ISAPI_SERVICE_ERROR', `ISAPI returned HTTP ${result.status}`, result.status);
    }
    const parsed = parseXml(result.text);
    if (!parsed || Object.keys(parsed).length === 0) {
      throw new IsapiError('INVALID_RESPONSE', 'ISAPI response body is empty');
    }
    return parsed;
  }

  /** GET /ISAPI/System/deviceInfo. */
  async getDeviceInformation(): Promise<IsapiDeviceInformation> {
    const path = '/ISAPI/System/deviceInfo';
    const body = this.parseResponse(await this.get(path), path);
    const info = (body.DeviceInfo ?? {}) as Record<string, unknown>;
    return {
      manufacturer: textOf(info.manufacturer) ?? 'Hikvision',
      model: textOf(info.model),
      firmwareVersion: textOf(info.firmwareVersion),
      serialNumber: textOf(info.serialNumber),
      hardwareId: textOf(info.deviceID),
      deviceName: textOf(info.deviceName),
    };
  }

  /**
   * Discovers streaming channels.
   *
   * Tries `/ISAPI/Streaming/channels` first (the endpoint Hikvision DVRs use).
   * When that endpoint is not available (HTTP 404), falls back to
   * `/ISAPI/ContentMgmt/StreamingProxy/channels`, which some recorders expose.
   *
   * No channel count is assumed: only the ids the device reports are returned.
   */
  async getStreamingChannels(): Promise<IsapiStreamingChannel[]> {
    const endpoints = [
      '/ISAPI/Streaming/channels',
      '/ISAPI/ContentMgmt/StreamingProxy/channels',
    ];

    let lastError: unknown;
    for (const path of endpoints) {
      try {
        const body = this.parseResponse(await this.get(path), path);
        const list = (body.StreamingChannelList ?? {}) as Record<string, unknown>;
        const channels = asArray(list.StreamingChannel as unknown);
        return channels.map((c) => normalizeStreamingChannel(c)).filter((c) => c.id.length > 0);
      } catch (error) {
        if (error instanceof IsapiError && error.code === 'ISAPI_UNAVAILABLE') {
          lastError = error;
          continue;
        }
        throw error;
      }
    }

    if (lastError instanceof IsapiError) throw lastError;
    throw new IsapiError('ISAPI_UNAVAILABLE', 'No ISAPI streaming channel endpoint available.');
  }
}

function normalizeStreamingChannel(node: unknown): IsapiStreamingChannel {
  const n = (node ?? {}) as Record<string, unknown>;
  const transport = (n.Transport ?? {}) as Record<string, unknown>;
  const enabledRaw = textOf(n.enabled);
  return {
    id: textOf(n.id) ?? '',
    channelName: textOf(n.channelName) ?? null,
    rtspPort: transport.rtspPortNo !== undefined ? Number(textOf(transport.rtspPortNo)) : null,
    enabled: enabledRaw === null ? null : enabledRaw.toLowerCase() === 'true',
  };
}
