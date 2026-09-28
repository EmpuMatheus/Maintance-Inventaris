import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize, authorizeAny } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import * as ctrl from './cctv.controller';
import * as s from './cctv.schema';

const router = Router();

const deviceRead = [authenticate, authorizeAny('cctv_device.read', 'cctv_device.manage')];
const deviceWrite = [authenticate, authorize('cctv_device.manage')];
const streamRead = [authenticate, authorizeAny('cctv_stream.read', 'cctv_stream.manage', 'cctv_device.manage')];
const streamWrite = [authenticate, authorize('cctv_stream.manage')];

/* Devices */
router.get('/devices', ...deviceRead, ctrl.listController);
router.get('/devices/:id', ...deviceRead, ctrl.getByIdController);
router.post('/devices', ...deviceWrite, validate(s.createSchema), ctrl.createController);
router.put('/devices/:id', ...deviceWrite, validate(s.updateSchema), ctrl.updateController);
router.patch('/devices/:id/status', ...deviceWrite, validate(s.setStatusSchema), ctrl.setStatusController);
router.post('/devices/:id/test-connection', ...deviceWrite, ctrl.testConnectionController);
router.post('/devices/:id/test-rtsp', ...deviceWrite, validate(s.testRtspSchema), ctrl.testRtspController);
router.post('/devices/:id/sync', ...deviceWrite, ctrl.syncController);

/* Channels / streams */
router.get('/channels', ...streamRead, ctrl.listChannelsController);
router.get('/channels/:id', ...streamRead, ctrl.getChannelController);
router.patch('/channels/:id', ...streamWrite, validate(s.updateChannelSchema), ctrl.updateChannelController);

export default router;
