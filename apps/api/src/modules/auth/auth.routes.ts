import { Router } from 'express';
import { loginSchema } from './auth.schema';
import { loginController, meController } from './auth.controller';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';

const router = Router();

router.post('/auth/login', validate(loginSchema), loginController);
router.get('/auth/me', authenticate, meController);

export default router;
