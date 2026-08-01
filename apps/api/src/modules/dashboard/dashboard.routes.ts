import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import * as ctrl from './dashboard.controller';

const router = Router();

router.get('/summary', authenticate, ctrl.summaryController);
router.get('/maintenance', authenticate, ctrl.maintenanceStatsController);
router.get('/upcoming-schedules', authenticate, ctrl.upcomingSchedulesController);
router.get('/critical-assets', authenticate, ctrl.criticalAssetsController);
router.get('/asset-stats', authenticate, ctrl.assetStatsController);
router.get('/condition-analytics', authenticate, ctrl.conditionAnalyticsController);
router.get('/asset-age', authenticate, ctrl.assetAgeController);
router.get('/department-analytics', authenticate, ctrl.departmentAnalyticsController);
router.get('/vendor-analytics', authenticate, ctrl.vendorAnalyticsController);
router.get('/recent-activity', authenticate, ctrl.recentActivityController);

export default router;
