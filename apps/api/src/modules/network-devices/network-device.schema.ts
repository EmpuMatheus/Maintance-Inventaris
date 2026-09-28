import { z } from 'zod';

// Asset is the source of truth for deviceType/hostname/roomId, so `name` and
// `roomId` are optional and `deviceType`/`hostname` are no longer accepted from
// the client. `assetId` is required on create.
export const createSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  ipAddress: z.string().ip({ version: 'v4' }),
  macAddress: z.string().max(100).optional().nullable(),
  assetId: z.string().uuid(),
  isActive: z.boolean().optional(),
});

export const updateSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  ipAddress: z.string().ip({ version: 'v4' }).optional(),
  macAddress: z.string().max(100).optional().nullable(),
  assetId: z.string().uuid().optional().nullable(),
});

export const setStatusSchema = z.object({
  isActive: z.boolean(),
});

/** Query string validation for GET / (parsed in the controller). */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
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