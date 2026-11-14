import { Router } from 'express';
import {
  getSessionStatus,
  connectSession,
  disconnectSession,
  simulateConnect,
  sendTestMessage
} from '../controllers/whatsappSessionController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/status', getSessionStatus);
router.post('/connect', connectSession);
router.post('/disconnect', disconnectSession);
router.post('/simulate-connect', simulateConnect);
router.post('/test-message', sendTestMessage);

export default router;
