/**
 * ONVIF error taxonomy.
 *
 * The business layer never needs to know how a failure was detected, only what
 * kind of failure it was. Keeping the classification here means HTTP/network
 * details stay inside the ONVIF client and never leak into CCTV services.
 */

export type OnvifErrorCode =
  | 'DEVICE_UNREACHABLE'
  | 'PORT_UNREACHABLE'
  | 'CONNECTION_TIMEOUT'
  | 'AUTHENTICATION_FAILED'
  | 'ONVIF_UNAVAILABLE'
  | 'ONVIF_SERVICE_ERROR'
  | 'INVALID_RESPONSE'
  | 'UNKNOWN_ERROR';

/** Human-readable, credential-free message for each error code. */
const CODE_MESSAGES: Record<OnvifErrorCode, string> = {
  DEVICE_UNREACHABLE: 'Device unreachable',
  PORT_UNREACHABLE: 'Port unreachable',
  CONNECTION_TIMEOUT: 'Connection timeout',
  AUTHENTICATION_FAILED: 'Authentication failed',
  ONVIF_UNAVAILABLE: 'ONVIF unavailable',
  ONVIF_SERVICE_ERROR: 'ONVIF service error',
  INVALID_RESPONSE: 'Invalid ONVIF response',
  UNKNOWN_ERROR: 'Unknown connection error',
};

export class OnvifError extends Error {
  constructor(
    public readonly code: OnvifErrorCode,
    message?: string,
    public readonly soapFault?: string,
  ) {
    super(message ?? CODE_MESSAGES[code]);
    this.name = 'OnvifError';
  }

  /** Stable label for the Test Connection result UI. */
  get label(): string {
    return CODE_MESSAGES[this.code];
  }
}

export function messageForCode(code: OnvifErrorCode): string {
  return CODE_MESSAGES[code];
}

/** Maps a Node `net`/`fetch` error to an ONVIF error code. */
export function mapNetworkError(error: unknown): OnvifError {
  if (error instanceof OnvifError) return error;

  const err = error as { code?: string; name?: string; message?: string } | null;
  const code = err?.code;
  const name = err?.name;
  const message = err?.message ?? '';

  if (name === 'AbortError' || code === 'ETIMEDOUT' || /timed?\s?out/i.test(message)) {
    return new OnvifError('CONNECTION_TIMEOUT', undefined, message);
  }
  if (code === 'ECONNREFUSED') {
    return new OnvifError('PORT_UNREACHABLE', undefined, message);
  }
  if (code === 'EHOSTUNREACH' || code === 'ENETUNREACH' || code === 'ENOTFOUND') {
    return new OnvifError('DEVICE_UNREACHABLE', undefined, message);
  }
  if (code === 'ECONNRESET' || code === 'EPIPE') {
    return new OnvifError('ONVIF_UNAVAILABLE', undefined, message);
  }
  return new OnvifError('UNKNOWN_ERROR', undefined, message);
}

/** True when a SOAP fault text indicates an authentication/authorization problem. */
export function isAuthFault(faultText: string): boolean {
  return /notauthorized|not authorized|authentication|unauthorized|sender.*not.*permitted|bad.*credential/i.test(
    faultText,
  );
}
