import { z } from 'zod';
import { NETWORK_DEVICE_TYPES } from '@/database/schema';

export const deviceType = z.enum(NETWORK_DEVICE_TYPES);

export const createSchema = z.object({
  name: z.string().min(1).max(150),
  deviceType: deviceType,
  hostname: z.string().max(150).optional().nullable(),
  ipAddress: z.string().ip({ version: 'v4' }),
  macAddress: z.string().max(100).optional().nullable(),
  roomId: z.string().uuid(),
  assetId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const updateSchema = createSchema.partial();

export const setStatusSchema = z.object({
  isActive: z.boolean(),
});

/** Query string validation for GET / (parsed in the controller). */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  deviceType: z.enum(NETWORK_DEVICE_TYPES).optional(),
  status: z.string().optional(),
  roomId: z.string().uuid().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      return v === 'true';
    }),
});