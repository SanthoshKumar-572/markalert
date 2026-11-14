import { Router } from 'express';
import {
  getDepartments,
  createDepartment,
  getClasses,
  createClass,
  updateClass,
  deleteClass,
  getFacultyAssignments,
  createFacultyAssignment,
  deleteFacultyAssignment,
  getMyAssignedClasses,
  getClassStudents,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getExams,
  createExam,
  deleteExam,
  getFaculty,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  getAuditLogs
} from '../controllers/academicController';
import { authMiddleware, roleGuard } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Faculty Management (Admin only)
router.get('/faculty', roleGuard(['ADMIN']), getFaculty);
router.post('/faculty', roleGuard(['ADMIN']), createFaculty);
router.put('/faculty/:id', roleGuard(['ADMIN']), updateFaculty);
router.delete('/faculty/:id', roleGuard(['ADMIN']), deleteFaculty);

// Faculty - Class Assignments (Admin only)
router.get('/faculty-assignments', roleGuard(['ADMIN']), getFacultyAssignments);
router.post('/faculty-assignments', roleGuard(['ADMIN']), createFacultyAssignment);
router.delete('/faculty-assignments/:id', roleGuard(['ADMIN']), deleteFacultyAssignment);

// Faculty Assigned Classes & Student Roster
router.get('/my-classes', getMyAssignedClasses);
router.get('/classes/:classId/students', getClassStudents);

// Departments
router.get('/departments', getDepartments);
router.post('/departments', roleGuard(['ADMIN']), createDepartment);

// Classes (Admin create/update/delete)
router.get('/classes', getClasses);
router.post('/classes', roleGuard(['ADMIN']), createClass);
router.put('/classes/:id', roleGuard(['ADMIN']), updateClass);
router.delete('/classes/:id', roleGuard(['ADMIN']), deleteClass);

// Subjects
router.get('/subjects', getSubjects);
router.post('/subjects', roleGuard(['ADMIN']), createSubject);
router.put('/subjects/:id', roleGuard(['ADMIN']), updateSubject);
router.delete('/subjects/:id', roleGuard(['ADMIN']), deleteSubject);

// Exams (Faculty or Admin)
router.get('/exams', getExams);
router.post('/exams', createExam);
router.delete('/exams/:id', deleteExam);

// Audit Logs (Admin only)
router.get('/audit-logs', roleGuard(['ADMIN']), getAuditLogs);

export default router;
