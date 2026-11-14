import { Router } from 'express';
import {
  getDashboardStats,
  getStudentReport,
  getClassReport,
  getNotificationAnalytics
} from '../controllers/reportController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/dashboard', getDashboardStats);
router.get('/students', getStudentReport);
router.get('/classes', getClassReport);
router.get('/notifications', getNotificationAnalytics);

export default router;
