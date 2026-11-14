import { Router } from 'express';
import {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  getParents,
  updateParent,
  importClassMaster,
  eraseDuplicates,
  downloadSampleClassTemplate
} from '../controllers/studentController';
import { authMiddleware, roleGuard } from '../middleware/auth';

const router = Router();

// Sample class template download
router.get('/sample-class-template', downloadSampleClassTemplate);

router.use(authMiddleware);

// Students & Class Student Upload
router.get('/', getStudents);
router.post('/import-class-master', roleGuard(['ADMIN']), importClassMaster);
router.post('/upload-class', roleGuard(['ADMIN']), importClassMaster);
router.post('/clean-duplicates', roleGuard(['ADMIN']), eraseDuplicates);
router.get('/:id', getStudentById);
router.post('/', roleGuard(['ADMIN']), createStudent);
router.put('/:id', roleGuard(['ADMIN']), updateStudent);
router.delete('/:id', roleGuard(['ADMIN']), deleteStudent);

// Parents
router.get('/parents/list', getParents);
router.put('/parents/:id', roleGuard(['ADMIN']), updateParent);

export default router;
