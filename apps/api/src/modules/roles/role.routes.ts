import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import * as ctrl from './role.controller';
import * as s from './role.schema';

const router = Router();

const read = [authenticate, authorize('role.read')];
const create = [authenticate, authorize('role.create')];
const update = [authenticate, authorize('role.update')];
const del = [authenticate, authorize('role.delete')];

router.get('/', ...read, ctrl.listController);
router.get('/permissions', ...read, ctrl.permissionsController);
router.get('/:id', ...read, ctrl.getByIdController);
router.post('/', ...create, validate(s.createRoleSchema), ctrl.createController);
router.put('/:id', ...update, validate(s.updateRoleSchema), ctrl.updateController);
router.delete('/:id', ...del, ctrl.deleteController);
router.patch('/:id/permissions', ...update, validate(s.setPermissionsSchema), ctrl.permissionsAssignController);
router.patch('/:id/users', ...update, validate(s.setUsersSchema), ctrl.usersAssignController);

export default router;
