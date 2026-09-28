import net from 'node:net';
import { RtspError, mapRtspNetworkError } from './errors';
import { buildDigestAuthorization, parseDigestChallenge } from '@/lib/http-digest';
import type { RtspClientConfig, RtspCredentials, RtspProbeResult } from './types';

// Re-exported for backwards compatibility: the digest helpers now live in
// `@/lib/http-digest` (shared with the ISAPI client) but were previously
// imported from this module.
export { parseDigestChallenge, buildDigestAuthorization };

/**
 * Minimal RTSP probe client.
 *
 * The full RTSP URL (which would embed the username/password) is never built,
 * stored, logged or returned. Only the per-call RTSP path and the device
 * address/port are used, and credentials live purely in memory for the digest
 * handshake.
 *
 * Authentication is HTTP Digest only. A Basic challenge is treated as a
 * failure rather than sending the credential in a weaker scheme.
 */
export class RtspProbeClient {
  private readonly host: string;
  private readonly port: number;
  private readonly credentials: RtspCredentials;
  private readonly timeoutMs: number;

  constructor(config: RtspClientConfig) {
    this.host = config.host;
    this.port = config.port;
    this.credentials = config.credentials;
    this.timeoutMs = config.timeoutMs ?? 8000;
  }

  /** Builds the RTSP URI for a path. Credentials are deliberately excluded. */
  private buildUri(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    return `rtsp://${this.host}:${this.port}${p}`;
  }

  /**
   * Sends a raw RTSP request on a fresh connection and resolves once the
   * response header block (`\r\n\r\n`) has been received. The socket is always
   * torn down before returning; we never need to read the SDP body.
   *
   * `target` allows probing a URI whose host/port differ from the configured
   * RTSP endpoint (e.g. an ONVIF-provided stream URI on another camera IP).
   */
  private send(
    rawRequest: string,
    target: { host: string; port: number } = { host: this.host, port: this.port },
  ): Promise<{ statusLine: string; headers: Record<string, string> }> {
    return new Promise((resolve, reject) => {
      let socket: net.Socket;
      try {
        socket = net.connect({ host: target.host, port: target.port });
      } catch (error) {
        reject(mapRtspNetworkError(error));
        return;
      }
      socket.setNoDelay(true);

      let buffer = '';
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        socket.off('data', onData);
        socket.off('error', onError);
        socket.off('close', onClose);
        socket.destroy();
        fn();
      };

      const timer = setTimeout(() => finish(() => reject(new RtspError('CONNECTION_TIMEOUT'))), this.timeoutMs);

      const onData = (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        const end = buffer.indexOf('\r\n\r\n');
        if (end !== -1) {
          const parsed = parseResponseHeaders(buffer.slice(0, end));
          finish(() => resolve(parsed));
        }
      };
      const onError = (err: Error) => finish(() => reject(mapRtspNetworkError(err)));
      const onClose = () => finish(() => reject(new RtspError('RTSP_UNAVAILABLE')));

      socket.on('data', onData);
      socket.on('error', onError);
      socket.on('close', onClose);
      socket.write(rawRequest);
    });
  }

  private buildDescribeRequest(uri: string, cseq: number, authorization?: string): string {
    let request =
      `DESCRIBE ${uri} RTSP/1.0\r\n` +
      `CSeq: ${cseq}\r\n` +
      `Accept: application/sdp\r\n` +
      `User-Agent: BBP-CCTV/1.0\r\n`;
    if (authorization) request += `Authorization: ${authorization}\r\n`;
    return request + '\r\n';
  }

  /**
   * Probes a single RTSP path with DESCRIBE.
   *
   * Flow: DESCRIBE -> (401 + Digest challenge) -> DESCRIBE with Authorization.
   * A 200 with an SDP body means the stream is accessible.
   */
  async describe(path: string): Promise<RtspProbeResult> {
    return this.probe(this.buildUri(path), { host: this.host, port: this.port });
  }

  /**
   * Probes a complete RTSP URI (e.g. the `StreamUri` returned by ONVIF).
   *
   * Any embedded `user:pass@` credentials are ignored: the stored device
   * credential is used for the digest handshake instead, so a device-supplied
   * URI can never inject a different identity.
   */
  async describeUri(uri: string): Promise<RtspProbeResult> {
    let parsed: URL;
    try {
      parsed = new URL(uri);
    } catch {
      throw new RtspError('STREAM_UNAVAILABLE');
    }
    if (parsed.protocol !== 'rtsp:' && parsed.protocol !== 'rtsps:') {
      throw new RtspError('STREAM_UNAVAILABLE');
    }
    parsed.username = '';
    parsed.password = '';
    const targetHost = parsed.hostname;
    const targetPort = parsed.port ? Number(parsed.port) : 554;
    return this.probe(parsed.toString(), { host: targetHost, port: targetPort });
  }

  private async probe(
    uri: string,
    target: { host: string; port: number },
  ): Promise<RtspProbeResult> {
    const startedAt = Date.now();

    const challengeResponse = await this.send(this.buildDescribeRequest(uri, 1), target);
    const firstStatus = parseStatusCode(challengeResponse.statusLine);

    if (firstStatus === 200) {
      return { statusCode: 200, latencyMs: Date.now() - startedAt, authenticated: false };
    }

    if (firstStatus !== 401 && firstStatus !== 403) {
      throw statusToError(firstStatus);
    }

    const challenge = parseDigestChallenge(challengeResponse.headers['www-authenticate']);
    if (!challenge || challenge.scheme.toLowerCase() !== 'digest') {
      // No digest challenge (e.g. Basic only) — never fall back to Basic.
      throw new RtspError('AUTHENTICATION_FAILED');
    }

    const authorization = buildDigestAuthorization(this.credentials, { uri, method: 'DESCRIBE' }, challenge);

    const authenticatedResponse = await this.send(this.buildDescribeRequest(uri, 2, authorization), target);
    const secondStatus = parseStatusCode(authenticatedResponse.statusLine);

    if (secondStatus === 200) {
      return { statusCode: 200, latencyMs: Date.now() - startedAt, authenticated: true };
    }
    if (secondStatus === 401 || secondStatus === 403) {
      throw new RtspError('AUTHENTICATION_FAILED');
    }
    throw statusToError(secondStatus);
  }
}

/** Parses `RTSP/1.0 200 OK` into the numeric status code. */
export function parseStatusCode(statusLine: string): number {
  const match = /^RTSP\/\d\.\d\s+(\d{3})/.exec(statusLine.trim());
  return match ? Number(match[1]) : 0;
}

/** Parses a header block (status line + headers) into a lower-cased map. */
export function parseResponseHeaders(headerBlock: string): {
  statusLine: string;
  headers: Record<string, string>;
} {
  const lines = headerBlock.split('\r\n');
  const statusLine = lines.shift() ?? '';
  const headers: Record<string, string> = {};
  for (const line of lines) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (!(key in headers)) headers[key] = value;
  }
  return { statusLine, headers };
}

/** Maps a non-success RTSP status code to an error code. */
function statusToError(status: number): RtspError {
  if (status === 404 || status === 400) {
    return new RtspError('STREAM_UNAVAILABLE');
  }
  if (status === 451 || status === 453 || status === 454) {
    // Parameter/session not valid / not enough bandwidth — the stream exists
    // but is not accessible in its current state.
    return new RtspError('STREAM_UNAVAILABLE');
  }
  if (status === 403) {
    return new RtspError('AUTHENTICATION_FAILED');
  }
  if (status === 405 || status === 500 || status === 501 || status === 503) {
    return new RtspError('RTSP_UNAVAILABLE');
  }
  return new RtspError('UNKNOWN_ERROR');
}
