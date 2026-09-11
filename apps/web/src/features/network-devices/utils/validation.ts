import { z } from 'zod';
import type { NetworkDeviceInput } from '../types';

export const NETWORK_DEVICE_TYPES = ['COMPUTER', 'SWITCH'] as const;

/**
 * Frontend mirror of the Phase 2 backend create/update schema.
 *
 * Only identity/location/asset fields are present. Monitoring state
 * (status, consecutiveFailures, lastPingAt, lastSuccessAt,
 * lastStatusChangeAt, offlineStartedAt) is owned by the backend and must
 * never be submitted from the management UI.
 */
export const networkDeviceFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(150, 'Name must be at most 150 characters.'),
  deviceType: z.enum(NETWORK_DEVICE_TYPES, {
    errorMap: () => ({ message: 'Device type is required.' }),
  }),
  ipAddress: z
    .string()
    .trim()
    .min(1, 'IP address is required.')
    .ip({ version: 'v4', message: 'Invalid IPv4 address.' }),
  hostname: z
    .string()
    .trim()
    .max(150, 'Hostname must be at most 150 characters.')
    .optional()
    .or(z.literal('')),
  macAddress: z
    .string()
    .trim()
    .max(100, 'MAC address must be at most 100 characters.')
    .optional()
    .or(z.literal('')),
  roomId: z.string().min(1, 'Room is required.'),
  assetId: z.string().optional().or(z.literal('')),
});

export type NetworkDeviceFormValues = z.infer<typeof networkDeviceFormSchema>;

/** Field names the backend owns for monitoring; never sent by the UI. */
export const MONITORING_FIELDS = [
  'status',
  'consecutiveFailures',
  'lastPingAt',
  'lastSuccessAt',
  'lastStatusChangeAt',
  'offlineStartedAt',
] as const;

/**
 * Maps validated form values to the API payload. Optional text fields are
 * normalised to `null` so the backend can clear them on update.
 */
export function buildNetworkDevicePayload(values: NetworkDeviceFormValues): NetworkDeviceInput {
  const payload: NetworkDeviceInput = {
    name: values.name.trim(),
    deviceType: values.deviceType,
    ipAddress: values.ipAddress.trim(),
    hostname: values.hostname?.trim() ? values.hostname.trim() : null,
    macAddress: values.macAddress?.trim() ? values.macAddress.trim() : null,
    roomId: values.roomId,
    assetId: values.assetId ? values.assetId : null,
  };
  return payload;
}
