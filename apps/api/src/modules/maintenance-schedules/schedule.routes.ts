import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import * as ctrl from './schedule.controller';
import * as s from './schedule.schema';

const router = Router();

const read = [authenticate, authorize('maintenance.read')];
const write = [authenticate, authorize('maintenance.create')];
const update = [authenticate, authorize('maintenance.update')];

router.get('/', ...read, ctrl.listController);
router.get('/upcoming', ...read, ctrl.upcomingController);
router.get('/due-today', ...read, ctrl.dueTodayController);
router.get('/overdue', ...read, ctrl.overdueController);
router.get('/completed', ...read, ctrl.completedController);
router.get('/:id', ...read, ctrl.getByIdController);
router.post('/', ...write, validate(s.createScheduleSchema), ctrl.createController);
router.patch('/:id', ...update, validate(s.updateScheduleSchema), ctrl.updateController);
router.patch('/:id/status', ...update, validate(s.setScheduleStatusSchema), ctrl.setStatusController);
router.post('/process-due', ...write, ctrl.processDueController);

export default router;
