import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  uploadExcelFile,
  validateUploadedFile,
  getUploadPreview,
  downloadErrorReport,
  importMarks,
  getUploads,
  downloadSampleTemplate
} from '../controllers/uploadController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Ensure uploads directory exists
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `marks-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls) are supported'));
    }
  }
});

// Sample template download (public or authenticated)
router.get('/sample-template', downloadSampleTemplate);

router.use(authMiddleware);

// Upload & Validation pipeline
router.post('/', upload.single('file'), uploadExcelFile);
router.post('/:id/validate', validateUploadedFile);
router.get('/:id/preview', getUploadPreview);
router.get('/:id/error-report', downloadErrorReport);
router.post('/:id/import', importMarks);
router.get('/', getUploads);

export default router;
