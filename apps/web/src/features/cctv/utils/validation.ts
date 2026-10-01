import { z } from 'zod';

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
 * Device status (ONLINE/OFFLINE/UNKNOWN) is owned by the backend and is never
 * part of the form. The password is optional: on edit an empty value means
 * "leave unchanged".
 */
export const cctvDeviceFormSchema = z.object({
  name: z.string().trim().min(1, 'Device name is required.').max(150),
  deviceType: z.enum(['DVR', 'NVR', 'RECORDER']),
  subcategoryId: z.string().trim().optional().or(z.literal('')),
  brand: z.string().trim().max(150).optional().or(z.literal('')),
  model: z.string().trim().max(150).optional().or(z.literal('')),
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
  location: z.string().trim().max(255).optional().or(z.literal('')),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
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
 * Maps validated form values to the API payload. Empty optional fields become
 * `null` so the backend can clear them. On edit the password is omitted when
 * left blank so the stored credential is preserved.
 */
export function buildCctvDevicePayload(
  values: CctvDeviceFormValues,
  opts: { isEdit: boolean },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    name: values.name.trim(),
    deviceType: values.deviceType,
    subcategoryId: values.subcategoryId?.trim() ? values.subcategoryId.trim() : null,
    brand: values.brand?.trim() ? values.brand.trim() : null,
    model: values.model?.trim() ? values.model.trim() : null,
    ipAddress: values.ipAddress.trim(),
    port: values.port,
    rtspPort: values.rtspPort,
    username: values.username?.trim() ? values.username.trim() : null,
    location: values.location?.trim() ? values.location.trim() : null,
    description: values.description?.trim() ? values.description.trim() : null,
  };
  if (values.password) payload.password = values.password;
  else if (!opts.isEdit) payload.password = null;
  return payload;
}
