import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorizeAny } from '@/middleware/authorize';
import * as ctrl from './monitoring.controller';

const router = Router();

const read = [authenticate, authorizeAny('network_device.read', 'network_device.manage')];

// Recovery + summary endpoints. Clients call `/status` on load and after every
// Socket.IO reconnect; the backend remains the monitoring source of truth.
router.get('/status', ...read, ctrl.getStatusController);
router.get('/summary', ...read, ctrl.getSummaryController);

// Incident history (timeline) + active incidents. One row per OFFLINE period;
// recovery fills `resolved_at` on the same row.
router.get('/events', ...read, ctrl.getEventsController);
router.get('/events/active', ...read, ctrl.getActiveIncidentsController);

export default router;