import { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { db } from '../database/db';
import { logAudit, checkFacultyClassAccess, getFacultyAssignedClassIds } from '../middleware/auth';

export async function getStudents(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    const { search, department_id, class_id, year, section } = req.query;

    let queryStr = `
      SELECT s.*,
             d.name as department_name, d.code as department_code,
             c.name as class_name, c.year as class_year, c.semester as class_semester, c.section as class_section,
             COALESCE(s.parent_name, p.parent_name) as parent_name,
             COALESCE(s.parent_phone, p.mobile_number) as mobile_number,
             p.whatsapp_number, p.email as parent_email,
             p.sms_enabled, p.whatsapp_enabled
      FROM students s
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN parents p ON p.student_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // Backend Authorization: If user is FACULTY, filter only to their assigned classes!
    if (user?.role === 'FACULTY') {
      const assignedClassIds = await getFacultyAssignedClassIds(user.id);
      if (assignedClassIds.length === 0) {
        res.json({ success: true, count: 0, data: [] });
        return;
      }
      const placeholders = assignedClassIds.map(() => '?').join(',');
      queryStr += ` AND (s.class_id IN (${placeholders}))`;
      params.push(...assignedClassIds);
    }

    if (search) {
      queryStr += ` AND (s.name LIKE ? OR s.register_number LIKE ? OR s.parent_name LIKE ? OR p.parent_name LIKE ? OR s.parent_phone LIKE ? OR p.mobile_number LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term);
    }

    if (department_id) {
      queryStr += ` AND (s.department_id = ? OR c.department_id = ?)`;
      params.push(department_id, department_id);
    }

    if (class_id) {
      // If faculty specified class_id, verify access
      if (user?.role === 'FACULTY') {
        const hasAccess = await checkFacultyClassAccess(user.id, user.role, String(class_id));
        if (!hasAccess) {
          res.status(403).json({ success: false, error: 'Forbidden: You do not have access to this class' });
          return;
        }
      }
      queryStr += ` AND (s.class_id = ? OR c.name = ?)`;
      params.push(class_id, class_id);
    }

    if (year) {
      queryStr += ` AND (s.year = ? OR c.year = ?)`;
      params.push(String(year), String(year));
    }

    if (section) {
      queryStr += ` AND (UPPER(s.section) = ? OR UPPER(c.section) = ?)`;
      params.push(String(section).toUpperCase(), String(section).toUpperCase());
    }

    queryStr += ` ORDER BY s.register_number ASC`;

    const students = await db.query<any>(queryStr, params);

    // Section 8 & 17: Masked phone numbers in standard API responses
    const sanitized = students.map(s => {
      const phone = s.mobile_number || s.parent_phone || '';
      const masked = phone.length >= 4 ? '******' + phone.slice(-4) : '******';
      return {
        ...s,
        parent_name: s.parent_name || `${s.name}'s Parent`,
        student_mobile: phone,
        student_mobile_masked: masked,
        parent_mobile: phone,
        parent_mobile_masked: masked,
        mobile_number_masked: masked,
        parent_phone_masked: masked,
        mobile_number: masked,
        parent_phone: masked
      };
    });

    res.json({ success: true, count: sanitized.length, data: sanitized });
  } catch (err: any) {
    console.error('[Get Students Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve students' });
  }
}

export async function getStudentById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const user = req.user;

    const student = await db.queryOne<any>(
      `SELECT s.*, d.name as department_name, c.name as class_name, c.year as class_year, c.section as class_section,
              p.id as parent_id, COALESCE(s.parent_name, p.parent_name) as parent_name,
              COALESCE(s.parent_phone, p.mobile_number) as mobile_number,
              p.whatsapp_number, p.email as parent_email,
              p.sms_enabled, p.whatsapp_enabled
       FROM students s
       LEFT JOIN departments d ON s.department_id = d.id
       LEFT JOIN classes c ON s.class_id = c.id
       LEFT JOIN parents p ON p.student_id = s.id
       WHERE s.id = ?`,
      [id]
    );

    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    // Backend Authorization Check: If Faculty, verify student belongs to their assigned class
    if (user?.role === 'FACULTY' && student.class_id) {
      const hasAccess = await checkFacultyClassAccess(user.id, user.role, student.class_id);
      if (!hasAccess) {
        res.status(403).json({ success: false, error: 'Forbidden: You do not have access to view this student' });
        return;
      }
    }

    // Get marks history
    const marks = await db.query<any>(
      `SELECT m.*, sub.subject_name, sub.subject_code, ex.exam_name, ex.academic_year
       FROM marks m
       JOIN subjects sub ON m.subject_id = sub.id
       JOIN exams ex ON m.exam_id = ex.id
       WHERE m.student_id = ?
       ORDER BY ex.created_at DESC, sub.subject_name ASC`,
      [id]
    );

    // Get notification history
    const notifications = await db.query<any>(
      `SELECT n.*, ex.exam_name
       FROM notifications n
       JOIN exams ex ON n.exam_id = ex.id
       WHERE n.student_id = ?
       ORDER BY n.created_at DESC`,
      [id]
    );

    const phone = student.mobile_number || student.parent_phone || '';
    const masked = phone.length >= 4 ? '******' + phone.slice(-4) : '******';

    res.json({
      success: true,
      data: {
        ...student,
        mobile_number_masked: masked,
        parent_phone_masked: masked,
        mobile_number: masked,
        parent_phone: masked,
        marks,
        notifications
      }
    });
  } catch (err: any) {
    console.error('[Get Student By ID Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve student details' });
  }
}

export async function createStudent(req: Request, res: Response): Promise<void> {
  try {
    const { register_number, name, email, department_id, class_id, year, section, parent_name, mobile_number } = req.body;

    if (!register_number || !name || !parent_name || !mobile_number) {
      res.status(400).json({ success: false, error: 'Register number, student name, parent name, and mobile number are required' });
      return;
    }

    const regNo = register_number.trim().toUpperCase();
    const existing = await db.queryOne<any>('SELECT id FROM students WHERE register_number = ?', [regNo]);
    if (existing) {
      res.status(400).json({ success: false, error: `Student with Register No '${regNo}' already exists.` });
      return;
    }

    const studentId = `std-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await db.execute(
      `INSERT INTO students (id, register_number, name, email, department_id, class_id, year, section)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentId, regNo, name.trim(), email?.trim() || null, department_id || null, class_id || null, year || null, section || null]
    );

    const parentId = `parent-${studentId}`;
    await db.execute(
      `INSERT INTO parents (id, student_id, parent_name, mobile_number, whatsapp_number, email, sms_enabled, whatsapp_enabled)
       VALUES (?, ?, ?, ?, ?, ?, 1, 1)`,
      [parentId, studentId, parent_name.trim(), mobile_number.trim(), mobile_number.trim(), null]
    );

    await logAudit(req.user?.id, 'CREATE_STUDENT', 'students', studentId, { register_number: regNo, name });

    res.status(201).json({ success: true, message: 'Student and parent created successfully', data: { id: studentId } });
  } catch (err: any) {
    console.error('[Create Student Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to create student' });
  }
}

export async function updateStudent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, email, department_id, class_id, year, section, parent_name, mobile_number } = req.body;

    const student = await db.queryOne<any>('SELECT * FROM students WHERE id = ?', [id]);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    await db.execute(
      `UPDATE students
       SET name = ?, email = ?, department_id = ?, class_id = ?, year = ?, section = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [name || student.name, email || student.email, department_id || student.department_id, class_id || student.class_id, year || student.year, section || student.section, id]
    );

    if (parent_name || mobile_number) {
      const parent = await db.queryOne<any>('SELECT id FROM parents WHERE student_id = ?', [id]);
      if (parent) {
        await db.execute(
          `UPDATE parents SET parent_name = COALESCE(?, parent_name), mobile_number = COALESCE(?, mobile_number), whatsapp_number = COALESCE(?, whatsapp_number), updated_at = datetime('now') WHERE id = ?`,
          [parent_name || null, mobile_number || null, mobile_number || null, parent.id]
        );
      }
    }

    await logAudit(req.user?.id, 'UPDATE_STUDENT', 'students', id, { name, mobile_number });

    res.json({ success: true, message: 'Student updated successfully' });
  } catch (err: any) {
    console.error('[Update Student Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to update student' });
  }
}

export async function deleteStudent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const student = await db.queryOne<any>('SELECT * FROM students WHERE id = ?', [id]);
    if (!student) {
      res.status(404).json({ success: false, error: 'Student not found' });
      return;
    }

    await db.execute('DELETE FROM students WHERE id = ?', [id]);
    await logAudit(req.user?.id, 'DELETE_STUDENT', 'students', id, { register_number: student.register_number });

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (err: any) {
    console.error('[Delete Student Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to delete student' });
  }
}

export async function getParents(req: Request, res: Response): Promise<void> {
  try {
    const { search } = req.query;
    let queryStr = `
      SELECT p.*, s.register_number, s.name as student_name, d.name as department_name, c.section as class_section
      FROM parents p
      JOIN students s ON p.student_id = s.id
      LEFT JOIN departments d ON s.department_id = d.id
      LEFT JOIN classes c ON s.class_id = c.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (search) {
      queryStr += ` AND (p.parent_name LIKE ? OR p.mobile_number LIKE ? OR s.name LIKE ? OR s.register_number LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }
    queryStr += ` ORDER BY s.register_number ASC`;

    const parents = await db.query<any>(queryStr, params);
    const isAdmin = req.user?.role === 'ADMIN';

    const data = parents.map(p => ({
      ...p,
      mobile_number_masked: p.mobile_number?.length >= 4 ? '******' + p.mobile_number.slice(-4) : '******',
      mobile_number: isAdmin ? p.mobile_number : ('******' + (p.mobile_number?.slice(-4) || ''))
    }));

    res.json({ success: true, count: data.length, data });
  } catch (err: any) {
    console.error('[Get Parents Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve parents' });
  }
}

export async function updateParent(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { parent_name, mobile_number, whatsapp_number, email, sms_enabled, whatsapp_enabled } = req.body;

    const parent = await db.queryOne<any>('SELECT * FROM parents WHERE id = ?', [id]);
    if (!parent) {
      res.status(404).json({ success: false, error: 'Parent record not found' });
      return;
    }

    await db.execute(
      `UPDATE parents
       SET parent_name = ?, mobile_number = ?, whatsapp_number = ?, email = ?,
           sms_enabled = ?, whatsapp_enabled = ?, updated_at = datetime('now')
       WHERE id = ?`,
      [
        parent_name ?? parent.parent_name,
        mobile_number ?? parent.mobile_number,
        whatsapp_number ?? parent.whatsapp_number,
        email ?? parent.email,
        sms_enabled !== undefined ? (sms_enabled ? 1 : 0) : parent.sms_enabled,
        whatsapp_enabled !== undefined ? (whatsapp_enabled ? 1 : 0) : parent.whatsapp_enabled,
        id
      ]
    );

    await logAudit(req.user?.id, 'UPDATE_PARENT', 'parents', id, { parent_name, mobile_number });

    res.json({ success: true, message: 'Parent details updated successfully' });
  } catch (err: any) {
    console.error('[Update Parent Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to update parent' });
  }
}

export async function importClassMaster(req: Request, res: Response): Promise<void> {
  try {
    const { class_id, department_id, year, section, academic_year = '2026-27', students } = req.body as {
      class_id?: string;
      department_id?: string;
      year?: string;
      section?: string;
      academic_year?: string;
      students: Array<{
        register_number: string;
        name: string;
        parent_name?: string;
        mobile_number?: string;
        student_mobile?: string;
        parent_mobile?: string;
        phone?: string;
        section?: string;
        email?: string;
      }>;
    };

    if (!class_id) {
      res.status(400).json({ success: false, error: 'Target Class is required for student enrollment.' });
      return;
    }

    if (!Array.isArray(students) || students.length === 0) {
      res.status(400).json({ success: false, error: 'Please provide at least one student record to upload.' });
      return;
    }

    const cls = await db.queryOne<any>('SELECT * FROM classes WHERE id = ? OR name = ?', [class_id, class_id]);
    if (!cls) {
      res.status(404).json({ success: false, error: 'Selected class does not exist.' });
      return;
    }

    const resolvedClassId = cls.id;
    const deptId = department_id || cls.department_id;
    const classYear = year || cls.year;
    const classSection = section || cls.section;

    // Validation pass
    const errors: string[] = [];
    const seenRegNosInFile = new Map<string, number>();
    const validRows: Array<{
      regNo: string;
      name: string;
      parentName: string;
      mobile: string;
      email: string | null;
      section: string;
    }> = [];

    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const rowNum = i + 1;
      const rawRegNo = String(s.register_number || '').trim();
      const regNo = rawRegNo.toUpperCase();
      const name = String(s.name || '').trim();
      const parentName = String(s.parent_name || '').trim() || `${name}'s Parent`;
      const rawMobile = String(s.mobile_number || s.student_mobile || s.parent_mobile || s.phone || '').trim();
      const rowSection = s.section ? String(s.section).trim().toUpperCase() : classSection;

      // 1. Register Number Validation
      if (!regNo) {
        errors.push(`Row ${rowNum}: Register number is missing.`);
        continue;
      }

      if (seenRegNosInFile.has(regNo)) {
        errors.push(`Row ${rowNum}: Duplicate register number '${regNo}' found in uploaded file (first seen on Row ${seenRegNosInFile.get(regNo)}).`);
        continue;
      }
      seenRegNosInFile.set(regNo, rowNum);

      // 2. Student Name Validation
      if (!name) {
        errors.push(`Row ${rowNum} (${regNo}): Student name is missing.`);
        continue;
      }

      // 3. Student Mobile Validation
      let mobile = rawMobile.replace(/\D/g, '');
      if (mobile.length === 11 && mobile.startsWith('0')) mobile = mobile.substring(1);
      else if (mobile.length === 12 && mobile.startsWith('91')) mobile = mobile.substring(2);

      if (!mobile || mobile.length !== 10 || !/^[6-9]/.test(mobile)) {
        errors.push(`Row ${rowNum} (${regNo}): Invalid student mobile number '${rawMobile}'. Must be a 10-digit Indian number.`);
        continue;
      }

      validRows.push({
        regNo,
        name,
        parentName,
        mobile,
        email: s.email ? String(s.email).trim() : null,
        section: rowSection
      });
    }

    // If there are validation errors, return them
    if (errors.length > 0 && validRows.length === 0) {
      res.status(400).json({
        success: false,
        error: `Validation failed with ${errors.length} error(s).`,
        errors
      });
      return;
    }

    let addedCount = 0;
    let updatedCount = 0;

    for (const v of validRows) {
      const existingStudent = await db.queryOne<any>('SELECT id FROM students WHERE UPPER(register_number) = ?', [v.regNo]);

      let studentId: string;
      if (existingStudent) {
        studentId = existingStudent.id;
        await db.execute(
          `UPDATE students
           SET name = ?, parent_name = ?, parent_phone = ?, email = COALESCE(?, email),
               class_id = ?, department_id = COALESCE(?, department_id),
               year = COALESCE(?, year), section = COALESCE(?, section), updated_at = datetime('now')
           WHERE id = ?`,
          [v.name, v.parentName, v.mobile, v.email, resolvedClassId, deptId, classYear, v.section, studentId]
        );
        updatedCount++;
      } else {
        studentId = `std-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await db.execute(
          `INSERT INTO students (id, register_number, name, parent_name, parent_phone, email, class_id, department_id, year, section)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [studentId, v.regNo, v.name, v.parentName, v.mobile, v.email, resolvedClassId, deptId, classYear, v.section]
        );
        addedCount++;
      }

      // Upsert Parent Record in sync
      const existingParent = await db.queryOne<any>('SELECT id FROM parents WHERE student_id = ?', [studentId]);
      if (existingParent) {
        await db.execute(
          `UPDATE parents
           SET parent_name = ?, mobile_number = ?, whatsapp_number = ?, email = COALESCE(?, email), updated_at = datetime('now')
           WHERE id = ?`,
          [v.parentName, v.mobile, v.mobile, v.email, existingParent.id]
        );
      } else {
        const parentId = `par-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        await db.execute(
          `INSERT INTO parents (id, student_id, parent_name, mobile_number, whatsapp_number, email)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [parentId, studentId, v.parentName, v.mobile, v.mobile, v.email]
        );
      }
    }

    await logAudit(req.user?.id, 'ADMIN_UPLOADED_STUDENTS', 'classes', resolvedClassId, {
      class_id: resolvedClassId,
      class_name: cls.name,
      total_uploaded: students.length,
      saved_count: validRows.length,
      added: addedCount,
      updated: updatedCount,
      errors_count: errors.length
    });

    res.json({
      success: true,
      count: validRows.length,
      addedCount,
      updatedCount,
      errors,
      message: `Successfully registered ${validRows.length} students to class ${cls.name || resolvedClassId} (${addedCount} new, ${updatedCount} updated).`
    });
  } catch (err: any) {
    console.error('[Import Class Students Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to upload students' });
  }
}

export async function downloadSampleClassTemplate(req: Request, res: Response): Promise<void> {
  try {
    const data = [
      {
        'Register Number': '9225242025001',
        'Student Name': 'Arun Kumar',
        'Parent Name': 'Ravi Kumar',
        'Student Mobile Number': '9876543210'
      },
      {
        'Register Number': '9225242025002',
        'Student Name': 'Bala Kumar',
        'Parent Name': 'Kumar',
        'Student Mobile Number': '9876543211'
      },
      {
        'Register Number': '9225242025003',
        'Student Name': 'Karthik Raja',
        'Parent Name': 'Raja',
        'Student Mobile Number': '9876543212'
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Students_Roster');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sample_class_students_roster.xlsx');
    res.send(buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to generate sample roster template' });
  }
}

export async function eraseDuplicates(req: Request, res: Response): Promise<void> {
  try {
    let deletedCount = 0;

    // 1. Remove duplicate parents per student_id (keep latest)
    const duplicateParents = await db.query<any>(`
      SELECT student_id, count(*) as c 
      FROM parents 
      GROUP BY student_id 
      HAVING c > 1
    `);

    for (const dp of duplicateParents) {
      const allForStudent = await db.query<any>(
        'SELECT id FROM parents WHERE student_id = ? ORDER BY updated_at DESC, created_at DESC',
        [dp.student_id]
      );
      for (let i = 1; i < allForStudent.length; i++) {
        await db.execute('DELETE FROM parents WHERE id = ?', [allForStudent[i].id]);
        deletedCount++;
      }
    }

    // 2. Remove orphan parents (no valid student)
    const orphanParents = await db.query<any>(`
      SELECT p.id FROM parents p
      LEFT JOIN students s ON p.student_id = s.id
      WHERE s.id IS NULL
    `);
    for (const op of orphanParents) {
      await db.execute('DELETE FROM parents WHERE id = ?', [op.id]);
      deletedCount++;
    }

    // 3. Remove duplicate students by uppercase register_number (keep latest)
    const duplicateStudents = await db.query<any>(`
      SELECT UPPER(register_number) as reg, count(*) as c
      FROM students
      GROUP BY UPPER(register_number)
      HAVING c > 1
    `);

    for (const ds of duplicateStudents) {
      const allForReg = await db.query<any>(
        'SELECT id FROM students WHERE UPPER(register_number) = ? ORDER BY updated_at DESC, created_at DESC',
        [ds.reg]
      );
      const keepId = allForReg[0].id;
      for (let i = 1; i < allForReg.length; i++) {
        const removeId = allForReg[i].id;
        await db.execute('UPDATE marks SET student_id = ? WHERE student_id = ?', [keepId, removeId]);
        await db.execute('DELETE FROM parents WHERE student_id = ?', [removeId]);
        await db.execute('DELETE FROM students WHERE id = ?', [removeId]);
        deletedCount++;
      }
    }

    await logAudit(req.user?.id, 'ERASE_DUPLICATES', 'system', 'all', { deleted_duplicates: deletedCount });

    res.json({
      success: true,
      message: deletedCount > 0 ? `Successfully erased ${deletedCount} duplicate/orphan records.` : 'Database is clean! No duplicate records found.',
      deletedCount
    });
  } catch (err: any) {
    console.error('[Erase Duplicates Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to erase duplicates' });
  }
}


