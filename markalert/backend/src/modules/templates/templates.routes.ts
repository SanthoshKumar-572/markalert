import { Router } from 'express';
import { Role } from '../../database/types';
import { templatesController } from './templates.controller';
import { authenticate, requireRole } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createTemplateSchema, updateTemplateSchema } from './templates.schema';

const router = Router();

router.use(authenticate);

// All authenticated users (faculty & admin) can view templates
router.get('/', (req, res) => templatesController.list(req, res));

// Admin only: create, update, delete templates
router.post('/', requireRole([Role.ADMIN]), validate(createTemplateSchema), (req, res) => templatesController.create(req, res));
router.patch('/:id', requireRole([Role.ADMIN]), validate(updateTemplateSchema), (req, res) => templatesController.update(req, res));
router.delete('/:id', requireRole([Role.ADMIN]), (req, res) => templatesController.delete(req, res));

export default router;
