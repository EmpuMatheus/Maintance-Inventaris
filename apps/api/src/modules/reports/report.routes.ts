import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import * as ctrl from './report.controller';
import * as maintCtrl from './report-maintenance.controller';
import * as costCtrl from './report-maintenance-cost.controller';
import * as condCtrl from './report-asset-condition.controller';
import * as extraCtrl from './report-extra.controller';
import { exportController } from './report-export';

const router = Router();

const read = [authenticate, authorize('report.read')];

router.get('/inventory', ...read, ctrl.inventoryController);
router.get('/maintenance', ...read, maintCtrl.maintenanceController);
router.get('/maintenance-cost', ...read, costCtrl.maintenanceCostController);
router.get('/asset-condition', ...read, condCtrl.assetConditionController);
router.get('/broken-asset', ...read, extraCtrl.brokenAssetController);
router.get('/movement', ...read, extraCtrl.movementController);
router.get('/warranty', ...read, extraCtrl.warrantyController);
router.get('/asset-aging', ...read, extraCtrl.assetAgingController);

router.get('/:report/export', ...read, exportController);

export default router;
