import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize, authorizeAny } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import * as ctrl from './network-device.controller';
import * as s from './network-device.schema';

const router = Router();

const read = [authenticate, authorizeAny('network_device.read', 'network_device.manage')];
const write = [authenticate, authorize('network_device.manage')];

router.get('/', ...read, ctrl.listController);
router.get('/:id', ...read, ctrl.getByIdController);
router.post('/', ...write, validate(s.createSchema), ctrl.createController);
router.put('/:id', ...write, validate(s.updateSchema), ctrl.updateController);
router.patch('/:id/status', ...write, validate(s.setStatusSchema), ctrl.setStatusController);

export default router;