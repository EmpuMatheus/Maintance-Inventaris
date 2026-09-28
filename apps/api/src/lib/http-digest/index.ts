import crypto from 'node:crypto';

/**
 * HTTP Digest authentication helpers (RFC 2617 / RFC 7616 subset).
 *
 * Shared by any integration that authenticates over HTTP with Digest:
 * - the RTSP probe client (DESCRIBE) when the device uses rtsp:// transport
 * - the Hikvision ISAPI client (GET/POST over HTTP)
 *
 * The password only ever lives in memory inside `buildDigestAuthorization`;
 * it is never logged or returned.
 */

export interface DigestCredentials {
  username: string;
  password: string;
}

export interface DigestChallenge {
  scheme: string;
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
}

/**
 * Parses a `WWW-Authenticate` header into a digest challenge.
 *
 * Returns `null` when the header is absent or not a usable Digest challenge
 * (e.g. Basic, or Digest without a nonce). Callers must treat `null` as an
 * authentication failure rather than falling back to a weaker scheme.
 */
export function parseDigestChallenge(header: string | undefined | null): DigestChallenge | null {
  if (!header) return null;
  const schemeMatch = /^\s*([A-Za-z]+)\s+(.*)$/.exec(header);
  if (!schemeMatch) return null;

  const scheme = schemeMatch[1];
  const rest = schemeMatch[2];
  const params: Record<string, string> = {};
  const re = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) {
    params[m[1].toLowerCase()] = m[2] ?? m[3];
  }

  if (!params.realm || !params.nonce) return null;
  return {
    scheme,
    realm: params.realm,
    nonce: params.nonce,
    qop: params.qop,
    opaque: params.opaque,
    algorithm: params.algorithm,
  };
}

function md5(value: string): string {
  return crypto.createHash('md5').update(value).digest('hex');
}

/**
 * Builds an RFC 2617 Digest Authorization header value for a request.
 *
 * Supports both `qop=auth` (with cnonce/nc) and the legacy no-qop form.
 */
export function buildDigestAuthorization(
  credentials: DigestCredentials,
  request: { uri: string; method: string },
  challenge: DigestChallenge,
): string {
  const { username, password } = credentials;
  const ha1 = md5(`${username}:${challenge.realm}:${password}`);
  const ha2 = md5(`${request.method}:${request.uri}`);

  const parts = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${request.uri}"`,
  ];

  const qopAuth = challenge.qop
    ?.split(',')
    .map((q) => q.trim().toLowerCase())
    .includes('auth');

  if (qopAuth) {
    const cnonce = crypto.randomBytes(8).toString('hex');
    const nc = '00000001';
    const response = md5(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:auth:${ha2}`);
    parts.push(`response="${response}"`, 'qop=auth', `nc=${nc}`, `cnonce="${cnonce}"`);
  } else {
    const response = md5(`${ha1}:${challenge.nonce}:${ha2}`);
    parts.push(`response="${response}"`);
  }

  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);
  if (challenge.algorithm) parts.push(`algorithm=${challenge.algorithm}`);

  return `Digest ${parts.join(', ')}`;
}
