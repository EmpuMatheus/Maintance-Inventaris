import { z } from 'zod';

export const updateConditionSchema = z.object({
  condition: z.string().min(1),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
