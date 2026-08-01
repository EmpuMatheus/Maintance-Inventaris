import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import * as ctrl from './user.controller';
import * as s from './user.schema';

const router = Router();

const read = [authenticate, authorize('user.read')];
const create = [authenticate, authorize('user.create')];
const update = [authenticate, authorize('user.update')];
const del = [authenticate, authorize('user.delete')];

router.get('/', ...read, ctrl.listController);
router.get('/:id', ...read, ctrl.getByIdController);
router.post('/', ...create, validate(s.createUserSchema), ctrl.createController);
router.put('/:id', ...update, validate(s.updateUserSchema), ctrl.updateController);
router.delete('/:id', ...del, ctrl.deleteController);
router.patch('/:id/status', ...update, validate(s.setStatusSchema), ctrl.statusController);
router.patch('/:id/password', ...update, validate(s.setPasswordSchema), ctrl.passwordController);
router.patch('/:id/roles', ...update, validate(s.setRolesSchema), ctrl.rolesController);

export default router;
