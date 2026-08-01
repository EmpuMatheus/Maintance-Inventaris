import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import * as ctrl from './reminder.controller';

const router = Router();

const read = [authenticate, authorize('maintenance.read')];

router.get('/', ...read, ctrl.listController);
router.post('/generate', ...read, ctrl.generateController);
router.patch('/:id/read', ...read, ctrl.markReadController);

export default router;
