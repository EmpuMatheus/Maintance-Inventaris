import { describe, it, expect, afterEach } from 'vitest';
import net from 'node:net';
import crypto from 'node:crypto';
import { RtspProbeClient } from '@/lib/rtsp';
import { RtspError, mapRtspNetworkError } from '@/lib/rtsp/errors';
import { parseDigestChallenge, parseResponseHeaders, parseStatusCode } from '@/lib/rtsp/client';

/* -------------------------------------------------------------------------- */
/* A tiny in-process RTSP server used to exercise the probe without a device. */
/* -------------------------------------------------------------------------- */

interface RtspRequest {
  method: string;
  path: string;
  authorization?: string;
}

type RtspResponder = (req: RtspRequest) => string;

/** Starts a TCP server that replies to a single RTSP request per connection. */
function startRtspServer(responder: RtspResponder): Promise<{ port: number; close: () => Promise<void> }> {
  const server = net.createServer((socket) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const end = buffer.indexOf('\r\n\r\n');
      if (end === -1) return;
      socket.off('data', onData);
      const lines = buffer.slice(0, end).split('\r\n');
      const [method, path] = lines[0].split(' ');
      const headers: Record<string, string> = {};
      for (const line of lines.slice(1)) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
      }
      socket.write(responder({ method, path, authorization: headers['authorization'] }));
    };
    socket.on('data', onData);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as net.AddressInfo;
      resolve({
        port: address.port,
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

const openServers: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(openServers.splice(0).map((s) => s.close()));
});

async function launch(responder: RtspResponder) {
  const server = await startRtspServer(responder);
  openServers.push(server);
  return server;
}

function digestChallenge(realm = 'IP Camera', nonce = 'abc123nonce', qop?: string): string {
  return `Digest realm="${realm}", nonce="${nonce}"${qop ? `, qop="${qop}"` : ''}`;
}

/** Recomputes the expected digest response and returns whether it matches. */
function verifyDigest(req: RtspRequest, username: string, password: string, realm: string, nonce: string): boolean {
  if (!req.authorization) return false;
  const params: Record<string, string> = {};
  const body = req.authorization.replace(/^Digest\s+/i, '');
  const re = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) params[m[1].toLowerCase()] = m[2] ?? m[3];

  const md5 = (v: string) => crypto.createHash('md5').update(v).digest('hex');
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`DESCRIBE:${req.path}`);
  if (params.qop === 'auth') {
    const expected = md5(`${ha1}:${nonce}:${params.nc}:${params.cnonce}:auth:${ha2}`);
    return params.response === expected;
  }
  const expected = md5(`${ha1}:${nonce}:${ha2}`);
  return params.response === expected;
}

/* -------------------------------------------------------------------------- */

describe('RTSP response parsing helpers', () => {
  it('parses status codes from a status line', () => {
    expect(parseStatusCode('RTSP/1.0 200 OK')).toBe(200);
    expect(parseStatusCode('RTSP/1.0 404 Not Found')).toBe(404);
    expect(parseStatusCode('garbage')).toBe(0);
  });

  it('parses a header block into a lower-cased map', () => {
    const parsed = parseResponseHeaders('RTSP/1.0 401 Unauthorized\r\nWWW-Authenticate: Digest realm="x", nonce="y"\r\nCSeq: 1');
    expect(parsed.statusLine).toBe('RTSP/1.0 401 Unauthorized');
    expect(parsed.headers['www-authenticate']).toMatch(/Digest/);
    expect(parsed.headers.cseq).toBe('1');
  });

  it('parses a digest challenge including a quoted value with commas', () => {
    const c = parseDigestChallenge('Digest realm="IP Camera", nonce="abc", qop="auth", opaque="op"');
    expect(c).toMatchObject({ scheme: 'Digest', realm: 'IP Camera', nonce: 'abc', qop: 'auth', opaque: 'op' });
  });

  it('rejects a non-digest challenge', () => {
    // A Basic challenge has no nonce, so it is not accepted as a digest challenge.
    expect(parseDigestChallenge('Basic realm="cam"')).toBeNull();
    expect(parseDigestChallenge(undefined)).toBeNull();
    // A Digest header without a nonce is also rejected.
    expect(parseDigestChallenge('Digest realm="cam"')).toBeNull();
  });
});

describe('RtspProbeClient - successful connection', () => {
  it('answers a digest challenge and reports the stream accessible', async () => {
    const server = await launch((req) => {
      if (req.authorization) {
        const ok = verifyDigest(req, 'admin', 'secret', 'IP Camera', 'nonce-1');
        return ok
          ? 'RTSP/1.0 200 OK\r\nCSeq: 2\r\nContent-Type: application/sdp\r\n\r\nv=0\r\n'
          : 'RTSP/1.0 401 Unauthorized\r\nCSeq: 2\r\n\r\n';
      }
      return `RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: ${digestChallenge('IP Camera', 'nonce-1')}\r\n\r\n`;
    });

    const client = new RtspProbeClient({
      host: '127.0.0.1',
      port: server.port,
      credentials: { username: 'admin', password: 'secret' },
      timeoutMs: 2000,
    });
    const result = await client.describe('/Streaming/channels/102');
    expect(result.statusCode).toBe(200);
    expect(result.authenticated).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('supports a digest challenge with qop="auth"', async () => {
    const server = await launch((req) => {
      if (req.authorization) {
        const ok = verifyDigest(req, 'admin', 'secret', 'cam', 'n2');
        return ok ? 'RTSP/1.0 200 OK\r\nCSeq: 2\r\n\r\n' : 'RTSP/1.0 401 Unauthorized\r\nCSeq: 2\r\n\r\n';
      }
      return `RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: ${digestChallenge('cam', 'n2', 'auth')}\r\n\r\n`;
    });

    const client = new RtspProbeClient({
      host: '127.0.0.1',
      port: server.port,
      credentials: { username: 'admin', password: 'secret' },
      timeoutMs: 2000,
    });
    expect((await client.describe('/Streaming/channels/101')).authenticated).toBe(true);
  });

  it('accepts a stream that requires no authentication', async () => {
    const server = await launch(() => 'RTSP/1.0 200 OK\r\nCSeq: 1\r\n\r\n');
    const client = new RtspProbeClient({
      host: '127.0.0.1',
      port: server.port,
      credentials: { username: 'admin', password: 'secret' },
      timeoutMs: 2000,
    });
    const result = await client.describe('/Streaming/channels/102');
    expect(result.authenticated).toBe(false);
    expect(result.statusCode).toBe(200);
  });
});

describe('RtspProbeClient - authentication failure', () => {
  it('fails when the digest is rejected', async () => {
    const server = await launch(
      () => 'RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Digest realm="cam", nonce="n"\r\n\r\n',
    );
    const client = new RtspProbeClient({
      host: '127.0.0.1',
      port: server.port,
      credentials: { username: 'admin', password: 'wrong' },
      timeoutMs: 2000,
    });
    await expect(client.describe('/Streaming/channels/102')).rejects.toMatchObject({
      code: 'AUTHENTICATION_FAILED',
    });
  });

  it('never falls back to Basic authentication', async () => {
    const server = await launch(() => 'RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Basic realm="cam"\r\n\r\n');
    const client = new RtspProbeClient({
      host: '127.0.0.1',
      port: server.port,
      credentials: { username: 'admin', password: 'secret' },
      timeoutMs: 2000,
    });
    await expect(client.describe('/Streaming/channels/102')).rejects.toMatchObject({
      code: 'AUTHENTICATION_FAILED',
    });
  });
});

describe('RtspProbeClient - stream unavailable / invalid channel', () => {
  it('maps a 404 to STREAM_UNAVAILABLE', async () => {
    const server = await launch(() => 'RTSP/1.0 404 Not Found\r\nCSeq: 1\r\n\r\n');
    const client = new RtspProbeClient({
      host: '127.0.0.1',
      port: server.port,
      credentials: { username: 'admin', password: 'secret' },
      timeoutMs: 2000,
    });
    await expect(client.describe('/Streaming/channels/102')).rejects.toMatchObject({
      code: 'STREAM_UNAVAILABLE',
    });
  });

  it('maps a 404 after authentication to STREAM_UNAVAILABLE', async () => {
    const server = await launch((req) =>
      req.authorization
        ? 'RTSP/1.0 404 Not Found\r\nCSeq: 2\r\n\r\n'
        : 'RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Digest realm="cam", nonce="n"\r\n\r\n',
    );
    const client = new RtspProbeClient({
      host: '127.0.0.1',
      port: server.port,
      credentials: { username: 'admin', password: 'secret' },
      timeoutMs: 2000,
    });
    await expect(client.describe('/Streaming/channels/999')).rejects.toMatchObject({
      code: 'STREAM_UNAVAILABLE',
    });
  });
});

describe('RtspProbeClient - timeout', () => {
  it('rejects with CONNECTION_TIMEOUT when the server never responds', async () => {
    const server = await launch(() => ''); // accept the connection, stay silent
    const client = new RtspProbeClient({
      host: '127.0.0.1',
      port: server.port,
      credentials: { username: 'admin', password: 'secret' },
      timeoutMs: 150,
    });
    await expect(client.describe('/Streaming/channels/102')).rejects.toMatchObject({
      code: 'CONNECTION_TIMEOUT',
    });
  });
});

describe('RtspProbeClient - unreachable device', () => {
  it('maps a refused connection to RTSP_UNAVAILABLE (nothing listening)', async () => {
    // Bind and immediately close a port so nothing is listening on it.
    const server = await startRtspServer(() => '');
    await server.close();

    const client = new RtspProbeClient({
      host: '127.0.0.1',
      port: server.port,
      credentials: { username: 'admin', password: 'secret' },
      timeoutMs: 1000,
    });
    await expect(client.describe('/Streaming/channels/102')).rejects.toMatchObject({
      code: 'RTSP_UNAVAILABLE',
    });
  });

  it('maps EHOSTUNREACH/ENOTFOUND to DEVICE_UNREACHABLE', () => {
    expect(mapRtspNetworkError(Object.assign(new Error('no route'), { code: 'EHOSTUNREACH' })).code).toBe(
      'DEVICE_UNREACHABLE',
    );
    expect(mapRtspNetworkError(Object.assign(new Error('dns'), { code: 'ENOTFOUND' })).code).toBe(
      'DEVICE_UNREACHABLE',
    );
  });

  it('maps an AbortError to CONNECTION_TIMEOUT', () => {
    const e = Object.assign(new Error('aborted'), { name: 'AbortError' });
    expect(mapRtspNetworkError(e).code).toBe('CONNECTION_TIMEOUT');
  });
});

describe('RTSP error labels', () => {
  it('provides readable, credential-free labels', () => {
    expect(new RtspError('DEVICE_UNREACHABLE').label).toBe('Device unreachable');
    expect(new RtspError('AUTHENTICATION_FAILED').label).toBe('Authentication failed');
    expect(new RtspError('RTSP_UNAVAILABLE').label).toBe('RTSP unavailable');
    expect(new RtspError('STREAM_UNAVAILABLE').label).toBe('Stream unavailable');
    expect(new RtspError('CONNECTION_TIMEOUT').label).toBe('Connection timeout');
    expect(new RtspError('UNKNOWN_ERROR').label).toBe('Unknown connection error');
  });
});
