export type UserRole = 'ADMIN' | 'FACULTY';

export interface FacultyClassAssignment {
  id: string;
  assignment_id?: string;
  faculty_id: string;
  class_id: string;
  faculty_name?: string;
  faculty_email?: string;
  class_name?: string;
  class_year?: string;
  class_semester?: string;
  class_section?: string;
  department_name?: string;
  department_code?: string;
  academic_year?: string;
  assigned_at?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department_id?: string | null;
  department_name?: string;
  department_code?: string;
  is_active?: boolean;
  assigned_classes?: FacultyClassAssignment[];
}

export interface Department {
  id: string;
  name: string;
  code: string;
}

export interface ClassItem {
  id: string;
  name?: string;
  department_id: string;
  department_name?: string;
  department_code?: string;
  year: string;
  semester?: string;
  section: string;
  academic_year: string;
  student_count?: number;
  exam_count?: number;
  assigned_faculty?: FacultyClassAssignment[];
}

export interface Subject {
  id: string;
  subject_code: string;
  subject_name: string;
  max_marks: number;
  pass_marks?: number;
  semester?: string;
  department_id?: string;
  department_name?: string;
  department_code?: string;
}

export interface Exam {
  id: string;
  name?: string;
  exam_name: string;
  academic_year: string;
  semester: string;
  department_id?: string;
  class_id?: string;
  class_name?: string;
  exam_date?: string;
  created_by?: string;
  students_marked_count?: number;
}

export interface Student {
  id: string;
  register_number: string;
  name: string;
  email?: string;
  class_id?: string;
  department_id?: string;
  department_name?: string;
  department_code?: string;
  class_year?: string;
  class_section?: string;
  parent_name?: string;
  mobile_number?: string;
  mobile_number_masked?: string;
  student_mobile?: string;
  student_mobile_masked?: string;
  parent_mobile?: string;
  parent_mobile_masked?: string;
  parent_phone?: string;
  parent_phone_masked?: string;
  sms_enabled?: boolean;
  whatsapp_enabled?: boolean;
  marks?: any[];
  notifications?: any[];
}

export interface Parent {
  id: string;
  student_id: string;
  parent_name: string;
  mobile_number: string;
  mobile_number_masked?: string;
  whatsapp_number?: string;
  email?: string;
  sms_enabled: boolean;
  whatsapp_enabled: boolean;
  register_number?: string;
  student_name?: string;
  department_name?: string;
  class_section?: string;
}

export interface ColumnMapping {
  registerNumberCol: string;
  studentNameCol: string;
  parentMobileCol: string;
  subjectCols: { [subjectId: string]: string };
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

export interface MessagePreviewItem {
  studentId: string;
  registerNumber: string;
  studentName: string;
  parentName: string;
  parentMobileMasked: string;
  parentMobileRaw: string;
  renderedWhatsApp?: string;
  renderedSMS?: string;
  hasExistingSentNotification: boolean;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  result?: 'PASS' | 'FAIL';
  overallResult?: string;
  department?: string;
  className?: string;
  marks?: any;
  classSection?: string;
}

export interface NotificationRecord {
  id: string;
  batch_id?: string;
  student_id: string;
  student_name?: string;
  register_number?: string;
  exam_id: string;
  exam_name?: string;
  parent_name?: string;
  channel: 'WHATSAPP' | 'SMS';
  recipient: string;
  recipient_masked?: string;
  message: string;
  status: 'PENDING' | 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'RETRYING';
  provider_message_id?: string;
  error_message?: string;
  retry_count: number;
  last_error?: string;
  sent_at?: string;
  delivered_at?: string;
  created_at: string;
}

export interface NotificationBatch {
  id: string;
  exam_id: string;
  exam_name?: string;
  uploaded_file_id?: string;
  created_by?: string;
  created_by_name?: string;
  total_notifications: number;
  successful_notifications: number;
  failed_notifications: number;
  status: string;
  created_at: string;
  completed_at?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: string;
  template_text: string;
  body?: string;
  is_active: boolean;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
  action: string;
  entity: string;
  entity_id?: string;
  details?: string;
  created_at: string;
}

export interface DashboardStats {
  isAdmin?: boolean;
  facultyCount?: number;
  classesCount?: number;
  studentsCount: number;
  examsCount?: number;
  marksCount?: number;
  pendingCount?: number;
  notificationsSent: number;
  deliveredCount: number;
  failedCount: number;
  assignedClasses?: ClassItem[];
  recentUploads?: any[];
  recentBatches: any[];
  recentFailures: any[];
}
