import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import * as ctrl from './master-data.controller';
import * as s from './master-data.schema';
import { getDb } from '@/database/client';
import { users } from '@/database/schema';
import { sql } from 'drizzle-orm';

const router = Router();

const read = [authenticate, authorize('master_data.read')];
const write = [authenticate, authorize('master_data.manage')];

router.get('/users', ...read, async (_req, res, next) => {
  try {
    const db = getDb();
    const rows = await db
      .select({ id: users.id, name: users.name, username: users.username, employeeCode: users.employeeCode, isActive: users.isActive })
      .from(users)
      .where(sql`${users.isActive} = true`)
      .orderBy(users.name);
    res.json({ success: true, data: rows });
  } catch (error) { next(error); }
});

router.get('/categories', ...read, ctrl.list('categories'));
router.get('/categories/:id', ...read, ctrl.getById('categories'));
router.post('/categories', ...write, validate(s.createCategorySchema), ctrl.create('categories'));
router.patch('/categories/:id', ...write, validate(s.updateCategorySchema), ctrl.update('categories'));
router.delete('/categories/:id', ...write, ctrl.deactivate('categories'));

router.get('/subcategories', ...read, ctrl.list('subcategories'));
router.get('/subcategories/:id', ...read, ctrl.getById('subcategories'));
router.post('/subcategories', ...write, validate(s.createSubcategorySchema), ctrl.create('subcategories'));
router.patch('/subcategories/:id', ...write, validate(s.updateSubcategorySchema), ctrl.update('subcategories'));
router.delete('/subcategories/:id', ...write, ctrl.deactivate('subcategories'));

router.get('/brands', ...read, ctrl.list('brands'));
router.get('/brands/:id', ...read, ctrl.getById('brands'));
router.post('/brands', ...write, validate(s.createBrandSchema), ctrl.create('brands'));
router.patch('/brands/:id', ...write, validate(s.updateBrandSchema), ctrl.update('brands'));
router.delete('/brands/:id', ...write, ctrl.deactivate('brands'));

router.get('/departments', ...read, ctrl.list('departments'));
router.get('/departments/:id', ...read, ctrl.getById('departments'));
router.post('/departments', ...write, validate(s.createDepartmentSchema), ctrl.create('departments'));
router.patch('/departments/:id', ...write, validate(s.updateDepartmentSchema), ctrl.update('departments'));
router.delete('/departments/:id', ...write, ctrl.deactivate('departments'));

router.get('/vendors', ...read, ctrl.list('vendors'));
router.get('/vendors/:id', ...read, ctrl.getById('vendors'));
router.post('/vendors', ...write, validate(s.createVendorSchema), ctrl.create('vendors'));
router.patch('/vendors/:id', ...write, validate(s.updateVendorSchema), ctrl.update('vendors'));
router.delete('/vendors/:id', ...write, ctrl.deactivate('vendors'));

router.get('/sites', ...read, ctrl.list('sites'));
router.get('/sites/:id', ...read, ctrl.getById('sites'));
router.post('/sites', ...write, validate(s.createSiteSchema), ctrl.create('sites'));
router.patch('/sites/:id', ...write, validate(s.updateSiteSchema), ctrl.update('sites'));
router.delete('/sites/:id', ...write, ctrl.deactivate('sites'));

router.get('/buildings', ...read, ctrl.list('buildings'));
router.get('/buildings/:id', ...read, ctrl.getById('buildings'));
router.post('/buildings', ...write, validate(s.createBuildingSchema), ctrl.create('buildings'));
router.patch('/buildings/:id', ...write, validate(s.updateBuildingSchema), ctrl.update('buildings'));
router.delete('/buildings/:id', ...write, ctrl.deactivate('buildings'));

router.get('/floors', ...read, ctrl.list('floors'));
router.get('/floors/:id', ...read, ctrl.getById('floors'));
router.post('/floors', ...write, validate(s.createFloorSchema), ctrl.create('floors'));
router.patch('/floors/:id', ...write, validate(s.updateFloorSchema), ctrl.update('floors'));
router.delete('/floors/:id', ...write, ctrl.deactivate('floors'));

router.get('/rooms', ...read, ctrl.list('rooms'));
router.get('/rooms/:id', ...read, ctrl.getById('rooms'));
router.post('/rooms', ...write, validate(s.createRoomSchema), ctrl.create('rooms'));
router.patch('/rooms/:id', ...write, validate(s.updateRoomSchema), ctrl.update('rooms'));
router.delete('/rooms/:id', ...write, ctrl.deactivate('rooms'));

router.get('/maintenance-types', ...read, ctrl.list('maintenance-types'));
router.get('/maintenance-types/:id', ...read, ctrl.getById('maintenance-types'));
router.post('/maintenance-types', ...write, validate(s.createMaintenanceTypeSchema), ctrl.create('maintenance-types'));
router.patch('/maintenance-types/:id', ...write, validate(s.updateMaintenanceTypeSchema), ctrl.update('maintenance-types'));
router.delete('/maintenance-types/:id', ...write, ctrl.deactivate('maintenance-types'));

export default router;
