import type { IntegrationProtocol } from './types';

/**
 * Resolves the device integration protocol.
 *
 * Source of truth (in order):
 * 1. The device's Master Data subcategory — CCTV / DVR / NVR:
 *      DVR       -> ISAPI  (Hikvision DVR)
 *      CCTV      -> ONVIF  (individual IP camera)
 *      NVR       -> ONVIF  (recorder)
 * 2. The persisted `integrationProtocol` column (legacy rows / sticky value).
 * 3. Vendor heuristics (brand/model), used only for legacy rows without a
 *    subcategory, so auto-filled device information cannot switch protocols.
 *
 * The protocol is derived, never chosen manually by the user.
 */

const HIKVISION_HINTS = ['hikvision', 'hik'];
const XMEYE_HINTS = ['xmeye', 'xme', 'xiongmai', 'ouxiang', 'xiong mai'];
const HIKVISION_MODEL_PREFIX = /^ds-/i;

/**
 * Maps a Master Data subcategory name/code to an integration protocol.
 * Returns null when the name is not one of the CCTV-relevant subcategories.
 */
export function resolveSubcategoryProtocol(
  subcategoryName: string | null | undefined,
): IntegrationProtocol | null {
  const raw = String(subcategoryName ?? '').trim().toLowerCase();
  if (!raw) return null;
  // Match on substrings so "DVR", "dvr-16ch" and "Hikvision DVR" all resolve.
  // DVR is checked first (Hikvision ISAPI); CCTV cameras and NVRs use the
  // generic ONVIF path.
  if (raw.includes('dvr')) return 'ISAPI';
  if (raw.includes('cctv') || raw.includes('camera') || raw.includes('ipcam')) return 'ONVIF';
  if (raw.includes('nvr') || raw.includes('recorder')) return 'ONVIF';
  return null;
}

export function resolveIntegrationProtocol(device: {
  subcategoryName?: unknown;
  brand?: unknown;
  model?: unknown;
  deviceType?: unknown;
}): IntegrationProtocol {
  // Subcategory wins when it maps to a known CCTV subcategory.
  const fromSubcategory = resolveSubcategoryProtocol(
    device.subcategoryName as string | null | undefined,
  );
  if (fromSubcategory) return fromSubcategory;

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
export function isHikvision(device: {
  subcategoryName?: unknown;
  brand?: unknown;
  model?: unknown;
  deviceType?: unknown;
}): boolean {
  return resolveIntegrationProtocol(device) === 'ISAPI';
}

/**
 * Resolves the protocol for an existing device row.
 *
 * A configured subcategory is authoritative; otherwise the persisted
 * `integrationProtocol` column is preferred so the derived value is stable:
 * auto-populated device information (e.g. manufacturer filled in by a
 * successful Test Connection) must not silently switch the integration
 * protocol. Legacy rows with no value fall back to vendor-based derivation.
 */
export function resolveDeviceProtocol(device: {
  integrationProtocol?: unknown;
  subcategoryName?: unknown;
  brand?: unknown;
  model?: unknown;
  deviceType?: unknown;
}): IntegrationProtocol {
  const fromSubcategory = resolveSubcategoryProtocol(
    device.subcategoryName as string | null | undefined,
  );
  if (fromSubcategory) return fromSubcategory;

  const persisted = device.integrationProtocol;
  if (persisted === 'ISAPI' || persisted === 'ONVIF') return persisted;
  return resolveIntegrationProtocol(device);
}

/** Persisted protocols are only ever these two values. */
export function isIntegrationProtocol(value: unknown): value is IntegrationProtocol {
  return value === 'ISAPI' || value === 'ONVIF';
}
