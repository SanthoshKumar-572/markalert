import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { db } from '../database/db';
import { excelService, ColumnMapping, ValidationResult } from '../services/excel/excelService';
import { logAudit, verifyExamAccess, checkFacultyClassAccess } from '../middleware/auth';

// In-memory cache for recent validation results keyed by uploadId
const validationCache = new Map<string, ValidationResult>();

export async function uploadExcelFile(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No Excel file uploaded. Please select a .xlsx or .xls file.' });
      return;
    }

    const { originalname, path: filePath } = req.file;
    const fileBuffer = fs.readFileSync(filePath);

    // Parse Excel to verify readability and extract columns
    let parsed: { columns: string[]; rows: any[] };
    try {
      parsed = excelService.parseExcel(fileBuffer);
    } catch (parseErr: any) {
      fs.unlinkSync(filePath);
      res.status(400).json({ success: false, error: `Invalid Excel file format: ${parseErr.message}` });
      return;
    }

    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await db.execute(
      `INSERT INTO uploaded_files (id, file_name, file_path, uploaded_by, total_rows, valid_rows, error_rows, status)
       VALUES (?, ?, ?, ?, ?, 0, 0, 'UPLOADED')`,
      [uploadId, originalname, filePath, req.user?.id || null, parsed.rows.length]
    );

    // Fetch subjects to automatically guess mapping
    const subjects = await db.query<any>('SELECT id, subject_code, subject_name FROM subjects');
    const suggestedMapping = excelService.detectColumnMapping(
      parsed.columns,
      subjects.map(s => ({ id: s.id, name: s.subject_name, code: s.subject_code }))
    );

    await logAudit(req.user?.id, 'UPLOAD_EXCEL', 'uploaded_files', uploadId, {
      file_name: originalname,
      rows: parsed.rows.length
    });

    res.status(201).json({
      success: true,
      data: {
        uploadId,
        fileName: originalname,
        totalRows: parsed.rows.length,
        detectedColumns: parsed.columns,
        suggestedMapping,
        subjects
      }
    });
  } catch (err: any) {
    console.error('[Upload Excel Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to process Excel upload' });
  }
}

export async function validateUploadedFile(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { mapping, examId, classId } = req.body as { mapping: ColumnMapping; examId: string; classId?: string };

    if (!mapping || !examId) {
      res.status(400).json({ success: false, error: 'Column mapping and Exam ID are required for validation' });
      return;
    }

    // Backend Authorization Check: If Faculty, verify exam/class access
    if (req.user) {
      const examAuth = await verifyExamAccess(req.user.id, req.user.role, examId);
      if (!examAuth.authorized) {
        res.status(403).json({ success: false, error: examAuth.error || 'Forbidden: You do not have access to upload marks for this exam/class' });
        return;
      }
    }

    const uploadRecord = await db.queryOne<any>('SELECT * FROM uploaded_files WHERE id = ?', [id]);
    if (!uploadRecord) {
      res.status(404).json({ success: false, error: 'Uploaded file record not found' });
      return;
    }

    if (!fs.existsSync(uploadRecord.file_path)) {
      res.status(404).json({ success: false, error: 'Uploaded file was removed or is inaccessible on server' });
      return;
    }

    const fileBuffer = fs.readFileSync(uploadRecord.file_path);
    const parsed = excelService.parseExcel(fileBuffer);

    // Resolve classId from exam if not directly supplied
    let targetClassId = classId;
    if (!targetClassId && examId) {
      const examRec = await db.queryOne<any>('SELECT class_id FROM exams WHERE id = ?', [examId]);
      if (examRec?.class_id) {
        targetClassId = examRec.class_id;
      }
    }

    // Perform thorough validation with class matching
    const result = await excelService.validateExcel(parsed.rows, mapping, examId, uploadRecord.file_name, targetClassId);

    // Save in validation cache
    validationCache.set(id, result);

    // Update DB record
    await db.execute(
      `UPDATE uploaded_files
       SET total_rows = ?, valid_rows = ?, error_rows = ?, status = 'VALIDATED'
       WHERE id = ?`,
      [result.totalRows, result.validRows, result.errorRows, id]
    );

    res.json({ success: true, data: result });
  } catch (err: any) {
    console.error('[Validate Upload Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Validation failed' });
  }
}

export async function getUploadPreview(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, search } = req.query as { status?: string; search?: string };

    let validationResult = validationCache.get(id);

    // If not in cache, re-fetch from file and default mapping
    if (!validationResult) {
      const uploadRecord = await db.queryOne<any>('SELECT * FROM uploaded_files WHERE id = ?', [id]);
      if (!uploadRecord || !fs.existsSync(uploadRecord.file_path)) {
        res.status(404).json({ success: false, error: 'Upload record or file not found' });
        return;
      }

      const fileBuffer = fs.readFileSync(uploadRecord.file_path);
      const parsed = excelService.parseExcel(fileBuffer);
      const subjects = await db.query<any>('SELECT id, subject_code, subject_name FROM subjects');
      const defaultMapping = excelService.detectColumnMapping(
        parsed.columns,
        subjects.map(s => ({ id: s.id, name: s.subject_name, code: s.subject_code }))
      );

      const defaultExam = await db.queryOne<any>('SELECT id, class_id FROM exams ORDER BY created_at DESC LIMIT 1');
      validationResult = await excelService.validateExcel(
        parsed.rows,
        defaultMapping,
        defaultExam?.id || '',
        uploadRecord.file_name,
        defaultExam?.class_id
      );
      validationCache.set(id, validationResult);
    }

    let filteredRows = [...validationResult.rows];

    if (status && status !== 'ALL') {
      filteredRows = filteredRows.filter(r => r.status === status);
    }

    if (search) {
      const s = search.toLowerCase();
      filteredRows = filteredRows.filter(r =>
        r.registerNumber.toLowerCase().includes(s) ||
        r.studentName.toLowerCase().includes(s)
      );
    }

    res.json({
      success: true,
      data: {
        ...validationResult,
        rows: filteredRows
      }
    });
  } catch (err: any) {
    console.error('[Get Upload Preview Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve preview' });
  }
}

export async function downloadErrorReport(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const validationResult = validationCache.get(id);

    if (!validationResult) {
      res.status(404).json({ success: false, error: 'Validation data not found for this upload' });
      return;
    }

    const csvContent = excelService.generateErrorReport(validationResult);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=error_report_${validationResult.fileName}.csv`);
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to generate error report' });
  }
}

export async function importMarks(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { examId, onlyValidRows = true } = req.body;

    // Backend Authorization Check: If Faculty, verify exam/class access
    if (req.user) {
      const examAuth = await verifyExamAccess(req.user.id, req.user.role, examId);
      if (!examAuth.authorized) {
        res.status(403).json({ success: false, error: examAuth.error || 'Forbidden: You do not have access to import marks for this exam/class' });
        return;
      }
    }

    const validationResult = validationCache.get(id);
    if (!validationResult) {
      res.status(400).json({ success: false, error: 'Upload must be validated before importing marks' });
      return;
    }

    // Rows to import (strictly VALID or WARNING, never ERROR)
    const rowsToImport = validationResult.rows.filter(r =>
      onlyValidRows ? (r.status === 'VALID' || r.status === 'WARNING') : true
    );

    if (rowsToImport.length === 0) {
      res.status(400).json({ success: false, error: 'No valid rows available to import' });
      return;
    }

    // Fetch subjects from DB to get IDs
    const dbSubjects = await db.query<any>('SELECT id, subject_name, subject_code, max_marks FROM subjects');
    const subjectMap = new Map<string, any>();
    for (const sub of dbSubjects) {
      subjectMap.set(sub.subject_name.toLowerCase(), sub);
      if (sub.subject_code) subjectMap.set(sub.subject_code.toLowerCase(), sub);
    }

    let importedCount = 0;

    for (const row of rowsToImport) {
      // Find existing student by register number
      let student = await db.queryOne<any>('SELECT id, class_id FROM students WHERE UPPER(register_number) = ?', [row.registerNumber.toUpperCase()]);
      let studentId = student?.id;

      if (!studentId) {
        // Only create student if not tied to a specific class check, or keep existing roster intact
        studentId = `std-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        await db.execute(
          `INSERT INTO students (id, register_number, name) VALUES (?, ?, ?)`,
          [studentId, row.registerNumber, row.studentName]
        );

        if (row.parentMobileRaw) {
          const parentId = `parent-${studentId}`;
          await db.execute(
            `INSERT INTO parents (id, student_id, parent_name, mobile_number, whatsapp_number, sms_enabled, whatsapp_enabled)
             VALUES (?, ?, ?, ?, ?, 1, 1)`,
            [parentId, studentId, `${row.studentName}'s Parent`, row.parentMobileRaw, row.parentMobileRaw]
          );
        }
      }

      // Insert or update marks for each subject
      for (const [subjectName, marksObtained] of Object.entries(row.marks)) {
        const sub = subjectMap.get(subjectName.toLowerCase());
        if (!sub) continue;

        const maxMark = Number(sub.max_marks) || 100;
        const markId = `mark-${studentId}-${sub.id}-${examId}`;

        // Check if marks already exist
        const existingMark = await db.queryOne<any>(
          'SELECT id FROM marks WHERE student_id = ? AND subject_id = ? AND exam_id = ?',
          [studentId, sub.id, examId]
        );

        if (existingMark) {
          await db.execute(
            `UPDATE marks
             SET marks_obtained = ?, max_marks = ?, source_file = ?, entered_by = ?, updated_at = datetime('now')
             WHERE id = ?`,
            [marksObtained, maxMark, validationResult.fileName, req.user?.id || null, existingMark.id]
          );
        } else {
          await db.execute(
            `INSERT INTO marks (id, student_id, subject_id, exam_id, marks_obtained, max_marks, source_file, entered_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [markId, studentId, sub.id, examId, marksObtained, maxMark, validationResult.fileName, req.user?.id || null]
          );
        }
      }

      importedCount++;
    }

    // Update upload record status
    await db.execute(
      `UPDATE uploaded_files SET status = 'PROCESSED' WHERE id = ?`,
      [id]
    );

    const auditAction = req.user?.role === 'FACULTY' ? 'FACULTY_UPLOADED_MARKS' : 'ADMIN_UPLOADED_MARKS';
    await logAudit(req.user?.id, auditAction, 'marks', id, {
      exam_id: examId,
      imported_students: importedCount,
      file_name: validationResult.fileName
    });

    res.json({
      success: true,
      message: `Successfully imported marks for ${importedCount} students.`,
      importedCount
    });
  } catch (err: any) {
    console.error('[Import Marks Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to import marks' });
  }
}

export async function getUploads(req: Request, res: Response): Promise<void> {
  try {
    const uploads = await db.query<any>(`
      SELECT u.*, us.name as uploaded_by_name
      FROM uploaded_files u
      LEFT JOIN users us ON u.uploaded_by = us.id
      ORDER BY u.created_at DESC
      LIMIT 20
    `);
    res.json({ success: true, data: uploads });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve uploads' });
  }
}

// Download sample template
export async function downloadSampleTemplate(req: Request, res: Response): Promise<void> {
  try {
    const sampleDir = path.resolve(__dirname, '../../../sample_files');
    const samplePath = path.join(sampleDir, 'sample_marks_standard.xlsx');

    if (!fs.existsSync(samplePath)) {
      res.status(404).json({ success: false, error: 'Sample template file not found on server' });
      return;
    }

    res.download(samplePath, 'internal_marks_template.xlsx');
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to download sample template' });
  }
}
