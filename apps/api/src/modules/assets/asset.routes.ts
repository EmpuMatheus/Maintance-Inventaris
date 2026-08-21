import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize, authorizeAny } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { photoUpload, documentUpload } from '@/lib/upload';
import * as ctrl from './asset.controller';
import * as docCtrl from './asset-document.controller';
import * as asnCtrl from './assignment.controller';
import { createAssetSchema, updateAssetSchema, retireAssetSchema, deleteAssetSchema } from './asset.schema';
import { updateConditionSchema } from './condition.schema';
import { assignSchema, returnSchema, transferSchema } from './assignment.schema';

const router = Router();

const read = [authenticate, authorizeAny('asset.read', 'asset.read.own')];
const write = [authenticate, authorize('asset.create')];
const mut = [authenticate, authorize('asset.update')];
const asn = [authenticate, authorize('asset.assign')];
const trn = [authenticate, authorize('asset.transfer')];
const retire = [authenticate, authorize('asset.retire')];
const del = [authenticate, authorize('asset.delete')];

router.get('/', ...read, ctrl.listController);
router.get('/code/:assetCode', ...read, ctrl.getByCodeController);
router.get('/:id', ...read, ctrl.getByIdController);
router.post('/', ...write, validate(createAssetSchema), ctrl.createController);
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

router.post('/:id/photo', ...mut, photoUpload.single('photo'), docCtrl.uploadPhoto);
router.get('/:id/documents', ...read, docCtrl.listDocuments);
router.post('/:id/documents', ...mut, documentUpload.single('file'), docCtrl.uploadDocument);
router.delete('/:id/documents/:documentId', ...mut, docCtrl.deleteDocument);

export default router;
