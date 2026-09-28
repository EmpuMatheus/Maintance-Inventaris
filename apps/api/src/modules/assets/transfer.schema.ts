import { z } from 'zod';

export const createTransferSchema = z.object({
  siteId: z.string().uuid(),
  buildingId: z.string().uuid(),
  floorId: z.string().uuid(),
  roomId: z.string().uuid(),
  departmentId: z.string().uuid().optional().nullable(),
  reason: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  // Pihak yang terlibat dalam transfer.
  receiverUserId: z.string().uuid({ message: 'Penerima selanjutnya wajib dipilih.' }),
  witnessUserIds: z.union([z.array(z.string().uuid()), z.string()]).optional(),
});

export const rejectTransferSchema = z.object({
  reason: z.string().trim().min(1, { message: 'Alasan reject wajib diisi.' }),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type RejectTransferInput = z.infer<typeof rejectTransferSchema>;
