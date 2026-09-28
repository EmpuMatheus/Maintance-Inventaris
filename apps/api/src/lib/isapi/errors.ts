/**
 * Hikvision ISAPI error taxonomy.
 *
 * Mirrors the ONVIF/RTSP approach: transport details are classified here so the
 * integration provider can normalise them into `IntegrationError` without
 * knowing about HTTP status codes or Node socket errors.
 */

export type IsapiErrorCode =
  | 'DEVICE_UNREACHABLE'
  | 'CONNECTION_TIMEOUT'
  | 'AUTHENTICATION_FAILED'
  | 'ISAPI_UNAVAILABLE'
  | 'ISAPI_SERVICE_ERROR'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN_ERROR';

const CODE_MESSAGES: Record<IsapiErrorCode, string> = {
  DEVICE_UNREACHABLE: 'Device unreachable',
  CONNECTION_TIMEOUT: 'Connection timeout',
  AUTHENTICATION_FAILED: 'Authentication failed',
  ISAPI_UNAVAILABLE: 'ISAPI unavailable',
  ISAPI_SERVICE_ERROR: 'ISAPI service error',
  INVALID_RESPONSE: 'Invalid ISAPI response',
  UNKNOWN_ERROR: 'Unknown connection error',
};

export class IsapiError extends Error {
  constructor(
    public readonly code: IsapiErrorCode,
    message?: string,
    public readonly status?: number,
  ) {
    super(message ?? CODE_MESSAGES[code]);
    this.name = 'IsapiError';
  }

  get label(): string {
    return CODE_MESSAGES[this.code];
  }
}

/** Maps a Node `fetch`/socket error to an ISAPI error code. */
export function mapIsapiNetworkError(error: unknown): IsapiError {
  if (error instanceof IsapiError) return error;

  const err = error as { code?: string; name?: string; message?: string } | null;
  const code = err?.code;
  const name = err?.name;
  const message = err?.message ?? '';

  if (name === 'AbortError' || code === 'ETIMEDOUT' || /timed?\s?out/i.test(message)) {
    return new IsapiError('CONNECTION_TIMEOUT', undefined);
  }
  if (code === 'ECONNREFUSED') {
    // Host answered but nothing is listening on the ISAPI port.
    return new IsapiError('ISAPI_UNAVAILABLE', undefined);
  }
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'ENOTFOUND') {
    return new IsapiError('DEVICE_UNREACHABLE', undefined);
  }
  if (code === 'ECONNRESET' || code === 'EPIPE') {
    return new IsapiError('ISAPI_UNAVAILABLE', undefined);
  }
  return new IsapiError('UNKNOWN_ERROR', message || undefined);
}
