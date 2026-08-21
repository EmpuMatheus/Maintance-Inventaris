import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorizeAny } from '@/middleware/authorize';
import * as ctrl from './dashboard.controller';

const router = Router();

router.get('/summary', authenticate, authorizeAny('analytics.read', 'asset.read'), ctrl.summaryController);
router.get('/my-summary', authenticate, ctrl.mySummaryController);
router.get('/maintenance', authenticate, authorizeAny('analytics.read', 'maintenance.read'), ctrl.maintenanceStatsController);
router.get('/upcoming-schedules', authenticate, authorizeAny('analytics.read', 'maintenance.read'), ctrl.upcomingSchedulesController);
router.get('/critical-assets', authenticate, authorizeAny('analytics.read', 'asset.read'), ctrl.criticalAssetsController);
router.get('/asset-stats', authenticate, authorizeAny('analytics.read', 'asset.read'), ctrl.assetStatsController);
router.get('/condition-analytics', authenticate, authorizeAny('analytics.read', 'asset.read'), ctrl.conditionAnalyticsController);
router.get('/asset-age', authenticate, authorizeAny('analytics.read', 'asset.read'), ctrl.assetAgeController);
router.get('/department-analytics', authenticate, authorizeAny('analytics.read', 'asset.read'), ctrl.departmentAnalyticsController);
router.get('/vendor-analytics', authenticate, authorizeAny('analytics.read', 'asset.read'), ctrl.vendorAnalyticsController);
router.get('/recent-activity', authenticate, authorizeAny('analytics.read', 'asset.read', 'maintenance.read', 'ticket.read'), ctrl.recentActivityController);

export default router;
