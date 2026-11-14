export interface TemplateVariables {
  parent_name?: string;
  student_name?: string;
  register_number?: string;
  exam_name?: string;
  subject_name?: string;
  marks?: string;
  maximum_marks?: string | number;
  total?: string | number;
  percentage?: string | number;
  college_name?: string;
  overall_result?: string;
  [key: string]: string | number | undefined;
}

export interface SubjectMarkEntry {
  subjectName: string;
  marksObtained: number;
  maxMarks: number;
}

export function formatMarksBlock(marks: SubjectMarkEntry[]): string {
  if (!marks || marks.length === 0) return 'No marks recorded';
  return marks
    .map((m) => `• ${m.subjectName}: ${m.marksObtained}/${m.maxMarks}`)
    .join('\n');
}

export function buildTemplateVariables(
  recipient: any,
  batchExamName: string,
  collegeName: string
): TemplateVariables {
  const marksMap: Record<string, number> = JSON.parse(recipient.marks_data || '{}');
  const markEntries: SubjectMarkEntry[] = Object.entries(marksMap).map(([subjectName, marksObtained]) => ({
    subjectName,
    marksObtained: Number(marksObtained),
    maxMarks: 100,
  }));

  const marksBlock = formatMarksBlock(markEntries);

  // Overall result: Pass if all marks >= 50, otherwise Fail
  const allPassed = markEntries.length > 0 && markEntries.every(m => m.marksObtained >= 50);
  const overallResult = allPassed ? 'Pass' : 'Fail';

  const vars: TemplateVariables = {
    parent_name: recipient.parent_name || 'Parent/Guardian',
    student_name: recipient.student_name,
    register_number: recipient.register_number,
    exam_name: batchExamName,
    marks: marksBlock,
    total: Number(recipient.total_marks),
    maximum_marks: Number(recipient.max_marks),
    percentage: Number(recipient.percentage),
    college_name: collegeName,
    overall_result: overallResult,
  };

  // Populate individual subject placeholders: {SUBJECT_1}, {MARK_1}, {STATUS_1}, etc.
  markEntries.forEach((m, idx) => {
    const i = idx + 1;
    vars[`subject_${i}`] = m.subjectName;
    vars[`mark_${i}`] = m.marksObtained;
    vars[`max_${i}`] = m.maxMarks;
    vars[`status_${i}`] = m.marksObtained >= 50 ? 'Pass' : 'Fail';
  });

  return vars;
}

export function renderTemplate(template: string, vars: TemplateVariables): string {
  if (!template) return '';
  let result = template;

  for (const [key, val] of Object.entries(vars)) {
    if (val === undefined || val === null) continue;
    const strVal = String(val);

    // Replace {{key}}
    const regexDouble = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
    // Replace {key}
    const regexSingle = new RegExp(`\\{${key}\\}`, 'gi');

    result = result.replace(regexDouble, strVal).replace(regexSingle, strVal);
  }

  // Also support bracket tokens like [Student Name], [Parent Name], etc.
  const bracketMap: Record<string, string | number | undefined> = {
    'Student Name': vars.student_name,
    'Parent Name': vars.parent_name,
    'Register Number': vars.register_number,
    'Exam Name': vars.exam_name,
    'Marks': vars.marks,
    'Total Marks': vars.total,
    'Maximum Total': vars.maximum_marks,
    'Percentage': vars.percentage,
    'College Name': vars.college_name,
    'Overall Result': vars.overall_result,
  };

  for (const [bKey, bVal] of Object.entries(bracketMap)) {
    if (bVal !== undefined && bVal !== null) {
      const bRegex = new RegExp(`\\[${bKey}\\]`, 'gi');
      result = result.replace(bRegex, String(bVal));
    }
  }

  // Clean up any remaining unpopulated {SUBJECT_X} lines if student had fewer subjects than template
  result = result.replace(/^[^\n]*\{SUBJECT_\d+\}[^\n]*(\r?\n|$)/gmi, '');

  return result.trim();
}
