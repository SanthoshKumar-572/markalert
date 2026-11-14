import { Router } from 'express';
import { authController } from './auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { loginSchema, refreshTokenSchema } from './auth.schema';

const router = Router();

router.post('/login', validate(loginSchema), (req, res) => authController.login(req, res));
router.post('/refresh', validate(refreshTokenSchema), (req, res) => authController.refresh(req, res));
router.post('/logout', (req, res) => authController.logout(req, res));
router.get('/me', authenticate, (req, res) => authController.getMe(req, res));

export default router;
