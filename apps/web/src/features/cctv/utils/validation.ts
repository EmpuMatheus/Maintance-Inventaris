import { z } from 'zod';
import type { CctvDeviceInput } from '../types';

export const DEVICE_TYPE_OPTIONS = [
  { value: 'DVR', label: 'DVR' },
  { value: 'NVR', label: 'NVR' },
  { value: 'RECORDER', label: 'Recorder' },
] as const;

/**
 * Mirrors the backend protocol resolution so the form can show the user which
 * integration protocol will be used. The backend remains the source of truth.
 * The device subcategory wins; brand/model are only a fallback for legacy rows.
 */
export function deriveIntegrationProtocol(
  subcategoryName: string | null | undefined,
  brand: string | null | undefined,
  model: string | null | undefined,
): 'ISAPI' | 'ONVIF' {
  const sub = (subcategoryName ?? '').toLowerCase().trim();
  if (sub.includes('dvr')) return 'ISAPI';
  if (sub.includes('cctv') || sub.includes('camera') || sub.includes('ipcam')) return 'ONVIF';
  if (sub.includes('nvr') || sub.includes('recorder')) return 'ONVIF';

  const b = (brand ?? '').toLowerCase().trim();
  if (['hikvision', 'hik'].some((h) => b.includes(h))) return 'ISAPI';
  if (/^ds-/i.test((model ?? '').trim())) return 'ISAPI';
  return 'ONVIF';
}

/**
 * Frontend mirror of the backend create/update schema.
 *
 * The Asset is selected first and is the source of truth: Device Name, Brand,
 * Model and Subcategory are derived by the backend and are never entered or
 * submitted. Device status (ONLINE/OFFLINE/UNKNOWN) is backend-owned. The
 * password is optional: on edit an empty value means "leave unchanged".
 */
export const cctvDeviceFormSchema = z.object({
  assetId: z.string().uuid('Asset is required.'),
  ipAddress: z
    .string()
    .trim()
    .min(1, 'IP address is required.')
    .ip({ version: 'v4', message: 'Invalid IPv4 address.' }),
  port: z.coerce.number().int().min(1, 'Port must be 1-65535.').max(65535, 'Port must be 1-65535.'),
  rtspPort: z.coerce
    .number()
    .int()
    .min(1, 'RTSP port must be 1-65535.')
    .max(65535, 'RTSP port must be 1-65535.'),
  username: z.string().trim().max(150).optional().or(z.literal('')),
  password: z.string().max(512).optional().or(z.literal('')),
  location: z
    .string()
    .trim()
    .min(1, 'Location is required.')
    .max(255, 'Location must be at most 255 characters.'),
});

export type CctvDeviceFormValues = z.infer<typeof cctvDeviceFormSchema>;

/** Fields owned by the backend (connection state); never submitted. */
export const BACKEND_OWNED_FIELDS = [
  'status',
  'lastCheckedAt',
  'lastSuccessAt',
  'lastError',
  'manufacturer',
  'firmwareVersion',
  'serialNumber',
  'hardwareId',
  'onvifServices',
  'lastSyncedAt',
] as const;

/**
 * Maps validated form values to the API payload. The backend derives
 * name/brand/model/subcategory/protocol from the Asset. On edit the password is
 * omitted when left blank so the stored credential is preserved.
 */
export function buildCctvDevicePayload(
  values: CctvDeviceFormValues,
  opts: { isEdit: boolean },
): CctvDeviceInput {
  const payload: CctvDeviceInput = {
    assetId: values.assetId,
    ipAddress: values.ipAddress.trim(),
    port: values.port,
    rtspPort: values.rtspPort,
    username: values.username?.trim() ? values.username.trim() : null,
    location: values.location?.trim() ? values.location.trim() : null,
  };
  if (values.password) payload.password = values.password;
  else if (!opts.isEdit) payload.password = null;
  return payload;
}
