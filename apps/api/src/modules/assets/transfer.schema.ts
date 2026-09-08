import { z } from 'zod';

export const createTransferSchema = z.object({
  siteId: z.string().uuid(),
  buildingId: z.string().uuid(),
  floorId: z.string().uuid(),
  roomId: z.string().uuid(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
