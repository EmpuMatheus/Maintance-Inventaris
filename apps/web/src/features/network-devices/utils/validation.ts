import { z } from 'zod';
import type { NetworkDeviceInput } from '../types';

/**
 * Frontend mirror of the backend create/update schema.
 *
 * The Asset is selected first and is the source of truth: `deviceType`,
 * `hostname` and `roomId` are derived by the backend and are never submitted.
 * Monitoring state (status, consecutiveFailures, lastPingAt, ...) is owned by
 * the backend and must never be submitted from the management UI.
 */
export const networkDeviceFormSchema = z.object({
  name: z
    .string()
    .trim()
    .max(150, 'Name must be at most 150 characters.')
    .optional()
    .or(z.literal('')),
  ipAddress: z
    .string()
    .trim()
    .min(1, 'IP address is required.')
    .ip({ version: 'v4', message: 'Invalid IPv4 address.' }),
  macAddress: z
    .string()
    .trim()
    .max(100, 'MAC address must be at most 100 characters.')
    .optional()
    .or(z.literal('')),
  assetId: z.string().uuid('Asset is required.'),
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

/** Fields derived from the Asset by the backend; never sent by the UI. */
export const DERIVED_FIELDS = ['deviceType', 'hostname', 'roomId'] as const;

/**
 * Maps validated form values to the API payload. Optional text fields are
 * normalised to `null` so the backend can clear them on update.
 */
export function buildNetworkDevicePayload(values: NetworkDeviceFormValues): NetworkDeviceInput {
  return {
    name: values.name?.trim() ? values.name.trim() : undefined,
    ipAddress: values.ipAddress.trim(),
    macAddress: values.macAddress?.trim() ? values.macAddress.trim() : null,
    assetId: values.assetId,
  };
}
