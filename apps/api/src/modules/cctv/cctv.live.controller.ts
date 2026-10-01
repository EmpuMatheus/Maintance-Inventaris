import type { Request, Response, NextFunction } from 'express';
import { Readable } from 'node:stream';
import { env, streamingGatewayConfig } from '@/config/env';
import { getStreamingGateway } from '@/lib/streaming';
import * as live from './cctv.live.service';

/**
 * Same-origin proxy for browser playback.
 *
 * The browser never reaches the MediaMTX gateway directly: WebRTC signalling
 * (WHEP) and HLS are proxied through the API, which is already authenticated
 * and same-origin. The media plane (WebRTC ICE/DTLS over UDP) flows directly
 * from the gateway to the browser, which does not carry credentials.
 *
 * Credentials live only in the server-side gateway path configuration.
 */

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  // Never forward the API credential to the internal gateway.
  'authorization',
  'content-length',
]);

async function readRawBody(req: Request): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return undefined;
  // WHEP bodies are `application/sdp` / trickle-ICE fragments, so the global
  // express.json() middleware leaves `req.body` empty and the raw stream intact
  // (except when a Buffer was injected by a test).
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk as Buffer));
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function copyHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }
  return headers;
}

/**
 * Forwards a request to the gateway and streams the response back. Rewrites
 * the WHEP session `Location` header so the browser continues the handshake
 * through this API rather than the loopback gateway.
 */
async function forward(
  req: Request,
  res: Response,
  targetUrl: string,
  rewriteLocation: (location: string) => string | null,
): Promise<void> {
  const headers = copyHeaders(req);
  const body = await readRawBody(req);

  let upstream: globalThis.Response;
  try {
    upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body ? new Uint8Array(body) : undefined,
    });
  } catch {
    res.status(502).json({
      success: false,
      error: { code: 'GATEWAY_UNAVAILABLE', message: 'Streaming gateway is unavailable.' },
    });
    return;
  }

  const location = upstream.headers.get('location');
  if (location) {
    const rewritten = rewriteLocation(location);
    if (rewritten) res.setHeader('Location', rewritten);
  }

  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP.has(lower) || lower === 'location' || lower === 'content-encoding') return;
    if (lower === 'link') return; // handled explicitly below
    res.setHeader(key, value);
  });
  const link = upstream.headers.get('link');
  if (link) res.setHeader('Link', link);

  res.status(upstream.status);
  if (!upstream.body) {
    res.end();
    return;
  }
  Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
}

/** Builds the public, same-origin WHEP base for a session. */
export function whepPublicBase(sessionId: string): string {
  return `${env.API_PREFIX}/cctv/live-sessions/${sessionId}/whep`;
}

/** Rewrites a gateway WHEP session location to the API proxy path. */
function rewriteWhepLocation(sessionId: string, location: string): string | null {
  const gateway = getStreamingGateway();
  const internal = gateway.webrtcEndpoint('').replace(/\/whep$/, '');
  try {
    const url = new URL(location, internal);
    const afterWhep = url.pathname.split('/whep').pop() ?? '';
    if (!afterWhep) return null;
    return `${whepPublicBase(sessionId)}${afterWhep}`;
  } catch {
    return null;
  }
}

/** Creates a Live View session and returns the safe playback descriptors. */
export async function createLiveSessionController(req: Request, res: Response, next: NextFunction) {
  try {
    const view = await live.createLiveSession({
      deviceId: req.body.deviceId,
      channelId: req.body.channelId,
      streamKind: req.body.streamKind,
      userId: req.user?.id ?? null,
    });
    res.status(201).json({ success: true, data: view });
  } catch (e) {
    next(e);
  }
}

/**
 * Exposes the live-session limits so the Monitor grid can size itself without
 * exceeding `CCTV_LIVE_SESSION_MAX`. Contains no credentials or config secrets.
 */
export async function liveLimitsController(_req: Request, res: Response, next: NextFunction) {
  try {
    res.json({
      success: true,
      data: {
        maxSessions: streamingGatewayConfig.maxSessions,
        sessionTtlSeconds: streamingGatewayConfig.sessionTtlSeconds,
        ingestMode: streamingGatewayConfig.ingestMode,
        streamingEnabled: streamingGatewayConfig.enabled,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function getLiveSessionController(req: Request, res: Response, next: NextFunction) {
  try {
    const view = await live.getLiveSession(req.params.id as string);
    res.json({ success: true, data: view });
  } catch (e) {
    next(e);
  }
}

export async function stopLiveSessionController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await live.stopLiveSession(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

/**
 * Viewer heartbeat: renews the session TTL so an active stream is never reaped
 * after the base TTL. Returns the new expiry; 404/410 when the session is gone.
 */
export async function heartbeatLiveSessionController(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await live.heartbeatLiveSession(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

/**
 * WHEP signalling proxy (OPTIONS/POST/PATCH/DELETE). Mounted at
 * `/live-sessions/:id/whep`; the remaining path (the session id) is in `req.url`.
 */
export async function whepProxyController(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.params.id as string;
    const gatewayPath = await live.resolveSessionGatewayPath(sessionId);
    // When mounted, `req.url` is the remainder after `/whep` (`/` for the bare
    // endpoint, `/<sessionId>` for subsequent trickle/teardown requests).
    const subPath = !req.url || req.url === '/' ? '' : req.url;
    const target = `${getStreamingGateway().webrtcEndpoint(gatewayPath)}${subPath}`;
    await forward(req, res, target, (location) => rewriteWhepLocation(sessionId, location));
  } catch (e) {
    next(e);
  }
}

/**
 * HLS proxy (manifest + segments). Mounted at `/live-sessions/:id/hls`.
 *
 * MediaMTX protects HLS with a cookie challenge: the first request gets a 302
 * with `Set-Cookie: cookieCheck=1`, and subsequent requests must present it.
 * The challenge is answered server-side here so the browser (and hls.js) only
 * ever sees normal 200 responses through the same-origin API.
 */
export async function hlsProxyController(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.params.id as string;
    // Only GET/HEAD are meaningful for HLS.
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).json({
        success: false,
        error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
      });
      return;
    }
    const gatewayPath = await live.resolveSessionGatewayPath(sessionId);
    const subPath = !req.url || req.url === '/' ? '/index.m3u8' : req.url;
    const base = streamingGatewayConfig.hlsUrl.replace(/\/+$/, '');
    const target = `${base}/${encodeURIComponent(gatewayPath)}${subPath}`;

    const headers = copyHeaders(req);
    // Forward any gateway cookie the client already carries (same-origin).
    if (req.headers.cookie) headers.cookie = String(req.headers.cookie);

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(target, { method: 'GET', headers });
    } catch {
      res.status(502).json({
        success: false,
        error: { code: 'GATEWAY_UNAVAILABLE', message: 'Streaming gateway is unavailable.' },
      });
      return;
    }

    // Answer MediaMTX's HLS cookie challenge transparently.
    if (upstream.status === 302) {
      const setCookie = upstream.headers.get('set-cookie');
      const location = upstream.headers.get('location');
      if (setCookie && location) {
        const cookie = setCookie.split(';')[0];
        const challengeUrl = new URL(location, base).toString();
        try {
          upstream = await fetch(challengeUrl, { method: 'GET', headers: { ...headers, cookie } });
        } catch {
          // Fall through with the original 302.
        }
      }
    }

    for (const [key, value] of upstream.headers.entries()) {
      const lower = key.toLowerCase();
      if (HOP_BY_HOP.has(lower) || lower === 'content-encoding' || lower === 'location' || lower === 'set-cookie') continue;
      res.setHeader(key, value);
    }
    res.status(upstream.status);
    if (!upstream.body) {
      res.end();
      return;
    }
    Readable.fromWeb(upstream.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
  } catch (e) {
    next(e);
  }
}
