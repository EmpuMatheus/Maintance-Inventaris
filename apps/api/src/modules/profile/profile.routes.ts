import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import * as ctrl from './profile.controller';
import { updateProfileSchema, changePasswordSchema } from './profile.schema';

const router = Router();

router.get('/', authenticate, ctrl.getProfileController);
router.patch('/', authenticate, authorize('profile.update'), validate(updateProfileSchema), ctrl.updateProfileController);
router.patch('/password', authenticate, authorize('profile.update'), validate(changePasswordSchema), ctrl.changePasswordController);

export default router;
