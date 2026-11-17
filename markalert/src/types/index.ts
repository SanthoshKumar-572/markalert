export type Role = 'ADMIN' | 'FACULTY';

export interface User {
  id: string;
  email: string;
  full_name: string;
  employee_id: string;
  role: Role;
  department: string;
  designation: string;
  mobile_number?: string | null;
  is_active?: boolean;
}

export type BatchStatus =
  | 'DRAFT'
  | 'VALIDATED'
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIAL'
  | 'FAILED';

export type NotificationChannel = 'WHATSAPP' | 'SMS';

export type NotificationStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'PROCESSING'
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'UNKNOWN';

export interface ColumnMapping {
  registerNumberCol: string;
  studentNameCol?: string;
  parentNameCol?: string;
  parentMobileCol: string;
  subjectCols: Record<string, string>;
}

export interface RowIssue {
  field: string;
  message: string;
  type: 'ERROR' | 'WARNING';
}

export interface ValidatedRow {
  rowNumber: number;
  id?: string;
  registerNumber: string;
  studentName: string;
  parentName?: string;
  parentMobileMasked: string;
  marks: Record<string, number>;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  status: 'VALID' | 'WARNING' | 'ERROR';
  issues: RowIssue[];
}

export interface ExcelUploadResponse {
  batchId: string;
  fileName: string;
  storedFileName: string;
  availableSheets: string[];
  activeSheet: string;
  totalRows: number;
  columns: string[];
  suggestedMapping: ColumnMapping;
  detectedSubjects: string[];
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
  rows: ValidatedRow[];
}

export interface MessagePreviewItem {
  recipientId: string;
  registerNumber: string;
  studentName: string;
  parentName: string;
  parentMobileMasked: string;
  parentMobile?: string;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
  renderedWhatsApp: string;
  renderedSMS: string;
}

export interface BatchPreviewResponse {
  batchId: string;
  examName: string;
  collegeName: string;
  totalRecipients: number;
  templates: {
    whatsapp: string;
    sms: string;
  };
  previews: MessagePreviewItem[];
}

export interface BatchStatusCounts {
  total: number;
  inProgress: number;
  sent: number;
  delivered: number;
  failed: number;
}

export interface BatchStatusResponse {
  batchId: string;
  examName: string;
  status: BatchStatus;
  createdAt: string;
  completedAt?: string | null;
  creator?: {
    full_name: string;
    department: string;
  };
  counts: BatchStatusCounts;
  channelBreakdown: Record<string, Record<string, number>>;
}

export interface NotificationBatch {
  id: string;
  created_by: string;
  exam_name: string;
  department?: string | null;
  class_name?: string | null;
  academic_year?: string | null;
  original_file_name: string;
  total_records: number;
  valid_records: number;
  invalid_records: number;
  total_notifications: number;
  batch_status: BatchStatus;
  created_at: string;
  completed_at?: string | null;
  creator?: {
    full_name: string;
    email: string;
    department: string;
  };
  _count?: {
    notifications: number;
    recipients: number;
  };
}

export interface NotificationRecord {
  id: string;
  batch_id: string;
  recipient_reference: string;
  channel: NotificationChannel;
  message_text: string;
  provider_message_id?: string | null;
  status: NotificationStatus;
  attempts: number;
  sent_at?: string | null;
  delivered_at?: string | null;
  failed_at?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  batch?: {
    exam_name: string;
    original_file_name: string;
  };
}

export interface DashboardOverview {
  totalBatches: number;
  totalNotifications: number;
  whatsappSent: number;
  smsSent: number;
  totalDelivered: number;
  totalFailed: number;
  facultyCount: number;
  deliveryRate: number;
  recentBatches: NotificationBatch[];
}

export interface MessageTemplate {
  id: string;
  name: string;
  channel: 'WHATSAPP' | 'SMS' | 'BOTH';
  template_text: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
