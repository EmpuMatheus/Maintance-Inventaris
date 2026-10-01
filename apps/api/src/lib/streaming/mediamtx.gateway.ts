import { randomBytes } from 'node:crypto';
import { streamingGatewayConfig } from '@/config/env';
import { logger } from '@/lib/logger';
import type {
  GatewayPathConfig,
  GatewayPathState,
  StreamingGateway,
} from './types';

/**
 * MediaMTX-backed streaming gateway.
 *
 * Talks to the MediaMTX Control API (`/v3/config/paths/...`). The credential-
 * bearing RTSP source is placed in the path configuration but never logged: on
 * any error only the path name and a generic message are emitted.
 *
 * The gateway binds to localhost by default, so this client is an internal
 * control-plane dependency — not something the browser ever reaches.
 */
export class MediaMtxGateway implements StreamingGateway {
  private readonly apiUrl: string;
  private readonly webrtcUrl: string;
  private readonly hlsUrl: string;
  private readonly rtspUrlBase: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    options: {
      apiUrl?: string;
      webrtcUrl?: string;
      hlsUrl?: string;
      rtspUrl?: string;
      fetchImpl?: typeof fetch;
      timeoutMs?: number;
    } = {},
  ) {
    this.apiUrl = trimSlash(options.apiUrl ?? streamingGatewayConfig.apiUrl);
    this.webrtcUrl = trimSlash(options.webrtcUrl ?? streamingGatewayConfig.webrtcUrl);
    this.hlsUrl = trimSlash(options.hlsUrl ?? streamingGatewayConfig.hlsUrl);
    this.rtspUrlBase = trimSlash(options.rtspUrl ?? streamingGatewayConfig.rtspUrl);
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(`${this.apiUrl}${path}`, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await this.request('GET', '/v3/paths/list');
      return res.ok;
    } catch {
      return false;
    }
  }

  async addPath(config: GatewayPathConfig): Promise<void> {
    const body = {
      source: config.source,
      sourceOnDemand: config.sourceOnDemand ?? true,
      rtspTransport: config.rtspTransport ?? 'tcp',
      sourceOnDemandStartTimeout: `${config.sourceOnDemandStartTimeoutSeconds ?? 10}s`,
      sourceOnDemandCloseAfter: `${config.sourceOnDemandCloseAfterSeconds ?? 10}s`,
    };
    const name = encodeURIComponent(config.name);
    // `add` fails when the path already exists; `replace` fails when it does
    // not. Try add first, then replace, so both fresh and reused names work.
    const added = await this.request('POST', `/v3/config/paths/add/${name}`, body);
    if (added.ok) return;
    const replaced = await this.request('POST', `/v3/config/paths/replace/${name}`, body);
    if (!replaced.ok) {
      // Never surface the body (it may echo the source URL); log a safe summary.
      logger.warn({ path: config.name, status: replaced.status }, 'Streaming gateway addPath failed');
      throw new Error(`Streaming gateway rejected path (HTTP ${replaced.status}).`);
    }
  }

  async removePath(name: string): Promise<void> {
    try {
      await this.request('DELETE', `/v3/config/paths/delete/${encodeURIComponent(name)}`);
    } catch {
      // Best-effort cleanup; a missing path or an unreachable gateway is fine.
    }
  }

  async getPath(name: string): Promise<GatewayPathState | null> {
    try {
      const res = await this.request('GET', `/v3/paths/get/${encodeURIComponent(name)}`);
      if (res.status === 404) return null;
      if (!res.ok) return null;
      const data = (await res.json()) as { online?: unknown; ready?: unknown; name?: unknown };
      return {
        name: typeof data.name === 'string' ? data.name : name,
        online: data.online === true,
        ready: data.ready === true,
      };
    } catch {
      return null;
    }
  }

  webrtcEndpoint(name: string): string {
    return `${this.webrtcUrl}/${encodeURIComponent(name)}/whep`;
  }

  hlsManifestUrl(name: string): string {
    return `${this.hlsUrl}/${encodeURIComponent(name)}/index.m3u8`;
  }

  rtspUrl(name: string): string {
    return `${this.rtspUrlBase}/${encodeURIComponent(name)}`;
  }
}

/** Generates an opaque, unique gateway path name. */
export function generateGatewayPathName(): string {
  return `bbp_${randomBytes(12).toString('hex')}`;
}

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
