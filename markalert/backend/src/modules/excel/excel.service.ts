import * as XLSX from 'xlsx';
import { validateIndianPhone, maskPhone } from '../../utils/phone';

export interface ColumnMapping {
  registerNumberCol: string;
  studentNameCol?: string;
  parentNameCol?: string;
  parentMobileCol: string;
  subjectCols: Record<string, string>; // subjectName -> excel column name
}

export interface RowIssue {
  field: string;
  message: string;
  type: 'ERROR' | 'WARNING';
}

export interface ValidatedRecipientRow {
  rowNumber: number;
  registerNumber: string;
  studentName: string;
  parentName?: string;
  parentMobileSanitized: string;
  parentMobileFormatted: string;
  parentMobileMasked: string;
  marks: Record<string, number>;        // subjectName -> marksObtained
  maxMarks: Record<string, number>;     // subjectName -> maxMarks
  totalMarks: number;
  totalMaxMarks: number;
  percentage: number;
  status: 'VALID' | 'WARNING' | 'ERROR';
  issues: RowIssue[];
}

export interface ExcelValidationResult {
  fileName: string;
  sheetName: string;
  availableSheets: string[];
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  detectedColumns: string[];
  suggestedMapping: ColumnMapping;
  detectedSubjects: string[];
  rows: ValidatedRecipientRow[];
}

// Columns that should NEVER be treated as subjects
export function isMetadataOrNonSubjectColumn(colName: string): boolean {
  if (!colName) return true;
  const norm = colName.trim().toLowerCase();

  // S.No / Serial No / #
  if (/^(s[\s._-]*no|sl[\s._-]*no|sno|serial[\s._-]*(no|num|number)?|#|id)$/i.test(norm)) return true;

  // Register / Roll numbers
  if (/^(reg(ister|istration)?[\s._-]*(no|num|number)?|roll[\s._-]*(no|num|number)?|std[\s._-]*id|usn|enrollment)$/i.test(norm)) return true;

  // Student Names
  if (/^((student|candidate)[\s._-]*)?name|full[\s._-]*name|first[\s._-]*name|last[\s._-]*name$/i.test(norm)) return true;

  // Parent Names / Guardian Names
  if (/^parent[\s._-]*(name|guardian|father|mother)|guardian[\s._-]*name|father[\s._-]*name$/i.test(norm)) return true;

  // Mobile / Phone / WhatsApp
  if (/^(parent[\s._-]*)?(mobile|phone|contact|whatsapp|number|no)([\s._-]*(no|number|num))?$/i.test(norm)) return true;
  if (/^parent[\s._-]*(number|no|mobile|phone|contact)$/i.test(norm)) return true;
  if (/^(student|guardian)[\s._-]*(mobile|phone|contact|whatsapp)$/i.test(norm)) return true;

  // Department / Class / Section / Semester / Batch
  if (/^(sec(tion)?|class|dept|department|year|sem(ester)?|academic[\s._-]*year|batch)$/i.test(norm)) return true;

  // Email
  if (/^(email|mail|e-mail)$/i.test(norm)) return true;

  // Totals, Results, Percentage, Remarks, Grade, Signature
  if (/^(total|grand[\s._-]*total|total[\s._-]*marks|percentage|%|result|status|grade|gpa|cgpa|remarks?|attendance|signature|max[\s._-]*marks)$/i.test(norm)) return true;

  return false;
}

export class ExcelService {
  // Returns all worksheet names in workbook
  public getSheetNames(buffer: Buffer): string[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return workbook.SheetNames || [];
  }

  // Parse specified or first sheet into raw JSON rows and column names
  public parseSheet(
    buffer: Buffer,
    targetSheetName?: string
  ): { sheetName: string; availableSheets: string[]; columns: string[]; rows: any[] } {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const availableSheets = workbook.SheetNames || [];

    if (availableSheets.length === 0) {
      throw new Error('The uploaded Excel workbook contains no worksheets.');
    }

    const sheetName =
      targetSheetName && availableSheets.includes(targetSheetName)
        ? targetSheetName
        : availableSheets[0];

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<any>(sheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      throw new Error(`The worksheet '${sheetName}' contains no data rows.`);
    }

    const columns = Object.keys(rawRows[0] || {});
    return { sheetName, availableSheets, columns, rows: rawRows };
  }

  // Intelligently detect column mappings from column names
  public detectColumnMapping(columns: string[]): ColumnMapping {
    let registerNumberCol = '';
    let studentNameCol = '';
    let parentNameCol = '';
    let parentMobileCol = '';
    const subjectCols: Record<string, string> = {};

    const regRegex = /^(reg(ister|istration)?[\s._-]*(no|num|number)?|std[\s._-]*id|roll[\s._-]*(no|number)?|usn)$/i;
    const studentNameRegex = /^((student|candidate)[\s._-]*)?name|full[\s._-]*name$/i;
    const parentNameRegex = /^parent[\s._-]*(name|guardian|father|mother)|guardian[\s._-]*name|father[\s._-]*name$/i;
    const phoneRegex = /^((student|parent|guardian)[\s._-]*)?(mobile|phone|contact|whatsapp)([\s._-]*(no|number|num))?$/i;

    for (const col of columns) {
      const normalized = col.trim();

      // Register Number
      if (!registerNumberCol && regRegex.test(normalized)) {
        registerNumberCol = col;
        continue;
      }

      // Parent Name
      if (!parentNameCol && parentNameRegex.test(normalized)) {
        parentNameCol = col;
        continue;
      }

      // Student Name (must not match parent name)
      if (!studentNameCol && studentNameRegex.test(normalized) && !/parent|guardian|father/i.test(normalized)) {
        studentNameCol = col;
        continue;
      }

      // Parent Mobile
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
      studentNameCol = columns.find(c => /name/i.test(c) && !/parent|guardian|father|mother/i.test(c)) || '';
    }
    if (!parentNameCol) {
      parentNameCol = columns.find(c => /parent.*name|father.*name|guardian.*name/i.test(c)) || '';
    }
    if (!parentMobileCol) {
      parentMobileCol = columns.find(c => /mobile|phone|contact/i.test(c)) || '';
    }

    // Detect subject candidate columns: anything that isn't metadata, ID, or phone
    const candidateSubjectCols = columns.filter(c =>
      c !== registerNumberCol &&
      c !== studentNameCol &&
      c !== parentNameCol &&
      c !== parentMobileCol &&
      !isMetadataOrNonSubjectColumn(c)
    );

    for (const col of candidateSubjectCols) {
      // Use the column header as the subject name
      subjectCols[col.trim()] = col;
    }

    return {
      registerNumberCol,
      studentNameCol,
      parentNameCol: parentNameCol || undefined,
      parentMobileCol,
      subjectCols,
    };
  }

  // Comprehensive validation pipeline adhering to all 12 validation rules
  public validateRows(
    rows: any[],
    mapping: ColumnMapping,
    maxMarksMap: Record<string, number> = {},
    options?: { fileName?: string; sheetName?: string; availableSheets?: string[] }
  ): ExcelValidationResult {
    const fileName = options?.fileName || 'marks_upload.xlsx';
    const sheetName = options?.sheetName || 'Sheet1';
    const availableSheets = options?.availableSheets || [sheetName];
    const detectedColumns = rows.length > 0 ? Object.keys(rows[0]) : [];

    const seenRegisterNumbers = new Map<string, number>(); // regNo -> first row seen (1-based)
    const seenParentMobiles = new Map<string, number>();   // phone -> first row seen
    const previewRows: ValidatedRecipientRow[] = [];

    let validCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    const detectedSubjects = Object.keys(mapping.subjectCols);

    for (let index = 0; index < rows.length; index++) {
      const rowNum = index + 2; // Excel row numbering: Row 1 = headers, Row 2+ = data
      const rawRow = rows[index];
      const issues: RowIssue[] = [];

      // 1 & 2: Register Number validation
      const rawRegNo = mapping.registerNumberCol ? String(rawRow[mapping.registerNumberCol] ?? '').trim() : '';
      const regNo = rawRegNo.toUpperCase();

      if (!regNo) {
        issues.push({
          field: 'Register Number',
          message: 'Register number is empty or missing',
          type: 'ERROR',
        });
      } else {
        if (seenRegisterNumbers.has(regNo)) {
          issues.push({
            field: 'Register Number',
            message: `Duplicate register number '${regNo}' was already encountered on row ${seenRegisterNumbers.get(regNo)}`,
            type: 'ERROR',
          });
        } else {
          seenRegisterNumbers.set(regNo, rowNum);
        }
      }

      // 3: Student Name (Required only if studentNameCol is mapped, otherwise optional)
      const studentName = mapping.studentNameCol ? String(rawRow[mapping.studentNameCol] ?? '').trim() : '';
      if (mapping.studentNameCol && !studentName) {
        issues.push({
          field: 'Student Name',
          message: 'Student name is missing',
          type: 'ERROR',
        });
      }
      const effectiveStudentName = studentName || 'Student';

      // Parent Name (Optional)
      const parentName = mapping.parentNameCol ? String(rawRow[mapping.parentNameCol] ?? '').trim() : undefined;

      // 4 & 5: Parent Mobile validation (Indian standard format)
      const rawPhone = mapping.parentMobileCol ? rawRow[mapping.parentMobileCol] : undefined;
      const phoneValidation = validateIndianPhone(rawPhone);

      if (!phoneValidation.isValid) {
        issues.push({
          field: 'Parent Mobile',
          message: phoneValidation.error || 'Invalid mobile number',
          type: 'ERROR',
        });
      } else {
        if (seenParentMobiles.has(phoneValidation.sanitized)) {
          issues.push({
            field: 'Parent Mobile',
            message: `Mobile number ${phoneValidation.masked} is shared with student on row ${seenParentMobiles.get(phoneValidation.sanitized)}`,
            type: 'WARNING',
          });
        } else {
          seenParentMobiles.set(phoneValidation.sanitized, rowNum);
        }
      }

      // 6-10: Subject Marks validation
      const marks: Record<string, number> = {};
      const maxMarks: Record<string, number> = {};
      let totalMarks = 0;
      let totalMaxMarks = 0;
      let subjectCount = 0;

      for (const [subjectName, colName] of Object.entries(mapping.subjectCols)) {
        if (!colName) continue;
        const maxMark = maxMarksMap[subjectName] || 100;
        maxMarks[subjectName] = maxMark;

        const rawMarkVal = rawRow[colName];

        // Never convert missing marks into zero automatically
        if (rawMarkVal === '' || rawMarkVal === undefined || rawMarkVal === null) {
          issues.push({
            field: subjectName,
            message: `Mark is empty/missing for subject '${subjectName}'`,
            type: 'WARNING',
          });
          continue;
        }

        const markNum = Number(rawMarkVal);
        if (isNaN(markNum)) {
          issues.push({
            field: subjectName,
            message: `Mark '${rawMarkVal}' is not numeric for subject '${subjectName}'`,
            type: 'ERROR',
          });
        } else if (markNum < 0) {
          issues.push({
            field: subjectName,
            message: `Mark (${markNum}) cannot be negative for '${subjectName}'`,
            type: 'ERROR',
          });
        } else if (maxMark > 0 && markNum > maxMark) {
          issues.push({
            field: subjectName,
            message: `Mark (${markNum}) exceeds maximum allowed marks (${maxMark}) for '${subjectName}'`,
            type: 'ERROR',
          });
        } else {
          marks[subjectName] = markNum;
          totalMarks += markNum;
          totalMaxMarks += maxMark;
          subjectCount++;
        }
      }

      if (subjectCount === 0 && detectedSubjects.length > 0) {
        issues.push({
          field: 'Marks',
          message: 'No valid numeric subject marks found for this student',
          type: 'ERROR',
        });
      }

      const percentage = totalMaxMarks > 0 ? Number(((totalMarks / totalMaxMarks) * 100).toFixed(2)) : 0;

      const hasErrors = issues.some(i => i.type === 'ERROR');
      const hasWarnings = issues.some(i => i.type === 'WARNING');
      const rowStatus: 'VALID' | 'WARNING' | 'ERROR' = hasErrors ? 'ERROR' : (hasWarnings ? 'WARNING' : 'VALID');

      if (rowStatus === 'ERROR') errorCount++;
      else if (rowStatus === 'WARNING') warningCount++;
      else validCount++;

      previewRows.push({
        rowNumber: rowNum,
        registerNumber: regNo || 'N/A',
        studentName: effectiveStudentName,
        parentName: parentName || 'Parent/Guardian',
        parentMobileSanitized: phoneValidation.sanitized,
        parentMobileFormatted: phoneValidation.formattedE164,
        parentMobileMasked: phoneValidation.masked,
        marks,
        subjectMaxMarks: maxMarks,
        maxMarks: Number(totalMaxMarks.toFixed(2)),
        totalMarks: Number(totalMarks.toFixed(2)),
        totalMaxMarks: Number(totalMaxMarks.toFixed(2)),
        percentage,
        status: rowStatus,
        issues,
      });
    }

    return {
      fileName,
      sheetName,
      availableSheets,
      totalRows: rows.length,
      validRows: validCount,
      warningRows: warningCount,
      errorRows: errorCount,
      detectedColumns,
      suggestedMapping: mapping,
      detectedSubjects,
      rows: previewRows,
    };
  }

  // Generates downloadable CSV error report string
  public generateErrorReport(result: ExcelValidationResult): string {
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
          `"${issue.message.replace(/"/g, '""')}"`,
        ].join(',');
        lines.push(line);
      }
    }

    return lines.join('\n');
  }
}

export const excelService = new ExcelService();
