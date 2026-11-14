import { Router } from 'express';
import multer from 'multer';
import { batchesController } from './batches.controller';
import { notificationsController } from '../notifications/notifications.controller';
import { authenticate, requireBatchOwnership } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { createBatchSchema, validateBatchSchema, sendBatchSchema } from './batches.schema';
import { retryFailedBatchSchema } from '../notifications/notifications.schema';
import { config } from '../../config';

const router = Router();

// Multer memory storage configuration
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const isExcel =
      file.originalname.endsWith('.xlsx') ||
      file.originalname.endsWith('.xls') ||
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel';

    if (isExcel) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are accepted'));
    }
  },
});

router.use(authenticate);

// List all batches visible to current user (faculty sees own, admin sees all)
router.get('/', (req, res) => batchesController.list(req, res));

// Create a new batch draft
router.post('/', validate(createBatchSchema), (req, res) => batchesController.create(req, res));

// Batch-specific operations (protected by ownership check)
router.get('/:id', requireBatchOwnership, (req, res) => batchesController.getById(req, res));
router.post('/:id/upload', requireBatchOwnership, upload.single('file'), (req, res) => batchesController.uploadFile(req, res));
router.post('/:id/validate', requireBatchOwnership, validate(validateBatchSchema), (req, res) => batchesController.validate(req, res));
router.get('/:id/preview', requireBatchOwnership, (req, res) => batchesController.getPreview(req, res));
router.get('/:id/errors', requireBatchOwnership, (req, res) => batchesController.downloadErrorReport(req, res));

// Message preview & sending confirmation
router.get('/:id/messages', requireBatchOwnership, (req, res) => notificationsController.getMessagesPreview(req, res));
router.post('/:id/send', requireBatchOwnership, validate(sendBatchSchema), (req, res) => notificationsController.sendBatch(req, res));
router.get('/:id/status', requireBatchOwnership, (req, res) => notificationsController.getBatchStatus(req, res));
router.post('/:id/retry-failed', requireBatchOwnership, validate(retryFailedBatchSchema), (req, res) => notificationsController.retryFailedBatch(req, res));

export default router;
