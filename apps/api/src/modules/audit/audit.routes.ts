import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import * as ctrl from './audit.controller';

const router = Router();

const read = [authenticate, authorize('audit.read')];

router.get('/', ...read, ctrl.listController);
router.get('/summary', ...read, ctrl.summaryController);
router.get('/modules', ...read, ctrl.modulesController);
router.get('/actions', ...read, ctrl.actionsController);
router.get('/:id', ...read, ctrl.getByIdController);

export default router;
