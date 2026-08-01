import { z } from 'zod';

const uuid = z.string().uuid();

export const paginationQuery = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().optional(),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).optional(),
  categoryId: uuid.optional(),
  siteId: uuid.optional(),
  buildingId: uuid.optional(),
  floorId: uuid.optional(),
});

export const createCategorySchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial();

export const createSubcategorySchema = z.object({
  categoryId: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().optional().nullable(),
});

export const updateSubcategorySchema = createSubcategorySchema.partial();

export const createBrandSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().optional().nullable(),
});

export const updateBrandSchema = createBrandSchema.partial();

export const createDepartmentSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().optional().nullable(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial();

export const createVendorSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  contactPerson: z.string().max(150).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const updateVendorSchema = createVendorSchema.partial();

export const createSiteSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  address: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
});

export const updateSiteSchema = createSiteSchema.partial();

export const createBuildingSchema = z.object({
  siteId: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().optional().nullable(),
});

export const updateBuildingSchema = createBuildingSchema.partial();

export const createFloorSchema = z.object({
  buildingId: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().optional().nullable(),
});

export const updateFloorSchema = createFloorSchema.partial();

export const createRoomSchema = z.object({
  floorId: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().optional().nullable(),
});

export const updateRoomSchema = createRoomSchema.partial();

export const createMaintenanceTypeSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  maintenanceCategory: z.string().min(1).max(50),
  description: z.string().optional().nullable(),
});

export const updateMaintenanceTypeSchema = createMaintenanceTypeSchema.partial();
