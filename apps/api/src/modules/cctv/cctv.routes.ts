import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize, authorizeAny } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import * as ctrl from './cctv.controller';
import * as liveCtrl from './cctv.live.controller';
import * as s from './cctv.schema';

const router = Router();

const deviceRead = [authenticate, authorizeAny('cctv_device.read', 'cctv_device.manage')];
const deviceWrite = [authenticate, authorize('cctv_device.manage')];
const streamRead = [authenticate, authorizeAny('cctv_stream.read', 'cctv_stream.manage', 'cctv_device.manage')];
const streamWrite = [authenticate, authorize('cctv_stream.manage')];

/* Devices */
router.get('/devices', ...deviceRead, ctrl.listController);
// Must be registered before '/devices/:id' so 'assets' is not treated as an id.
router.get('/devices/assets/:assetId/preview', ...deviceRead, ctrl.assetPreviewController);
router.get('/devices/:id', ...deviceRead, ctrl.getByIdController);
router.post('/devices', ...deviceWrite, validate(s.createSchema), ctrl.createController);
router.put('/devices/:id', ...deviceWrite, validate(s.updateSchema), ctrl.updateController);
router.patch('/devices/:id/status', ...deviceWrite, validate(s.setStatusSchema), ctrl.setStatusController);
router.post('/devices/:id/test-connection', ...deviceWrite, ctrl.testConnectionController);
router.post('/devices/:id/test-rtsp', ...deviceWrite, validate(s.testRtspSchema), ctrl.testRtspController);
router.post('/devices/:id/sync', ...deviceWrite, ctrl.syncController);

/* Channels / streams */
router.get('/channels', ...streamRead, ctrl.listChannelsController);
// Must be registered before `/channels/:id` so "monitor" is not treated as an id.
router.get('/channels/monitor', ...streamRead, ctrl.listMonitorChannelsController);
router.get('/channels/:id', ...streamRead, ctrl.getChannelController);
router.patch('/channels/:id', ...streamWrite, validate(s.updateChannelSchema), ctrl.updateChannelController);

/* Live View sessions (same-origin playback; gateway credentials stay server-side) */
router.post('/live-sessions', ...streamRead, validate(s.createLiveSessionSchema), liveCtrl.createLiveSessionController);
// Must be registered before `/live-sessions/:id` so it is not captured as an id.
router.get('/live-sessions/limits', ...streamRead, liveCtrl.liveLimitsController);
router.get('/live-sessions/:id', ...streamRead, liveCtrl.getLiveSessionController);
router.post('/live-sessions/:id/heartbeat', ...streamRead, liveCtrl.heartbeatLiveSessionController);
router.delete('/live-sessions/:id', ...streamRead, liveCtrl.stopLiveSessionController);
// WHEP signalling + HLS are proxied to the internal gateway. These bodies are
// SDP (not JSON), so no body validation is applied. Prefix mounting (`use`)
// keeps the remaining sub-path in `req.url` for the proxy.
router.use('/live-sessions/:id/whep', ...streamRead, liveCtrl.whepProxyController);
router.use('/live-sessions/:id/hls', ...streamRead, liveCtrl.hlsProxyController);

export default router;
