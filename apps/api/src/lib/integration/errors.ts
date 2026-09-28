/**
 * Protocol-neutral integration error taxonomy.
 *
 * Device integration can run over different protocols (Hikvision ISAPI, ONVIF).
 * Each protocol has its own transport-level error type, but the CCTV service
 * only needs to reason about a single, stable set of categories. Providers
 * normalise their native errors into `IntegrationError`.
 */

import { OnvifError } from '@/lib/onvif/errors';
import { IsapiError } from '@/lib/isapi/errors';

export type IntegrationErrorCode =
  | 'DEVICE_UNREACHABLE'
  | 'AUTHENTICATION_FAILED'
  | 'ISAPI_UNAVAILABLE'
  | 'ONVIF_UNAVAILABLE'
  | 'PROTOCOL_SERVICE_ERROR'
  | 'INVALID_RESPONSE'
  | 'CONNECTION_TIMEOUT'
  | 'UNSUPPORTED_PROTOCOL'
  | 'UNKNOWN_ERROR';

const CODE_MESSAGES: Record<IntegrationErrorCode, string> = {
  DEVICE_UNREACHABLE: 'Device unreachable',
  AUTHENTICATION_FAILED: 'Authentication failed',
  ISAPI_UNAVAILABLE: 'ISAPI unavailable',
  ONVIF_UNAVAILABLE: 'ONVIF unavailable',
  PROTOCOL_SERVICE_ERROR: 'Device protocol service error',
  INVALID_RESPONSE: 'Invalid device response',
  CONNECTION_TIMEOUT: 'Connection timeout',
  UNSUPPORTED_PROTOCOL: 'Unsupported integration protocol',
  UNKNOWN_ERROR: 'Unknown connection error',
};

export class IntegrationError extends Error {
  constructor(
    public readonly code: IntegrationErrorCode,
    message?: string,
  ) {
    super(message ?? CODE_MESSAGES[code]);
    this.name = 'IntegrationError';
  }

  get label(): string {
    return CODE_MESSAGES[this.code];
  }
}

export function messageForIntegrationCode(code: IntegrationErrorCode): string {
  return CODE_MESSAGES[code];
}

/**
 * Maps an ONVIF error to the protocol-neutral taxonomy. ONVIF codes that carry
 * a protocol-specific name (ONVIF_UNAVAILABLE / ONVIF_SERVICE_ERROR) keep their
 * meaning; everything else maps 1:1.
 */
export function fromOnvifError(error: OnvifError): IntegrationError {
  switch (error.code) {
    case 'DEVICE_UNREACHABLE':
      return new IntegrationError('DEVICE_UNREACHABLE', error.message);
    case 'PORT_UNREACHABLE':
      return new IntegrationError('ONVIF_UNAVAILABLE', error.message);
    case 'CONNECTION_TIMEOUT':
      return new IntegrationError('CONNECTION_TIMEOUT', error.message);
    case 'AUTHENTICATION_FAILED':
      return new IntegrationError('AUTHENTICATION_FAILED', error.message);
    case 'ONVIF_UNAVAILABLE':
      return new IntegrationError('ONVIF_UNAVAILABLE', error.message);
    case 'ONVIF_SERVICE_ERROR':
      return new IntegrationError('PROTOCOL_SERVICE_ERROR', error.message);
    case 'INVALID_RESPONSE':
      return new IntegrationError('INVALID_RESPONSE', error.message);
    default:
      return new IntegrationError('UNKNOWN_ERROR', error.message);
  }
}

/** Maps a Hikvision ISAPI error to the protocol-neutral taxonomy. */
export function fromIsapiError(error: IsapiError): IntegrationError {
  switch (error.code) {
    case 'DEVICE_UNREACHABLE':
      return new IntegrationError('DEVICE_UNREACHABLE', error.message);
    case 'CONNECTION_TIMEOUT':
      return new IntegrationError('CONNECTION_TIMEOUT', error.message);
    case 'AUTHENTICATION_FAILED':
      return new IntegrationError('AUTHENTICATION_FAILED', error.message);
    case 'ISAPI_UNAVAILABLE':
      return new IntegrationError('ISAPI_UNAVAILABLE', error.message);
    case 'ISAPI_SERVICE_ERROR':
      return new IntegrationError('PROTOCOL_SERVICE_ERROR', error.message);
    case 'INVALID_RESPONSE':
      return new IntegrationError('INVALID_RESPONSE', error.message);
    default:
      return new IntegrationError('UNKNOWN_ERROR', error.message);
  }
}

/** Coerces any thrown value into an `IntegrationError`. */
export function toIntegrationError(error: unknown): IntegrationError {
  if (error instanceof IntegrationError) return error;
  if (error instanceof OnvifError) return fromOnvifError(error);
  if (error instanceof IsapiError) return fromIsapiError(error);
  return new IntegrationError('UNKNOWN_ERROR');
}
