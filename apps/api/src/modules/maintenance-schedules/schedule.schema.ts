import { z } from 'zod';
import { SCHEDULE_FREQUENCIES, REMINDER_STATUSES } from './schedule.types';

export const createScheduleSchema = z.object({
  assetId: z.string().uuid(),
  maintenanceTypeId: z.string().uuid().optional().nullable(),
  frequencyType: z.enum(SCHEDULE_FREQUENCIES),
  frequencyValue: z.coerce.number().int().min(1).default(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.').optional().nullable(),
  nextMaintenanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.').optional().nullable(),
  lastMaintenanceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format.').optional().nullable(),
  reminderDays: z.coerce.number().int().min(0).max(365).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateScheduleSchema = createScheduleSchema.partial();

export const setScheduleStatusSchema = z.object({
  isActive: z.boolean(),
});

export const dueQuerySchema = z.object({
  days: z.coerce.number().int().min(0).max(365).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  assetId: z.string().uuid().optional(),
  typeId: z.string().uuid().optional(),
});

export const listRemindersQuerySchema = z.object({
  status: z.enum(REMINDER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});
