import { z } from 'zod';

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  email: z.string().email().max(150).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  position: z.string().max(100).nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
});
