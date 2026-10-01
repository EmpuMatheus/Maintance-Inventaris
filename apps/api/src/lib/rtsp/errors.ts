/**
 * RTSP error taxonomy.
 *
 * The business layer only needs to know what kind of failure occurred, not the
 * socket/HTTP details. Classifying here keeps network specifics out of the CCTV
 * service and guarantees the response never contains credentials.
 */

export type RtspErrorCode =
  | 'DEVICE_UNREACHABLE'
  | 'AUTHENTICATION_FAILED'
  | 'RTSP_UNAVAILABLE'
  | 'STREAM_UNAVAILABLE'
  | 'STREAM_NO_MEDIA'
  | 'CONNECTION_TIMEOUT'
  | 'UNKNOWN_ERROR';

export const RTSP_ERROR_CODES: readonly RtspErrorCode[] = [
  'DEVICE_UNREACHABLE',
  'AUTHENTICATION_FAILED',
  'RTSP_UNAVAILABLE',
  'STREAM_UNAVAILABLE',
  'STREAM_NO_MEDIA',
  'CONNECTION_TIMEOUT',
  'UNKNOWN_ERROR',
] as const;

/** Human-readable, credential-free message for each error code. */
const CODE_MESSAGES: Record<RtspErrorCode, string> = {
  DEVICE_UNREACHABLE: 'Device unreachable',
  AUTHENTICATION_FAILED: 'Authentication failed',
  RTSP_UNAVAILABLE: 'RTSP unavailable',
  STREAM_UNAVAILABLE: 'Stream unavailable',
  STREAM_NO_MEDIA: 'Stream reachable but no decodable media',
  CONNECTION_TIMEOUT: 'Connection timeout',
  UNKNOWN_ERROR: 'Unknown connection error',
};

export class RtspError extends Error {
  constructor(
    public readonly code: RtspErrorCode,
    message?: string,
  ) {
    super(message ?? CODE_MESSAGES[code]);
    this.name = 'RtspError';
  }

  /** Stable label for the Test RTSP result UI. */
  get label(): string {
    return CODE_MESSAGES[this.code];
  }
}

export function messageForRtspCode(code: RtspErrorCode): string {
  return CODE_MESSAGES[code];
}

/** Maps a Node socket error to an RTSP error code. */
export function mapRtspNetworkError(error: unknown): RtspError {
  if (error instanceof RtspError) return error;

  const err = error as { code?: string; name?: string; message?: string } | null;
  const code = err?.code;
  const name = err?.name;
  const message = err?.message ?? '';

  if (name === 'AbortError' || code === 'ETIMEDOUT' || /timed?\s?out/i.test(message)) {
    return new RtspError('CONNECTION_TIMEOUT', undefined);
  }
  if (code === 'ECONNREFUSED') {
    // The host answered but nothing is listening on the RTSP port.
    return new RtspError('RTSP_UNAVAILABLE', undefined);
  }
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'ENOTFOUND') {
    return new RtspError('DEVICE_UNREACHABLE', undefined);
  }
  if (code === 'ECONNRESET' || code === 'EPIPE') {
    return new RtspError('RTSP_UNAVAILABLE', undefined);
  }
  return new RtspError('UNKNOWN_ERROR', message || undefined);
}
