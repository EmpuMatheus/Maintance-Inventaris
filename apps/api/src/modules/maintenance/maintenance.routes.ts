import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { documentUpload } from '@/lib/upload';
import * as ctrl from './maintenance.controller';
import * as s from './maintenance.schema';

const router = Router();

const r = [authenticate, authorize('maintenance.read')];
const w = [authenticate, authorize('maintenance.create')];
const u = [authenticate, authorize('maintenance.update')];
const co = [authenticate, authorize('maintenance.complete')];
const ca = [authenticate, authorize('maintenance.cancel')];

router.get('/', ...r, ctrl.listController);
router.get('/code/:code', ...r, ctrl.getByCodeController);
router.get('/:id', ...r, ctrl.getByIdController);
router.post('/', ...w, validate(s.createSchema), ctrl.createController);
router.post('/:id/assign', ...u, validate(s.assignSchema), ctrl.assignController);
router.post('/:id/start', ...u, ctrl.startController);
router.post('/:id/waiting-part', ...u, validate(s.waitingPartSchema), ctrl.waitingPartController);
router.post('/:id/testing', ...u, ctrl.testingController);
router.post('/:id/complete', ...co, validate(s.completeSchema), ctrl.completeController);
router.post('/:id/cancel', ...ca, validate(s.cancelSchema), ctrl.cancelController);
router.get('/:id/parts', ...r, ctrl.getPartsController);
router.post('/:id/parts', ...u, validate(s.addPartSchema), ctrl.addPartController);
router.delete('/:id/parts/:partId', ...u, ctrl.deletePartController);
router.get('/:id/documents', ...r, ctrl.getDocumentsController);
router.post('/:id/documents', ...u, documentUpload.single('file'), ctrl.getDocumentsController);

export default router;
