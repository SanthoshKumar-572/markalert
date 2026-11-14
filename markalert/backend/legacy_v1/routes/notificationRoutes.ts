import { Router } from 'express';
import {
  previewNotifications,
  sendBatch,
  getBatchProgress,
  getNotifications,
  getNotificationById,
  retryNotification,
  retryAllFailed,
  getTemplates,
  updateTemplate,
  previewTemplateRendering
} from '../controllers/notificationController';
import { authMiddleware, roleGuard } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Preview and Sending
router.post('/preview', previewNotifications);
router.post('/send-batch', sendBatch);
router.get('/batches/:id/progress', getBatchProgress);

// History and Details
router.get('/', getNotifications);
router.get('/:id', getNotificationById);

// Retries
router.post('/:id/retry', retryNotification);
router.post('/retry-all/failed', retryAllFailed);

// Templates
router.get('/templates/list', getTemplates);
router.put('/templates/:id', roleGuard(['ADMIN']), updateTemplate);
router.post('/templates/test-preview', previewTemplateRendering);

export default router;
