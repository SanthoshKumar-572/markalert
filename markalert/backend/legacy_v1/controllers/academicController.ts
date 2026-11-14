import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../database/db';
import { logAudit, checkFacultyClassAccess, getFacultyAssignedClassIds } from '../middleware/auth';

// ==============================================================================
// 1. Departments
// ==============================================================================
export async function getDepartments(req: Request, res: Response): Promise<void> {
  try {
    const departments = await db.query<any>('SELECT * FROM departments ORDER BY name ASC');
    res.json({ success: true, data: departments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch departments' });
  }
}

export async function createDepartment(req: Request, res: Response): Promise<void> {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      res.status(400).json({ success: false, error: 'Department name and code are required' });
      return;
    }
    const cleanCode = code.toUpperCase().trim();
    const id = `dept-${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    
    const existing = await db.queryOne('SELECT id FROM departments WHERE UPPER(code) = ?', [cleanCode]);
    if (existing) {
      res.status(400).json({ success: false, error: `Department with code '${cleanCode}' already exists` });
      return;
    }

    await db.execute('INSERT INTO departments (id, name, code) VALUES (?, ?, ?)', [id, name.trim(), cleanCode]);
    await logAudit(req.user?.id, 'ADMIN_CREATED_DEPARTMENT', 'departments', id, { name, code: cleanCode });
    res.status(201).json({ success: true, data: { id, name, code: cleanCode } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to create department' });
  }
}

// ==============================================================================
// 2. Classes Management
// ==============================================================================
export async function getClasses(req: Request, res: Response): Promise<void> {
  try {
    const { department_id } = req.query;
    let queryStr = `
      SELECT c.*, d.name as department_name, d.code as department_code,
             (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count
      FROM classes c
      JOIN departments d ON c.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (department_id) {
      queryStr += ' AND c.department_id = ?';
      params.push(department_id);
    }
    queryStr += ' ORDER BY d.name ASC, c.year ASC, c.section ASC';

    const classes = await db.query<any>(queryStr, params);

    // Attach assigned faculty info to each class
    const assignments = await db.query<any>(`
      SELECT fca.*, u.name as faculty_name, u.email as faculty_email
      FROM faculty_class_assignments fca
      JOIN users u ON fca.faculty_id = u.id
    `);

    const classMapWithFaculty = classes.map(cls => {
      const assigned = assignments.filter(a => a.class_id === cls.id);
      const className = cls.name || `${cls.department_code}-${cls.section}`;
      return {
        ...cls,
        name: className,
        assigned_faculty: assigned
      };
    });

    res.json({ success: true, data: classMapWithFaculty });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch classes' });
  }
}

export async function createClass(req: Request, res: Response): Promise<void> {
  try {
    const { department_id, year, semester, section, academic_year, name } = req.body;
    if (!department_id || !section || !academic_year) {
      res.status(400).json({ success: false, error: 'Department, section, and academic year are required' });
      return;
    }

    const dept = await db.queryOne<any>('SELECT * FROM departments WHERE id = ?', [department_id]);
    if (!dept) {
      res.status(404).json({ success: false, error: 'Department not found' });
      return;
    }

    const cleanSection = String(section).trim().toUpperCase();
    const cleanYear = year ? String(year).trim() : '1';
    const cleanSem = semester ? String(semester).trim() : (cleanYear ? String(Number(cleanYear) * 2 - 1) : '1');
    const className = (name && String(name).trim()) || `${dept.code}-${cleanSection}`;
    const id = `class-${dept.code.toLowerCase()}-${cleanYear}${cleanSection.toLowerCase()}-${Date.now().toString().slice(-4)}`;

    await db.execute(
      'INSERT INTO classes (id, name, department_id, year, semester, section, academic_year) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, className, department_id, cleanYear, cleanSem, cleanSection, academic_year.trim()]
    );

    await logAudit(req.user?.id, 'ADMIN_CREATED_CLASS', 'classes', id, { name: className, department_id, academic_year });
    res.status(201).json({ success: true, data: { id, name: className, department_id, year: cleanYear, semester: cleanSem, section: cleanSection, academic_year } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to create class' });
  }
}

export async function updateClass(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, department_id, year, semester, section, academic_year } = req.body;
    const existing = await db.queryOne<any>('SELECT * FROM classes WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Class not found' });
      return;
    }

    await db.execute(
      `UPDATE classes 
       SET name = COALESCE(?, name), department_id = COALESCE(?, department_id),
           year = COALESCE(?, year), semester = COALESCE(?, semester),
           section = COALESCE(?, section), academic_year = COALESCE(?, academic_year)
       WHERE id = ?`,
      [name || null, department_id || null, year || null, semester || null, section || null, academic_year || null, id]
    );

    await logAudit(req.user?.id, 'ADMIN_UPDATED_CLASS', 'classes', id, { name, academic_year });
    res.json({ success: true, message: 'Class updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update class' });
  }
}

export async function deleteClass(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM classes WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'ADMIN_DELETED_CLASS', 'classes', id);
    res.json({ success: true, message: 'Class deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to delete class' });
  }
}

// ==============================================================================
// 3. Faculty Management (Admin Only)
// ==============================================================================
export async function getFaculty(req: Request, res: Response): Promise<void> {
  try {
    const faculty = await db.query<any>(`
      SELECT u.id, u.name, u.email, u.role, u.department_id, u.is_active, u.created_at,
             d.name as department_name, d.code as department_code
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.role = 'FACULTY'
      ORDER BY u.name ASC
    `);

    // Attach assigned classes list
    const assignments = await db.query<any>(`
      SELECT fca.id as assignment_id, fca.faculty_id, fca.class_id, fca.academic_year,
             c.name as class_name, c.section, c.semester, c.year, d.code as department_code
      FROM faculty_class_assignments fca
      JOIN classes c ON fca.class_id = c.id
      JOIN departments d ON c.department_id = d.id
    `);

    const result = faculty.map(f => {
      const assigned = assignments.filter(a => a.faculty_id === f.id);
      return {
        ...f,
        is_active: f.is_active !== 0 && f.is_active !== false,
        assigned_classes: assigned
      };
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch faculty list' });
  }
}

export async function createFaculty(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, department_id } = req.body;
    if (!name || !email || !department_id) {
      res.status(400).json({ success: false, error: 'Faculty Name, Email, and Department are required' });
      return;
    }
    const cleanEmail = String(email).trim().toLowerCase();
    const existing = await db.queryOne('SELECT id FROM users WHERE LOWER(email) = ?', [cleanEmail]);
    if (existing) {
      res.status(400).json({ success: false, error: `User with email '${cleanEmail}' already exists` });
      return;
    }
    const pwd = password || 'Faculty@123';
    const password_hash = await bcrypt.hash(pwd, 10);
    const id = `user-fac-${Date.now().toString().slice(-6)}`;

    await db.execute(
      'INSERT INTO users (id, name, email, password_hash, role, department_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [id, name.trim(), cleanEmail, password_hash, 'FACULTY', department_id]
    );
    await logAudit(req.user?.id, 'ADMIN_CREATED_FACULTY', 'users', id, { name, email: cleanEmail, department_id });
    res.status(201).json({ success: true, data: { id, name: name.trim(), email: cleanEmail, department_id, role: 'FACULTY', is_active: 1 } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to create faculty member' });
  }
}

export async function updateFaculty(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, email, department_id, is_active, password } = req.body;

    const existing = await db.queryOne<any>('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Faculty member not found' });
      return;
    }

    let passwordHash = existing.password_hash;
    if (password && String(password).trim().length > 0) {
      passwordHash = await bcrypt.hash(String(password).trim(), 10);
    }

    const cleanEmail = email ? String(email).trim().toLowerCase() : existing.email;
    const cleanName = name ? String(name).trim() : existing.name;
    const cleanDept = department_id !== undefined ? department_id : existing.department_id;
    const activeVal = is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active;

    await db.execute(
      `UPDATE users 
       SET name = ?, email = ?, password_hash = ?, department_id = ?, is_active = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [cleanName, cleanEmail, passwordHash, cleanDept, activeVal, id]
    );

    await logAudit(req.user?.id, 'ADMIN_UPDATED_FACULTY', 'users', id, { name: cleanName, email: cleanEmail, is_active: activeVal });
    res.json({ success: true, message: 'Faculty updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update faculty' });
  }
}

export async function deleteFaculty(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM faculty_class_assignments WHERE faculty_id = ?', [id]);
    await db.execute('DELETE FROM users WHERE id = ? AND role = "FACULTY"', [id]);
    await logAudit(req.user?.id, 'ADMIN_DELETED_FACULTY', 'users', id);
    res.json({ success: true, message: 'Faculty member and class assignments removed successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to delete faculty' });
  }
}

// ==============================================================================
// 4. Faculty - Class Assignments (Admin Only)
// ==============================================================================
export async function getFacultyAssignments(req: Request, res: Response): Promise<void> {
  try {
    const assignments = await db.query<any>(`
      SELECT fca.id, fca.faculty_id, fca.class_id, fca.academic_year, fca.assigned_at,
             u.name as faculty_name, u.email as faculty_email,
             c.name as class_name, c.year as class_year, c.semester as class_semester, c.section as class_section,
             d.name as department_name, d.code as department_code
      FROM faculty_class_assignments fca
      JOIN users u ON fca.faculty_id = u.id
      JOIN classes c ON fca.class_id = c.id
      JOIN departments d ON c.department_id = d.id
      ORDER BY u.name ASC, c.name ASC
    `);
    res.json({ success: true, data: assignments });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch assignments' });
  }
}

export async function createFacultyAssignment(req: Request, res: Response): Promise<void> {
  try {
    const { faculty_id, class_id, academic_year = '2026-27' } = req.body;
    if (!faculty_id || !class_id) {
      res.status(400).json({ success: false, error: 'Faculty and Class are required for assignment' });
      return;
    }

    const faculty = await db.queryOne<any>('SELECT * FROM users WHERE id = ? AND role = "FACULTY"', [faculty_id]);
    if (!faculty) {
      res.status(404).json({ success: false, error: 'Faculty member not found' });
      return;
    }

    const cls = await db.queryOne<any>('SELECT * FROM classes WHERE id = ?', [class_id]);
    if (!cls) {
      res.status(404).json({ success: false, error: 'Class not found' });
      return;
    }

    const existing = await db.queryOne<any>(
      'SELECT id FROM faculty_class_assignments WHERE faculty_id = ? AND class_id = ? AND academic_year = ?',
      [faculty_id, class_id, academic_year]
    );
    if (existing) {
      res.status(400).json({ success: false, error: 'This faculty member is already assigned to this class for the specified academic year' });
      return;
    }

    const id = `fca-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await db.execute(
      'INSERT INTO faculty_class_assignments (id, faculty_id, class_id, academic_year, assigned_by) VALUES (?, ?, ?, ?, ?)',
      [id, faculty_id, class_id, academic_year, req.user?.id || null]
    );

    await logAudit(req.user?.id, 'ADMIN_ASSIGNED_CLASS', 'faculty_class_assignments', id, {
      faculty_id,
      faculty_name: faculty.name,
      class_id,
      class_name: cls.name || cls.id,
      academic_year
    });

    res.status(201).json({ success: true, data: { id, faculty_id, class_id, academic_year } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to assign faculty to class' });
  }
}

export async function deleteFacultyAssignment(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM faculty_class_assignments WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'ADMIN_REMOVED_CLASS_ASSIGNMENT', 'faculty_class_assignments', id);
    res.json({ success: true, message: 'Class assignment removed successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to remove assignment' });
  }
}

// ==============================================================================
// 5. Faculty Dashboard & Assigned Classes Flow
// ==============================================================================
export async function getMyAssignedClasses(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    let queryStr = '';
    const params: any[] = [];

    if (user.role === 'ADMIN') {
      // Admin has access to all classes
      queryStr = `
        SELECT c.*, d.name as department_name, d.code as department_code,
               (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count,
               (SELECT COUNT(*) FROM exams e WHERE e.class_id = c.id) as exam_count
        FROM classes c
        JOIN departments d ON c.department_id = d.id
        ORDER BY d.name ASC, c.year ASC, c.section ASC
      `;
    } else {
      // Faculty only sees their assigned classes
      queryStr = `
        SELECT c.*, d.name as department_name, d.code as department_code,
               fca.id as assignment_id, fca.assigned_at,
               (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) as student_count,
               (SELECT COUNT(*) FROM exams e WHERE e.class_id = c.id) as exam_count
        FROM faculty_class_assignments fca
        JOIN classes c ON fca.class_id = c.id
        JOIN departments d ON c.department_id = d.id
        WHERE fca.faculty_id = ?
        ORDER BY c.name ASC
      `;
      params.push(user.id);
    }

    const classes = await db.query<any>(queryStr, params);
    const formatted = classes.map(c => ({
      ...c,
      name: c.name || `${c.department_code}-${c.section}`,
      semester: c.semester || (c.year ? `Semester ${Number(c.year) * 2 - 1}` : 'Semester 5'),
      academic_year: c.academic_year || '2026-27',
      student_count: Number(c.student_count) || 0,
      exam_count: Number(c.exam_count) || 0
    }));

    res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch assigned classes' });
  }
}

export async function getClassStudents(req: Request, res: Response): Promise<void> {
  try {
    const { classId } = req.params;
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    // Backend Authorization Check: If Faculty, verify class belongs to them!
    const hasAccess = await checkFacultyClassAccess(user.id, user.role, classId);
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Forbidden: You do not have access to view this class' });
      return;
    }

    const cls = await db.queryOne<any>(
      `SELECT c.*, d.name as department_name, d.code as department_code 
       FROM classes c 
       JOIN departments d ON c.department_id = d.id 
       WHERE c.id = ? OR c.name = ?`,
      [classId, classId]
    );

    if (!cls) {
      res.status(404).json({ success: false, error: 'Class not found' });
      return;
    }

    const students = await db.query<any>(
      `SELECT s.id, s.register_number, s.name, s.parent_name, s.parent_phone, s.email, s.class_id, s.year, s.section,
              p.parent_name as parent_pname, p.mobile_number as parent_pmobile
       FROM students s
       LEFT JOIN parents p ON p.student_id = s.id
       WHERE s.class_id = ?
       ORDER BY s.register_number ASC`,
      [cls.id]
    );

    // Section 8 & 17: Mask parent phone numbers for privacy (******3210)
    const sanitizedStudents = students.map(s => {
      const pName = s.parent_name || s.parent_pname || `${s.name}'s Parent`;
      const rawPhone = s.parent_phone || s.parent_pmobile || '';
      const maskedPhone = rawPhone.length >= 4 ? '******' + rawPhone.slice(-4) : '******';
      return {
        id: s.id,
        register_number: s.register_number,
        name: s.name,
        parent_name: pName,
        parent_phone_masked: maskedPhone,
        email: s.email,
        class_id: s.class_id
      };
    });

    res.json({
      success: true,
      classInfo: {
        id: cls.id,
        name: cls.name || `${cls.department_code}-${cls.section}`,
        department_name: cls.department_name,
        department_code: cls.department_code,
        semester: cls.semester || (cls.year ? `Semester ${Number(cls.year) * 2 - 1}` : 'Semester 5'),
        academic_year: cls.academic_year,
        total_students: sanitizedStudents.length
      },
      data: sanitizedStudents
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve class students' });
  }
}

// ==============================================================================
// 6. Subjects
// ==============================================================================
export async function getSubjects(req: Request, res: Response): Promise<void> {
  try {
    const { department_id, semester } = req.query;
    let queryStr = `
      SELECT sub.*, d.name as department_name, d.code as department_code
      FROM subjects sub
      LEFT JOIN departments d ON sub.department_id = d.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (department_id) {
      queryStr += ' AND sub.department_id = ?';
      params.push(department_id);
    }
    if (semester) {
      queryStr += ' AND sub.semester = ?';
      params.push(semester);
    }
    queryStr += ' ORDER BY sub.semester ASC, sub.subject_code ASC';

    const subjects = await db.query<any>(queryStr, params);
    res.json({ success: true, data: subjects });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch subjects' });
  }
}

export async function createSubject(req: Request, res: Response): Promise<void> {
  try {
    const { subject_code, subject_name, max_marks, pass_marks, semester, department_id } = req.body;
    if (!subject_code || !subject_name || !department_id) {
      res.status(400).json({ success: false, error: 'Subject code, name, and department are required' });
      return;
    }
    const id = `sub-${subject_code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    const maxVal = Number(max_marks) || 100;
    const passVal = pass_marks !== undefined && pass_marks !== null && pass_marks !== ''
      ? Number(pass_marks)
      : Math.round(maxVal * 0.5);
    const sem = String(semester || '5').trim();

    await db.execute(
      'INSERT INTO subjects (id, subject_code, subject_name, max_marks, pass_marks, semester, department_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, subject_code.toUpperCase().trim(), subject_name.trim(), maxVal, passVal, sem, department_id]
    );
    await logAudit(req.user?.id, 'ADMIN_CREATED_SUBJECT', 'subjects', id, { subject_code, subject_name, max_marks: maxVal });
    res.status(201).json({ success: true, data: { id, subject_code, subject_name, max_marks: maxVal, pass_marks: passVal, semester: sem } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to create subject' });
  }
}

export async function updateSubject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { subject_name, max_marks, pass_marks, semester, department_id } = req.body;
    const existing = await db.queryOne('SELECT * FROM subjects WHERE id = ?', [id]);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Subject not found' });
      return;
    }

    const maxVal = max_marks !== undefined ? Number(max_marks) : existing.max_marks;
    const passVal = pass_marks !== undefined ? Number(pass_marks) : (existing.pass_marks || Math.round(maxVal * 0.5));
    const sem = semester !== undefined ? String(semester).trim() : (existing.semester || '5');
    const name = subject_name ? subject_name.trim() : existing.subject_name;
    const deptId = department_id || existing.department_id;

    await db.execute(
      'UPDATE subjects SET subject_name = ?, max_marks = ?, pass_marks = ?, semester = ?, department_id = ? WHERE id = ?',
      [name, maxVal, passVal, sem, deptId, id]
    );
    await logAudit(req.user?.id, 'ADMIN_UPDATED_SUBJECT', 'subjects', id, { name, max_marks: maxVal });
    res.json({ success: true, message: 'Subject updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to update subject' });
  }
}

export async function deleteSubject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM subjects WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'ADMIN_DELETED_SUBJECT', 'subjects', id);
    res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to delete subject' });
  }
}

// ==============================================================================
// 7. Exams (with Class association & Faculty authorization)
// ==============================================================================
export async function getExams(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    const { class_id } = req.query;

    let queryStr = `
      SELECT e.*, c.name as class_name, c.section as class_section,
             d.name as department_name, d.code as department_code,
             (SELECT COUNT(DISTINCT student_id) FROM marks m WHERE m.exam_id = e.id) as students_marked_count
      FROM exams e
      LEFT JOIN classes c ON e.class_id = c.id
      LEFT JOIN departments d ON (e.department_id = d.id OR c.department_id = d.id)
      WHERE 1=1
    `;
    const params: any[] = [];

    if (user?.role === 'FACULTY') {
      const assignedClassIds = await getFacultyAssignedClassIds(user.id);
      if (assignedClassIds.length === 0) {
        res.json({ success: true, data: [] });
        return;
      }
      const placeholders = assignedClassIds.map(() => '?').join(',');
      queryStr += ` AND (e.class_id IN (${placeholders}) OR e.class_id IS NULL)`;
      params.push(...assignedClassIds);
    }

    if (class_id) {
      queryStr += ' AND e.class_id = ?';
      params.push(class_id);
    }

    queryStr += ' ORDER BY e.created_at DESC';
    const exams = await db.query<any>(queryStr, params);

    const formatted = exams.map(e => ({
      ...e,
      name: e.name || e.exam_name,
      exam_name: e.name || e.exam_name,
      class_name: e.class_name || 'General'
    }));

    res.json({ success: true, data: formatted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch exams' });
  }
}

export async function createExam(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    const { exam_name, name, academic_year, semester, exam_date, department_id, class_id } = req.body;
    const finalName = (exam_name || name || '').trim();

    if (!finalName || !academic_year || !semester) {
      res.status(400).json({ success: false, error: 'Exam name, academic year, and semester are required' });
      return;
    }

    // If faculty creates exam, verify class_id authorization
    if (user?.role === 'FACULTY') {
      if (!class_id) {
        res.status(400).json({ success: false, error: 'Class selection is required for exam creation' });
        return;
      }
      const hasAccess = await checkFacultyClassAccess(user.id, user.role, class_id);
      if (!hasAccess) {
        res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to create an exam for this class' });
        return;
      }
    }

    const id = `exam-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await db.execute(
      'INSERT INTO exams (id, name, exam_name, academic_year, semester, department_id, class_id, created_by, exam_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, finalName, finalName, academic_year.trim(), semester.trim(), department_id || null, class_id || null, user?.id || null, exam_date || null]
    );

    await logAudit(user?.id, user?.role === 'ADMIN' ? 'ADMIN_CREATED_EXAM' : 'FACULTY_CREATED_EXAM', 'exams', id, {
      exam_name: finalName,
      class_id,
      academic_year
    });

    res.status(201).json({ success: true, data: { id, name: finalName, exam_name: finalName, academic_year, semester, class_id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to create exam' });
  }
}

export async function deleteExam(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const user = req.user;
    if (user?.role === 'FACULTY') {
      const exam = await db.queryOne<any>('SELECT * FROM exams WHERE id = ?', [id]);
      if (exam && exam.class_id) {
        const hasAccess = await checkFacultyClassAccess(user.id, user.role, exam.class_id);
        if (!hasAccess) {
          res.status(403).json({ success: false, error: 'Forbidden: You cannot delete an exam for this class' });
          return;
        }
      }
    }
    await db.execute('DELETE FROM exams WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'DELETED_EXAM', 'exams', id);
    res.json({ success: true, message: 'Exam deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message || 'Failed to delete exam' });
  }
}

// ==============================================================================
// 8. Audit Logs
// ==============================================================================
export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const logs = await db.query<any>(`
      SELECT al.*, u.name as user_name, u.email as user_email, u.role as user_role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
}

