import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import * as ctrl from './notification.controller';

const router = Router();

// Personal notification endpoints — always scoped to the authenticated user.
router.get('/', authenticate, ctrl.listController);
router.get('/unread-count', authenticate, ctrl.unreadCountController);
router.get('/settings', authenticate, ctrl.getSettingsController);
router.patch('/settings', authenticate, ctrl.updateSettingsController);
router.patch('/read-all', authenticate, ctrl.markAllReadController);
router.patch('/:id/read', authenticate, ctrl.markReadController);
router.patch('/:id/archive', authenticate, ctrl.archiveController);
router.delete('/:id', authenticate, ctrl.deleteController);

export default router;
