import { z } from 'zod';

export const assignSchema = z.object({
  userId: z.string().uuid(),
  departmentId: z.string().uuid().optional().nullable(),
  assignedDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const returnSchema = z.object({
  returnedDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const transferSchema = z.object({
  siteId: z.string().uuid(),
  buildingId: z.string().uuid(),
  floorId: z.string().uuid(),
  roomId: z.string().uuid(),
  movementDate: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
