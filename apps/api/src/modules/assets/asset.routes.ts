import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize, authorizeAny } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { photoUpload, documentUpload } from '@/lib/upload';
import * as ctrl from './asset.controller';
import * as docCtrl from './asset-document.controller';
import * as asnCtrl from './assignment.controller';
import * as trfCtrl from './transfer.controller';
import * as compCtrl from './component.controller';
import { createAssetWithComponentsSchema, updateAssetSchema, retireAssetSchema, deleteAssetSchema, createAssetComponentSchema, updateAssetComponentSchema } from './asset.schema';
import { updateConditionSchema } from './condition.schema';
import { assignSchema, returnSchema, transferSchema } from './assignment.schema';
import { createTransferSchema, rejectTransferSchema } from './transfer.schema';

const router = Router();

const read = [authenticate, authorizeAny('asset.read', 'asset.read.own')];
const write = [authenticate, authorize('asset.create')];
const mut = [authenticate, authorize('asset.update')];
const asn = [authenticate, authorize('asset.assign')];
const trn = [authenticate, authorize('asset.transfer')];
const retire = [authenticate, authorize('asset.retire')];
const del = [authenticate, authorize('asset.delete')];

router.get('/', ...read, ctrl.listController);
router.get('/components', ...read, compCtrl.listAllComponentsController);
router.get('/code/:assetCode', ...read, ctrl.getByCodeController);
router.get('/:id', ...read, ctrl.getByIdController);
router.post('/', ...write, validate(createAssetWithComponentsSchema), ctrl.createController);
router.patch('/:id', ...mut, validate(updateAssetSchema), ctrl.updateController);
router.patch('/:id/condition', ...mut, validate(updateConditionSchema), ctrl.updateConditionController);
router.post('/:id/retire', ...retire, validate(retireAssetSchema), ctrl.retireController);
router.delete('/:id', ...del, validate(deleteAssetSchema), ctrl.deleteController);
router.get('/:id/condition-history', ...read, ctrl.getConditionHistoryController);

router.post('/:id/assignments', ...asn, validate(assignSchema), asnCtrl.assignController);
router.post('/:id/assignments/return', ...asn, validate(returnSchema), asnCtrl.returnController);
router.get('/:id/assignments', ...read, asnCtrl.assignmentHistoryController);
router.post('/:id/movements', ...trn, validate(transferSchema), asnCtrl.transferController);
router.get('/:id/movements', ...read, asnCtrl.movementHistoryController);

router.get('/:id/transfers/active', ...read, trfCtrl.activeTransferController);
router.get('/:id/transfers/latest', ...read, trfCtrl.latestTransferController);
router.get('/transfers/receiver-context/:userId', ...read, trfCtrl.receiverContextController);
router.post('/:id/transfers', ...trn, documentUpload.single('authorizationLetter'), validate(createTransferSchema), trfCtrl.createTransferController);
// Confirmation/rejection are available to any authenticated party (checked in service).
router.post('/transfers/:transferId/confirm', authenticate, trfCtrl.confirmTransferController);
router.post('/transfers/:transferId/reject', authenticate, validate(rejectTransferSchema), trfCtrl.rejectTransferController);
router.post('/transfers/:transferId/cancel', ...trn, trfCtrl.cancelTransferController);
router.get('/transfers/:transferId', ...read, trfCtrl.transferByIdController);

router.post('/:id/photo', ...mut, photoUpload.single('photo'), docCtrl.uploadPhoto);
router.get('/:id/documents', ...read, docCtrl.listDocuments);
router.post('/:id/documents', ...mut, documentUpload.single('file'), docCtrl.uploadDocument);
router.delete('/:id/documents/:documentId', ...mut, docCtrl.deleteDocument);

// Components routes
router.get('/:id/components', ...read, compCtrl.getComponentsController);
router.post('/:id/components', ...mut, validate(createAssetComponentSchema), compCtrl.createComponentController);
router.patch('/:id/components/:componentId', ...mut, validate(updateAssetComponentSchema), compCtrl.updateComponentController);
router.delete('/:id/components/:componentId', ...mut, compCtrl.deleteComponentController);

export default router;
