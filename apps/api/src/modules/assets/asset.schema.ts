import { z } from 'zod';

export const listAssetsQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  condition: z.string().optional(),
  status: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  subcategoryId: z.string().uuid().optional(),
  brandId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  buildingId: z.string().uuid().optional(),
  floorId: z.string().uuid().optional(),
  roomId: z.string().uuid().optional(),
  picId: z.string().uuid().optional(),
});

export const createAssetSchema = z.object({
  assetName: z.string().min(1).max(200),
  categoryId: z.string().uuid(),
  subcategoryId: z.string().uuid(),
  brandId: z.string().uuid().optional().nullable(),
  model: z.string().max(150).optional().nullable(),
  serialNumber: z.string().max(150).optional().nullable(),
  manufacturer: z.string().max(150).optional().nullable(),
  specification: z.string().optional().nullable(),
  purchaseDate: z.string().optional().nullable(),
  purchasePrice: z.number().optional().nullable(),
  vendorId: z.string().uuid().optional().nullable(),
  invoiceNumber: z.string().max(100).optional().nullable(),
  warrantyStart: z.string().optional().nullable(),
  warrantyEnd: z.string().optional().nullable(),
  siteId: z.string().uuid().optional().nullable(),
  buildingId: z.string().uuid().optional().nullable(),
  floorId: z.string().uuid().optional().nullable(),
  roomId: z.string().uuid().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  currentPicId: z.string().uuid().optional().nullable(),
  condition: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateAssetSchema = createAssetSchema.partial();
