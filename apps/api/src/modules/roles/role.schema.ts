import { z } from 'zod';

export const createRoleSchema = z.object({
  name: z.string().min(1, 'Role name is required.').max(50),
  description: z.string().max(500).optional().nullable(),
  permissions: z.array(z.string().uuid()).optional().default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional().nullable(),
});

export const setPermissionsSchema = z.object({
  permissions: z.array(z.string().uuid()),
});

export const setUsersSchema = z.object({
  userIds: z.array(z.string().uuid()),
});
