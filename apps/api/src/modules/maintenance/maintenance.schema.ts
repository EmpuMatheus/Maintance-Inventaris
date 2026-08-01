import { z } from 'zod';

export const createSchema = z.object({
  assetId: z.string().uuid(),
  maintenanceTypeId: z.string().uuid().optional().nullable(),
  maintenanceCategory: z.string().min(1).max(50),
  problem: z.string().min(1),
  priority: z.string().optional().nullable(),
  technicianId: z.string().uuid().optional().nullable(),
  vendorId: z.string().uuid().optional().nullable(),
  scheduledDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const assignSchema = z.object({
  technicianId: z.string().uuid(),
  notes: z.string().optional().nullable(),
});

export const waitingPartSchema = z.object({
  reason: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export const completeSchema = z.object({
  diagnosis: z.string().optional().nullable(),
  actionTaken: z.string().optional().nullable(),
  result: z.string().optional().nullable(),
  condition: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const cancelSchema = z.object({
  reason: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export const addPartSchema = z.object({
  partName: z.string().min(1).max(150),
  partNumber: z.string().max(100).optional().nullable(),
  quantity: z.coerce.number().int().positive().default(1),
  unitPrice: z.coerce.number().default(0),
  vendorId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});
