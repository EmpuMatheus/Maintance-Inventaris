import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import * as ctrl from './notification.controller';

const router = Router();

const auth = [authenticate, authorize('notification.read')];

// Personal notification endpoints — always scoped to the authenticated user.
router.get('/', ...auth, ctrl.listController);
router.get('/unread-count', ...auth, ctrl.unreadCountController);
router.get('/settings', ...auth, ctrl.getSettingsController);
router.patch('/settings', ...auth, ctrl.updateSettingsController);
router.patch('/read-all', ...auth, ctrl.markAllReadController);
router.patch('/:id/read', ...auth, ctrl.markReadController);
router.patch('/:id/archive', ...auth, ctrl.archiveController);
router.delete('/:id', ...auth, ctrl.deleteController);

export default router;
