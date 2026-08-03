import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import {
  dashboardController,
  healthController,
  replacementController,
  failuresController,
  trendsController,
} from './analytics.controller';

const router = Router();

const read = [authenticate, authorize('analytics.read')];

router.get('/analytics/dashboard', ...read, dashboardController);
router.get('/analytics/health', ...read, healthController);
router.get('/analytics/replacement', ...read, replacementController);
router.get('/analytics/failures', ...read, failuresController);
router.get('/analytics/trends', ...read, trendsController);

export default router;
