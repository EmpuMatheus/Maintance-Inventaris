import type { IntegrationProtocol } from './types';

/**
 * Resolves the device integration protocol from the device's vendor/type.
 *
 * Architecture decision:
 * - Hikvision DVR/NVR/Recorder -> ISAPI
 * - XMEye NVR (and other ONVIF-compliant recorders) -> ONVIF
 *
 * The protocol is derived, never chosen manually by the user. Brand/model are
 * matched case-insensitively because ISAPI/ONVIF device info is free-text.
 */

const HIKVISION_HINTS = ['hikvision', 'hik'];
const XMEYE_HINTS = ['xmeye', 'xme', 'xiongmai', 'ouxiang', 'xiong mai'];
const HIKVISION_MODEL_PREFIX = /^ds-/i;

export function resolveIntegrationProtocol(device: {
  brand?: unknown;
  model?: unknown;
  deviceType?: unknown;
}): IntegrationProtocol {
  const brand = String(device.brand ?? '').toLowerCase().trim();
  const model = String(device.model ?? '').trim();

  if (HIKVISION_HINTS.some((h) => brand.includes(h))) return 'ISAPI';
  if (HIKVISION_MODEL_PREFIX.test(model)) return 'ISAPI';
  if (XMEYE_HINTS.some((h) => brand.includes(h))) return 'ONVIF';

  // Unknown vendor: default to ONVIF, the generic standard used before the
  // vendor-specific split, rather than assuming a proprietary protocol.
  return 'ONVIF';
}

/** True when the resolved protocol is a Hikvision ISAPI device. */
export function isHikvision(device: { brand?: unknown; model?: unknown; deviceType?: unknown }): boolean {
  return resolveIntegrationProtocol(device) === 'ISAPI';
}

/**
 * Resolves the protocol for an existing device row.
 *
 * Prefers the persisted `integrationProtocol` column so the derived value is
 * stable: auto-populated device information (e.g. manufacturer filled in by a
 * successful Test Connection) must not silently switch the integration
 * protocol. The column is recomputed only when the user edits vendor/type.
 * Legacy rows with no value fall back to vendor-based derivation.
 */
export function resolveDeviceProtocol(device: {
  integrationProtocol?: unknown;
  brand?: unknown;
  model?: unknown;
  deviceType?: unknown;
}): IntegrationProtocol {
  const persisted = device.integrationProtocol;
  if (persisted === 'ISAPI' || persisted === 'ONVIF') return persisted;
  return resolveIntegrationProtocol(device);
}

/** Persisted protocols are only ever these two values. */
export function isIntegrationProtocol(value: unknown): value is IntegrationProtocol {
  return value === 'ISAPI' || value === 'ONVIF';
}
