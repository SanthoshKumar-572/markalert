import { Router } from 'express';
import { Role } from '../../database/types';
import { usersController } from './users.controller';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  createFacultySchema,
  updateFacultySchema,
  toggleStatusSchema,
  resetPasswordSchema,
} from './users.schema';

const router = Router();

// All faculty management routes require ADMIN role
router.use(authenticate, requireRole([Role.ADMIN]));

router.get('/', (req, res) => usersController.list(req, res));
router.post('/', validate(createFacultySchema), (req, res) => usersController.create(req, res));
router.patch('/:id', validate(updateFacultySchema), (req, res) => usersController.update(req, res));
router.patch('/:id/status', validate(toggleStatusSchema), (req, res) => usersController.setStatus(req, res));
router.post('/:id/reset-password', validate(resetPasswordSchema), (req, res) => usersController.resetPassword(req, res));

export default router;
