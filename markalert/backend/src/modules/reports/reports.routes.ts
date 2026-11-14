import { Router } from 'express';
import { Role } from '../../database/types';
import { reportsController } from './reports.controller';
import { authenticate, requireRole } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

// Overview metrics (faculty gets own, admin gets system-wide)
router.get('/overview', (req, res) => reportsController.getOverview(req, res));

// Settings management (admin only)
router.get('/settings', requireRole([Role.ADMIN]), (req, res) => reportsController.getSettings(req, res));
router.patch('/settings', requireRole([Role.ADMIN]), (req, res) => reportsController.updateSettings(req, res));

export default router;
