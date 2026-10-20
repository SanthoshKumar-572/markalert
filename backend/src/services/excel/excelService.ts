import * as XLSX from 'xlsx';
import { db } from '../../database/db';

export interface ColumnMapping {
  registerNumberCol: string;
  studentNameCol: string;
  parentMobileCol: string;
  subjectCols: { [subjectId: string]: string }; // subjectId -> excel column name
}

export interface RowIssue {
  field: string;
  message: string;
  type: 'ERROR' | 'WARNING';
}

export interface PreviewRow {
  rowNumber: number;
  registerNumber: string;
  studentName: string;
  parentMobileMasked: string;
  parentMobileRaw?: string;
  marks: { [subjectName: string]: number };
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  result?: 'PASS' | 'FAIL';
  status: 'VALID' | 'WARNING' | 'ERROR';
  issues: RowIssue[];
  mobileSource: 'EXCEL' | 'DATABASE' | 'NONE';
  studentId?: string;
}

export interface ClassSyncSummary {
  classId?: string;
  className?: string;
  totalClassStudents: number;
  matchedCount: number;
  absentStudents: Array<{ registerNumber: string; name: string; parentMobileMasked: string }>;
  unrecognizedRegisterNumbers: string[];
}

export interface ValidationResult {
  fileName: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  detectedColumns: string[];
  suggestedMapping: ColumnMapping;
  rows: PreviewRow[];
  subjects: Array<{ id: string; name: string; code: string; maxMarks: number }>;
  classSync?: ClassSyncSummary;
}

// Helper to identify non-subject metadata columns (S.No, Register No, Names, Phone, Section, Totals, etc.)
export function isMetadataOrNonSubjectColumn(colName: string): boolean {
  if (!colName) return true;
  const norm = colName.trim().toLowerCase();
  // Serial numbers
  if (/^(s[\s._-]*no|sl[\s._-]*no|sno|serial[\s._-]*(no|num|number)?|#|id)$/i.test(norm)) return true;
  // Registration / Roll Numbers
  if (/^(reg(ister|istration)?[\s._-]*(no|num|number)?|roll[\s._-]*(no|num|number)?|std[\s._-]*id|usn|enrollment)$/i.test(norm)) return true;
  // Student & Parent Names
  if (/^((student|candidate)[\s._-]*)?name|full[\s._-]*name|first[\s._-]*name|last[\s._-]*name$/i.test(norm)) return true;
  if (/^parent[\s._-]*(name|guardian|father|mother)$/i.test(norm)) return true;
  // Mobile / Phone / Contacts
  if (/^(parent[\s._-]*)?(mobile|phone|contact|whatsapp|number|no)([\s._-]*(no|number|num))?$/i.test(norm)) return true;
  if (/^parent[\s._-]*(number|no|mobile|phone|contact)$/i.test(norm)) return true;
  // Section / Class / Dept / Academic Session
  if (/^(sec(tion)?|class|dept|department|year|sem(ester)?|academic[\s._-]*year|batch)$/i.test(norm)) return true;
  // Email
  if (/^(email|mail|e-mail)$/i.test(norm)) return true;
  // Totals, Results, Percentage, Remarks
  if (/^(total|grand[\s._-]*total|total[\s._-]*marks|percentage|%|result|status|grade|gpa|cgpa|remarks?|attendance|signature)$/i.test(norm)) return true;
  return false;
}

export class ExcelService {
  // Parse file buffer into raw JSON rows and column names
  public parseExcel(buffer: Buffer): { columns: string[]; rows: any[] } {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      throw new Error('The uploaded Excel sheet contains no data rows.');
    }

    const columns = Object.keys(rawRows[0] || {});
    return { columns, rows: rawRows };
  }

  // Detect and guess column mappings intelligently
  public detectColumnMapping(columns: string[], subjects: Array<{ id: string; name: string; code: string }>): ColumnMapping {
    let registerNumberCol = '';
    let studentNameCol = '';
    let parentMobileCol = '';
    const subjectCols: { [subjectId: string]: string } = {};

    const regRegex = /^(reg(ister|istration)?[\s._-]*(no|num|number)?|std[\s._-]*id|roll[\s._-]*(no|number)?|usn)$/i;
    const nameRegex = /^(student[\s._-]*)?name|full[\s._-]*name$/i;
    const phoneRegex = /^((student|parent)[\s._-]*)?(mobile|phone|contact|whatsapp)([\s._-]*(no|number|num))?$/i;

    for (const col of columns) {
      const normalized = col.trim();

      if (!registerNumberCol && regRegex.test(normalized)) {
        registerNumberCol = col;
        continue;
      }

      if (!studentNameCol && nameRegex.test(normalized)) {
        studentNameCol = col;
        continue;
      }

      if (!parentMobileCol && (phoneRegex.test(normalized) || /^(student|parent)[\s._-]*(number|no|mobile|phone)$/i.test(normalized))) {
        parentMobileCol = col;
        continue;
      }
    }

    // Secondary fallback search if strict regex didn't match
    if (!registerNumberCol) {
      registerNumberCol = columns.find(c => /reg|roll/i.test(c) && !/s[\s._-]*no|sl[\s._-]*no/i.test(c)) || '';
    }
    if (!studentNameCol) {
      studentNameCol = columns.find(c => /name/i.test(c) && !/parent/i.test(c)) || '';
    }
    if (!parentMobileCol) {
      parentMobileCol = columns.find(c => /mobile|phone|contact/i.test(c)) || '';
    }

    // Candidate columns for subjects: Strictly exclude non-subject metadata columns!
    const candidateCols = columns.filter(c =>
      c !== registerNumberCol &&
      c !== studentNameCol &&
      c !== parentMobileCol &&
      !isMetadataOrNonSubjectColumn(c)
    );

    // Match subjects
    for (const sub of subjects) {
      const sName = (sub.name || (sub as any).subject_name || '').trim().toLowerCase();
      const sCode = (sub.code || (sub as any).subject_code || '').trim().toLowerCase();
      const firstWord = sName.split(' ')[0] || '';
      const acronym = sName.split(/[\s-]+/).map((w: string) => w[0]).join('').toLowerCase();

      const matched = candidateCols.find(c => {
        const colNorm = c.trim().toLowerCase();
        // Never match if col is metadata
        if (isMetadataOrNonSubjectColumn(c)) return false;

        if (sName && (colNorm === sName || colNorm.includes(sName) || sName.includes(colNorm))) return true;
        if (sCode && (colNorm === sCode || colNorm.includes(sCode) || sCode.includes(colNorm))) return true;
        if (acronym && acronym.length >= 2 && colNorm === acronym) return true;
        if (firstWord && firstWord.length >= 3 && (colNorm.includes(firstWord) || firstWord.includes(colNorm))) return true;
        // Domain-specific IT semester 5 aliases
        if ((colNorm === 'cn' || colNorm.includes('network')) && (sCode === 'it301' || sName.includes('network') || sName === 'cn')) return true;
        if ((colNorm === 'sta' || colNorm.includes('testing') || colNorm.includes('automation')) && (sCode === 'it302' || sName.includes('testing') || sName === 'sta')) return true;
        if ((colNorm === 'iot' || colNorm.includes('iot') || colNorm.includes('embedded') || colNorm.includes('embeed')) && (sCode === 'it303' || sName.includes('iot') || sName.includes('embedded') || sName === 'iot')) return true;
        if ((colNorm === 'bda' || colNorm.includes('big data') || colNorm.includes('analytics')) && (sCode === 'it304' || sName.includes('big data') || sName === 'bda')) return true;
        if ((colNorm === 'fswd' || colNorm.includes('full stack') || colNorm.includes('stack')) && (sCode === 'it305' || sName.includes('stack') || sName === 'fswd')) return true;
        if ((colNorm === 'dc' || colNorm.includes('distributed') || colNorm.includes('distirbuted')) && (sCode === 'it306' || sName.includes('distributed') || sName === 'dc')) return true;

        // Common college subject abbreviations (DBMS, OS, Maths, etc.)
        if (colNorm === 'dbms' && sName.includes('database')) return true;
        if (colNorm === 'os' && sName.includes('operating')) return true;
        if (colNorm.startsWith('math') && sName.includes('math')) return true;
        return false;
      });
      if (matched) {
        subjectCols[sub.id] = matched;
      }
    }

    return { registerNumberCol, studentNameCol, parentMobileCol, subjectCols };
  }

  // Sanitize and validate Indian phone number
  public validatePhoneNumber(raw: any): { isValid: boolean; sanitized: string; error?: string } {
    if (!raw && raw !== 0) {
      return { isValid: false, sanitized: '', error: 'Mobile number is required' };
    }

    let cleaned = String(raw).replace(/\D/g, '');

    // Strip leading 0 or +91
    if (cleaned.length === 11 && cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
      cleaned = cleaned.substring(2);
    }

    if (cleaned.length !== 10) {
      return { isValid: false, sanitized: cleaned, error: `Invalid mobile length (${cleaned.length} digits, must be 10)` };
    }

    // Indian mobile numbers must start with 6, 7, 8, or 9
    if (!/^[6-9]/.test(cleaned)) {
      return { isValid: false, sanitized: cleaned, error: 'Mobile number must start with 6, 7, 8, or 9' };
    }

    // Check for repetitive digits (e.g. 0000000000 or 9999999999)
    if (/^(\d)\1{9}$/.test(cleaned)) {
      return { isValid: false, sanitized: cleaned, error: 'Mobile number has repeating identical digits' };
    }

    return { isValid: true, sanitized: cleaned };
  }

  // Mask mobile number for privacy (Section 9: ******3210)
  public maskPhoneNumber(phone: string): string {
    if (!phone || phone.length < 4) return '******';
    const lastFour = phone.slice(-4);
    return '******' + lastFour;
  }

  // Full validation pipeline with Constant Class Master matching
  public async validateExcel(
    rows: any[],
    mapping: ColumnMapping,
    examId: string,
    fileName: string = 'internal_marks.xlsx',
    classId?: string
  ): Promise<ValidationResult> {
    // 1. Fetch available subjects from DB
    const dbSubjects = await db.query<any>('SELECT id, subject_code, subject_name, max_marks FROM subjects');

    // 2. Fetch constant registered students for selected class or all
    let classQuery = `
      SELECT s.id, s.register_number, s.name, s.class_id, p.mobile_number, p.parent_name,
             c.name as class_name, c.year as class_year, c.section as class_section, d.name as department_name, d.code as department_code
      FROM students s
      LEFT JOIN parents p ON p.student_id = s.id
      LEFT JOIN classes c ON s.class_id = c.id
      LEFT JOIN departments d ON s.department_id = d.id
    `;
    const classParams: any[] = [];
    let targetClassName = '';
    if (classId) {
      const clsRec = await db.queryOne<any>('SELECT * FROM classes WHERE id = ? OR name = ?', [classId, classId]);
      if (clsRec) {
        targetClassName = clsRec.name || clsRec.id;
        classQuery += ` WHERE (s.class_id = ? OR s.class_id = ?)`;
        classParams.push(clsRec.id, classId);
      } else {
        classQuery += ` WHERE s.class_id = ?`;
        classParams.push(classId);
      }
    }
    classQuery += ` ORDER BY s.register_number ASC`;

    const dbClassStudents = await db.query<any>(classQuery, classParams);
    const classStudentMap = new Map<string, any>();
    for (const std of dbClassStudents) {
      if (std.register_number) {
        classStudentMap.set(std.register_number.trim().toUpperCase(), std);
      }
    }

    // Also fetch all students across institution as fallback
    const allDbStudents = await db.query<any>(`
      SELECT s.id, s.register_number, s.name, s.class_id, p.mobile_number, p.parent_name
      FROM students s
      LEFT JOIN parents p ON p.student_id = s.id
    `);
    const studentMap = new Map<string, any>();
    for (const std of allDbStudents) {
      if (std.register_number) {
        studentMap.set(std.register_number.trim().toUpperCase(), std);
      }
    }

    const seenRegisterNumbers = new Map<string, number>(); // regNo -> first row seen
    const seenParentMobiles = new Map<string, number>();
    const matchedClassRegNos = new Set<string>();
    const unrecognizedRegisterNumbers: string[] = [];

    const previewRows: PreviewRow[] = [];
    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    for (let index = 0; index < rows.length; index++) {
      const rowNum = index + 2; // Row in Excel (1-based header + 1-based data)
      const rawRow = rows[index];
      const issues: RowIssue[] = [];

      // A. Register Number
      const rawRegNo = String(rawRow[mapping.registerNumberCol] || '').trim();
      const regNo = rawRegNo.toUpperCase();

      if (!regNo) {
        issues.push({ field: 'Register Number', message: 'Register number is empty or missing', type: 'ERROR' });
      } else {
        if (seenRegisterNumbers.has(regNo)) {
          issues.push({
            field: 'Register Number',
            message: `Duplicate register number: '${regNo}' was already encountered on row ${seenRegisterNumbers.get(regNo)}`,
            type: 'ERROR'
          });
        } else {
          seenRegisterNumbers.set(regNo, rowNum);
        }
      }

      // Check against constant database
      const dbStudent = studentMap.get(regNo);
      const isClassStudent = classStudentMap.has(regNo);

      if (isClassStudent) {
        matchedClassRegNos.add(regNo);
      } else if (classId && regNo) {
        if (dbStudent) {
          matchedClassRegNos.add(regNo);
          issues.push({
            field: 'Register Number',
            message: `Student ${regNo} (${dbStudent.name}) is registered in ${dbStudent.class_name || 'different section'}, verified against master roster.`,
            type: 'WARNING'
          });
        } else {
          unrecognizedRegisterNumbers.push(regNo);
          issues.push({
            field: 'Register Number',
            message: `Register number ${regNo} not recognized in master database for ${targetClassName || 'selected class'}.`,
            type: 'WARNING'
          });
        }
      }

      // B. Student Name (Auto-fills from Constant Master DB if empty in Excel)
      const rawNameInExcel = mapping.studentNameCol ? String(rawRow[mapping.studentNameCol] || '').trim() : '';
      let studentName = rawNameInExcel;
      if (!rawNameInExcel) {
        if (dbStudent) {
          studentName = dbStudent.name; // Auto-filled from constant master!
          issues.push({ field: 'Student Name', message: 'Student name is missing in Excel (auto-filled from master database)', type: 'ERROR' });
        } else {
          issues.push({ field: 'Student Name', message: 'Student name is missing in Excel and database', type: 'ERROR' });
        }
      }

      // C. Student Mobile Number (Auto-fills from Constant Master DB if empty in Excel)
      let parentMobileRaw = String(rawRow[mapping.parentMobileCol] || '').trim();
      let mobileSource: 'EXCEL' | 'DATABASE' | 'NONE' = 'NONE';

      if (parentMobileRaw) {
        mobileSource = 'EXCEL';
      } else if (dbStudent && dbStudent.mobile_number) {
        parentMobileRaw = dbStudent.mobile_number;
        mobileSource = 'DATABASE';
      }

      let sanitizedPhone = '';
      if (!parentMobileRaw) {
        issues.push({ field: 'Student Mobile', message: 'Student mobile number missing in Excel and constant database', type: 'ERROR' });
      } else {
        const phoneValidation = this.validatePhoneNumber(parentMobileRaw);
        if (!phoneValidation.isValid) {
          issues.push({ field: 'Student Mobile', message: phoneValidation.error || 'Invalid mobile number', type: 'ERROR' });
        } else {
          sanitizedPhone = phoneValidation.sanitized;
          if (seenParentMobiles.has(sanitizedPhone)) {
            issues.push({
              field: 'Student Mobile',
              message: `Multiple students share mobile ${this.maskPhoneNumber(sanitizedPhone)} (Row ${seenParentMobiles.get(sanitizedPhone)})`,
              type: 'WARNING'
            });
          } else {
            seenParentMobiles.set(sanitizedPhone, rowNum);
          }
        }
      }

      // D. Marks Validation
      const marks: { [key: string]: number } = {};
      let totalMarks = 0;
      let totalMaxMarks = 0;
      let subjectCount = 0;

      for (const [subId, colName] of Object.entries(mapping.subjectCols)) {
        if (!colName) continue;
        const sub = dbSubjects.find(s => s.id === subId);
        const subName = sub ? sub.subject_name : colName;
        const maxMark = sub ? Number(sub.max_marks) : 20;

        const rawMarkVal = rawRow[colName];
        if (rawMarkVal === '' || rawMarkVal === undefined || rawMarkVal === null) {
          issues.push({ field: subName, message: `Mark is empty for subject '${subName}'`, type: 'WARNING' });
          continue;
        }

        const markNum = Number(rawMarkVal);
        if (isNaN(markNum)) {
          issues.push({ field: subName, message: `Mark '${rawMarkVal}' is not numeric for '${subName}'`, type: 'ERROR' });
        } else if (markNum < 0) {
          issues.push({ field: subName, message: `Mark (${markNum}) cannot be negative for '${subName}'`, type: 'ERROR' });
        } else if (maxMark > 0 && markNum > maxMark) {
          issues.push({ field: subName, message: `Mark (${markNum}) exceeds maximum allowed marks (${maxMark}) for '${subName}'`, type: 'ERROR' });
        } else {
          marks[subName] = markNum;
          totalMarks += markNum;
          totalMaxMarks += (maxMark > 0 ? maxMark : 100);
          subjectCount++;
        }
      }

      if (subjectCount === 0 && Object.keys(mapping.subjectCols).length > 0) {
        issues.push({ field: 'Marks', message: 'No valid subject marks found for this student', type: 'ERROR' });
      }

      const percentage = totalMaxMarks > 0 ? Number(((totalMarks / totalMaxMarks) * 100).toFixed(2)) : 0;

      // Determine Row Status
      const hasErrors = issues.some(i => i.type === 'ERROR');
      const hasWarnings = issues.some(i => i.type === 'WARNING');
      const rowStatus: 'VALID' | 'WARNING' | 'ERROR' = hasErrors ? 'ERROR' : (hasWarnings ? 'WARNING' : 'VALID');

      if (rowStatus === 'ERROR') errorCount++;
      else if (rowStatus === 'WARNING') warningCount++;
      else validCount++;

      const isAllPass = Object.values(marks).length > 0 && Object.values(marks).every(m => m >= 60);
      const resultVal: 'PASS' | 'FAIL' = isAllPass ? 'PASS' : 'FAIL';

      previewRows.push({
        rowNumber: rowNum,
        registerNumber: regNo || 'N/A',
        studentName: studentName || 'N/A',
        parentMobileMasked: this.maskPhoneNumber(sanitizedPhone),
        parentMobileRaw: sanitizedPhone,
        marks,
        totalMarks: Number(totalMarks.toFixed(2)),
        maxMarks: Number(totalMaxMarks.toFixed(2)),
        percentage,
        result: resultVal,
        status: rowStatus,
        issues,
        mobileSource,
        studentId: dbStudent?.id
      });
    }

    // Build Absent Students from Constant Class Roster
    const absentStudents: Array<{ registerNumber: string; name: string; parentMobileMasked: string }> = [];
    if (classId) {
      for (const [reg, std] of classStudentMap.entries()) {
        if (!matchedClassRegNos.has(reg)) {
          const phone = std.mobile_number || '';
          absentStudents.push({
            registerNumber: std.register_number,
            name: std.name,
            parentMobileMasked: phone.length >= 4 ? '******' + phone.slice(-4) : '******'
          });
        }
      }
    }

    let className: string | undefined = undefined;
    if (classId) {
      const cls = await db.queryOne<any>(`
        SELECT c.*, d.name as department_name, d.code as department_code
        FROM classes c
        JOIN departments d ON c.department_id = d.id
        WHERE c.id = ?
      `, [classId]);
      if (cls) {
        className = `${cls.department_code} - Year ${cls.year} (Sec ${cls.section})`;
      }
    }

    const classSync: ClassSyncSummary = {
      classId,
      className,
      totalClassStudents: dbClassStudents.length,
      matchedCount: matchedClassRegNos.size,
      absentStudents,
      unrecognizedRegisterNumbers
    };

    return {
      fileName,
      totalRows: rows.length,
      validRows: validCount,
      warningRows: warningCount,
      errorRows: errorCount,
      detectedColumns: Object.keys(rows[0] || {}),
      suggestedMapping: mapping,
      rows: previewRows,
      subjects: dbSubjects.map(s => ({
        id: s.id,
        name: s.subject_name,
        code: s.subject_code,
        maxMarks: Number(s.max_marks)
      })),
      classSync
    };
  }

  // Generate CSV error report string
  public generateErrorReport(result: ValidationResult): string {
    const errorRows = result.rows.filter(r => r.status === 'ERROR' || r.status === 'WARNING');
    const header = ['Row Number', 'Register Number', 'Student Name', 'Status', 'Field', 'Issue Description'].join(',');
    const lines = [header];

    for (const r of errorRows) {
      for (const issue of r.issues) {
        const line = [
          r.rowNumber,
          `"${r.registerNumber.replace(/"/g, '""')}"`,
          `"${r.studentName.replace(/"/g, '""')}"`,
          r.status,
          `"${issue.field.replace(/"/g, '""')}"`,
          `"${issue.message.replace(/"/g, '""')}"`
        ].join(',');
        lines.push(line);
      }
    }

    return lines.join('\n');
  }
}

export const excelService = new ExcelService();
