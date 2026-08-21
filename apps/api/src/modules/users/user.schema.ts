import { z } from 'zod';

export const createUserSchema = z.object({
  employeeCode: z.string().min(1, 'Employee code is required.').max(50),
  name: z.string().min(1, 'Name is required.').max(150),
  email: z.string().email('Invalid email.').optional().nullable(),
  username: z.string().min(3, 'Username must be at least 3 characters.').max(100),
  password: z.string().min(6, 'Password must be at least 6 characters.').max(200),
  departmentId: z.string().uuid().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  roleId: z.string().uuid('Role is required.'),
  categoryId: z.string().uuid().optional().nullable(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  email: z.string().email('Invalid email.').optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  position: z.string().max(100).optional().nullable(),
  roleId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional().nullable(),
});

export const setStatusSchema = z.object({
  isActive: z.boolean(),
});

export const setPasswordSchema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters.').max(200),
});

export const setRoleSchema = z.object({
  roleId: z.string().uuid('Role is required.'),
  categoryId: z.string().uuid().optional().nullable(),
});
