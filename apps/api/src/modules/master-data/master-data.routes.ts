import { Router } from 'express';
import type { ZodTypeAny } from 'zod';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import * as ctrl from './master-data.controller';
import * as s from './master-data.schema';
import { getDb } from '@/database/client';
import { users, departments } from '@/database/schema';
import { eq, sql } from 'drizzle-orm';

const router = Router();

const read = [authenticate, authorize('master_data.read')];
const write = [authenticate, authorize('master_data.manage')];

router.get('/users', ...read, async (_req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        employeeCode: users.employeeCode,
        isActive: users.isActive,
        departmentId: users.departmentId,
        departmentName: departments.name,
        departmentCode: departments.code,
      })
      .from(users)
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(sql`${users.isActive} = true`)
      .orderBy(users.name);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.get('/categories', ...read, ctrl.list('categories'));
router.get('/categories/:id', ...read, ctrl.getById('categories'));
router.post('/categories', ...write, validate(s.createCategorySchema), ctrl.create('categories'));
router.patch('/categories/:id', ...write, validate(s.updateCategorySchema), ctrl.update('categories'));
router.patch('/categories/:id/status', ...write, validate(s.setActiveSchema), ctrl.setActive('categories'));
router.delete('/categories/:id', ...write, validate(s.deleteCategorySchema), ctrl.deletePermanently('categories'));

const softStatusResources = [
  'subcategories', 'brands', 'departments', 'vendors', 'sites',
  'buildings', 'floors', 'rooms', 'maintenance-types',
] as const;

const createSchemas: Record<(typeof softStatusResources)[number], ZodTypeAny> = {
  subcategories: s.createSubcategorySchema,
  brands: s.createBrandSchema,
  departments: s.createDepartmentSchema,
  vendors: s.createVendorSchema,
  sites: s.createSiteSchema,
  buildings: s.createBuildingSchema,
  floors: s.createFloorSchema,
  rooms: s.createRoomSchema,
  'maintenance-types': s.createMaintenanceTypeSchema,
};

const updateSchemas: Record<(typeof softStatusResources)[number], ZodTypeAny> = {
  subcategories: s.updateSubcategorySchema,
  brands: s.updateBrandSchema,
  departments: s.updateDepartmentSchema,
  vendors: s.updateVendorSchema,
  sites: s.updateSiteSchema,
  buildings: s.updateBuildingSchema,
  floors: s.updateFloorSchema,
  rooms: s.updateRoomSchema,
  'maintenance-types': s.updateMaintenanceTypeSchema,
};

for (const resource of softStatusResources) {
  router.get(`/${resource}`, ...read, ctrl.list(resource));
  router.get(`/${resource}/:id`, ...read, ctrl.getById(resource));
  router.post(`/${resource}`, ...write, validate(createSchemas[resource]), ctrl.create(resource));
  router.patch(`/${resource}/:id`, ...write, validate(updateSchemas[resource]), ctrl.update(resource));
  router.patch(`/${resource}/:id/status`, ...write, validate(s.setActiveSchema), ctrl.setActive(resource));
  router.delete(`/${resource}/:id`, ...write, ctrl.deactivate(resource));
}

export default router;
