import { Router } from 'express';
import { loginSchema } from './auth.schema';
import { loginController, meController } from './auth.controller';
import { authenticate } from '@/middleware/authenticate';
import { validate } from '@/middleware/validate';
import { rateLimit } from '@/middleware/rate-limit';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `${req.ip ?? 'unknown'}|${String((req.body as { username?: string })?.username ?? '')}`,
});

router.post('/auth/login', loginLimiter, validate(loginSchema), loginController);
router.get('/auth/me', authenticate, meController);

export default router;
