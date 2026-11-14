import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.use(authenticate);

// List notification records with filtering & pagination
router.get('/', (req, res) => notificationsController.list(req, res));

// Retry a single failed notification
router.post('/:id/retry', (req, res) => notificationsController.retryNotification(req, res));

export default router;
