import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize, authorizeAny } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import * as ctrl from './ticket.controller';
import * as s from './ticket.schema';

const router = Router();

const read = [authenticate, authorizeAny('ticket.read', 'ticket.read.own')];
const create = [authenticate, authorize('ticket.create')];
const update = [authenticate, authorize('ticket.update')];
const resolve = [authenticate, authorize('ticket.resolve')];
const comment = [authenticate, authorizeAny('ticket.update', 'ticket.comment.own')];

router.get('/', ...read, ctrl.listController);
router.get('/code/:code', ...read, ctrl.getByCodeController);
router.get('/:id', ...read, ctrl.getByIdController);
router.post('/', ...create, validate(s.createTicketSchema), ctrl.createController);
router.patch('/:id', ...update, validate(s.updateTicketSchema), ctrl.updateController);
router.post('/:id/assign', ...update, validate(s.assignTicketSchema), ctrl.assignController);
router.post('/:id/start', ...update, ctrl.startController);
router.post('/:id/hold', ...update, ctrl.holdController);
router.post('/:id/resume', ...update, ctrl.resumeController);
router.post('/:id/resolve', ...resolve, validate(s.resolveTicketSchema), ctrl.resolveController);
router.post('/:id/close', ...update, ctrl.closeController);
router.post('/:id/cancel', ...update, validate(s.cancelTicketSchema), ctrl.cancelController);
router.get('/:id/comments', ...read, ctrl.getCommentsController);
router.post('/:id/comments', ...comment, validate(s.addCommentSchema), ctrl.addCommentController);
router.get('/:id/assignments', ...read, ctrl.getAssignmentsController);
router.post('/:id/create-maintenance', ...update, validate(s.createMaintenanceFromTicketSchema), ctrl.createMaintenanceController);

export default router;
