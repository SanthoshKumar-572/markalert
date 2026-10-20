import {
  User,
  Student,
  Parent,
  Department,
  ClassItem,
  Subject,
  Exam,
  ValidationResult,
  ColumnMapping,
  MessagePreviewItem,
  NotificationRecord,
  NotificationBatch,
  MessageTemplate,
  AuditLog,
  DashboardStats,
  FacultyClassAssignment
} from '../types';

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const savedUrl = localStorage.getItem('custom_api_url');
    if (savedUrl) return savedUrl.replace(/\/$/, '') + '/api';

    const isCapacitor = window.location.protocol === 'capacitor:' || window.location.protocol === 'file:' || (window as any).Capacitor?.isNativePlatform?.();
    if (isCapacitor) {
      return 'http://10.176.125.1:5000/api';
    }

    if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `http://${window.location.hostname}:5000/api`;
    }
  }

  return '/api';
}

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    ...getAuthHeader(),
    ...(options.headers || {})
  };

  const baseUrl = getApiBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${endpoint}`, {
      ...options,
      headers
    });
  } catch (err: any) {
    throw new Error('Unable to connect to the backend server. Please verify the server is running.');
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      !res.ok
        ? `Server error (${res.status}: ${res.statusText || 'Backend service unavailable'})`
        : 'Invalid response received from server'
    );
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.error || data.message || `Request failed (${res.status})`);
  }

  return data;
}

export const api = {
  // Auth
  auth: {
    async login(email: string, password: string): Promise<{ token: string; user: User }> {
      const res = await request<{ success: boolean; token: string; user: User }>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      return res;
    },
    async register(data: { name: string; email: string; password: string; department_id?: string }): Promise<{ token: string; user: User }> {
      const res = await request<{ success: boolean; token: string; user: User }>('/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      localStorage.setItem('token', res.token);
      localStorage.setItem('user', JSON.stringify(res.user));
      return res;
    },
    async getMe(): Promise<User> {
      const res = await request<{ success: boolean; user: User }>('/auth/me');
      return res.user;
    },
    logout() {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
    getCurrentUser(): User | null {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    },
    getToken(): string | null {
      return localStorage.getItem('token');
    }
  },

  // Dashboard & Reports
  reports: {
    async getDashboardStats(): Promise<DashboardStats> {
      const res = await request<{ success: boolean; data: DashboardStats }>('/reports/dashboard');
      return res.data;
    },
    async getStudentReport(params: { exam_id?: string; department_id?: string; class_id?: string; search?: string } = {}): Promise<any[]> {
      const qs = new URLSearchParams(params as any).toString();
      const res = await request<{ success: boolean; data: any[] }>(`/reports/students?${qs}`);
      return res.data;
    },
    async getClassReport(): Promise<any[]> {
      const res = await request<{ success: boolean; data: any[] }>('/reports/classes');
      return res.data;
    },
    async getNotificationAnalytics(): Promise<{ channelStats: any[]; dailyTrends: any[] }> {
      const res = await request<{ success: boolean; data: any }>('/reports/notifications');
      return res.data;
    }
  },

  // Students & Parents
  students: {
    async list(params: { search?: string; department_id?: string; class_id?: string; year?: string; section?: string } = {}): Promise<Student[]> {
      const qs = new URLSearchParams(params as any).toString();
      const res = await request<{ success: boolean; data: Student[] }>(`/students?${qs}`);
      return res.data;
    },
    async getById(id: string): Promise<Student> {
      const res = await request<{ success: boolean; data: Student }>(`/students/${id}`);
      return res.data;
    },
    async create(studentData: any): Promise<any> {
      return request('/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData)
      });
    },
    async update(id: string, studentData: any): Promise<any> {
      return request(`/students/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData)
      });
    },
    async delete(id: string): Promise<any> {
      return request(`/students/${id}`, { method: 'DELETE' });
    },
    async importClassMaster(classIdOrPayload: string | { class_id?: string; department_id?: string; year?: string; section?: string; academic_year?: string; students: any[] }, students?: any[], departmentId?: string): Promise<any> {
      let body: any;
      if (typeof classIdOrPayload === 'object') {
        body = classIdOrPayload;
      } else {
        body = { class_id: classIdOrPayload, department_id: departmentId, students };
      }
      return request('/students/import-class-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    },
    async cleanDuplicates(): Promise<any> {
      return request('/students/clean-duplicates', { method: 'POST' });
    }
  },

  parents: {
    async list(search?: string): Promise<Parent[]> {
      const qs = search ? `?search=${encodeURIComponent(search)}` : '';
      const res = await request<{ success: boolean; data: Parent[] }>(`/students/parents/list${qs}`);
      return res.data;
    },
    async update(id: string, parentData: any): Promise<any> {
      return request(`/students/parents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parentData)
      });
    }
  },

  // Academic Entities
  academic: {
    async getDepartments(): Promise<Department[]> {
      const res = await request<{ success: boolean; data: Department[] }>('/academic/departments');
      return res.data;
    },
    async createDepartment(data: { name: string; code: string }): Promise<any> {
      return request('/academic/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async getClasses(department_id?: string): Promise<ClassItem[]> {
      const qs = department_id ? `?department_id=${encodeURIComponent(department_id)}` : '';
      const res = await request<{ success: boolean; data: ClassItem[] }>(`/academic/classes${qs}`);
      return res.data;
    },
    async createClass(data: any): Promise<any> {
      return request('/academic/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async updateClass(id: string, data: any): Promise<any> {
      return request(`/academic/classes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async deleteClass(id: string): Promise<any> {
      return request(`/academic/classes/${id}`, {
        method: 'DELETE'
      });
    },
    async getMyClasses(): Promise<ClassItem[]> {
      const res = await request<{ success: boolean; data: ClassItem[] }>('/academic/my-classes');
      return res.data;
    },
    async getClassStudents(classId: string): Promise<{ classInfo: any; data: Student[] }> {
      const res = await request<{ success: boolean; classInfo: any; data: Student[] }>(`/academic/classes/${classId}/students`);
      return res;
    },
    async getFacultyAssignments(): Promise<FacultyClassAssignment[]> {
      const res = await request<{ success: boolean; data: FacultyClassAssignment[] }>('/academic/faculty-assignments');
      return res.data;
    },
    async createFacultyAssignment(data: { faculty_id: string; class_id: string; academic_year?: string }): Promise<any> {
      return request('/academic/faculty-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async deleteFacultyAssignment(id: string): Promise<any> {
      return request(`/academic/faculty-assignments/${id}`, {
        method: 'DELETE'
      });
    },
    async getSubjects(department_id?: string, semester?: string): Promise<Subject[]> {
      const params = new URLSearchParams();
      if (department_id) params.set('department_id', department_id);
      if (semester) params.set('semester', semester);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await request<{ success: boolean; data: Subject[] }>(`/academic/subjects${qs}`);
      return res.data;
    },
    async createSubject(data: any): Promise<any> {
      return request('/academic/subjects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async updateSubject(id: string, data: any): Promise<any> {
      return request(`/academic/subjects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async deleteSubject(id: string): Promise<any> {
      return request(`/academic/subjects/${id}`, {
        method: 'DELETE'
      });
    },
    async getExams(class_id?: string): Promise<Exam[]> {
      const qs = class_id ? `?class_id=${encodeURIComponent(class_id)}` : '';
      const res = await request<{ success: boolean; data: Exam[] }>(`/academic/exams${qs}`);
      return res.data;
    },
    async createExam(data: any): Promise<any> {
      return request('/academic/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async deleteExam(id: string): Promise<any> {
      return request(`/academic/exams/${id}`, {
        method: 'DELETE'
      });
    },
    async getFaculty(): Promise<any[]> {
      const res = await request<{ success: boolean; data: any[] }>('/academic/faculty');
      return res.data;
    },
    async createFaculty(data: { name: string; email: string; department_id: string; password?: string }): Promise<any> {
      return request('/academic/faculty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async updateFaculty(id: string, data: any): Promise<any> {
      return request(`/academic/faculty/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async deleteFaculty(id: string): Promise<any> {
      return request(`/academic/faculty/${id}`, {
        method: 'DELETE'
      });
    },
    async getAuditLogs(): Promise<AuditLog[]> {
      const res = await request<{ success: boolean; data: AuditLog[] }>('/academic/audit-logs');
      return res.data;
    }
  },

  // Excel Upload & Validation
  uploads: {
    async uploadFile(file: File): Promise<{
      uploadId: string;
      fileName: string;
      totalRows: number;
      detectedColumns: string[];
      suggestedMapping: ColumnMapping;
      subjects: Subject[];
    }> {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/uploads`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload file');
      }
      return data.data;
    },
    async validate(uploadId: string, mapping: ColumnMapping, examId: string, classId?: string): Promise<ValidationResult> {
      const res = await request<{ success: boolean; data: ValidationResult }>(`/uploads/${uploadId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mapping, examId, classId })
      });
      return res.data;
    },
    async getPreview(uploadId: string, params: { status?: string; search?: string } = {}): Promise<ValidationResult> {
      const qs = new URLSearchParams(params as any).toString();
      const res = await request<{ success: boolean; data: ValidationResult }>(`/uploads/${uploadId}/preview?${qs}`);
      return res.data;
    },
    async importMarks(uploadId: string, examId: string, onlyValidRows: boolean = true): Promise<any> {
      return request(`/uploads/${uploadId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, onlyValidRows })
      });
    },
    async getUploads(): Promise<any[]> {
      const res = await request<{ success: boolean; data: any[] }>('/uploads');
      return res.data;
    },
    getErrorReportUrl(uploadId: string): string {
      return `${getApiBaseUrl()}/uploads/${uploadId}/error-report`;
    },
    getSampleTemplateUrl(): string {
      return `${getApiBaseUrl()}/uploads/sample-template`;
    }
  },

  // Notifications
  notifications: {
    async preview(examId: string, records: any[]): Promise<{
      collegeName: string;
      examName: string;
      previews: MessagePreviewItem[];
      duplicateCount: number;
    }> {
      const res = await request<{ success: boolean; data: any }>('/notifications/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId, records })
      });
      return res.data;
    },
    async sendBatch(data: {
      examId: string;
      uploadedFileId?: string;
      channel: 'WHATSAPP' | 'SMS' | 'BOTH';
      whatsappSenderType?: 'PERSONAL' | 'CENTRAL';
      records: any[];
      forceResend?: boolean;
    }): Promise<{ batchId: string; totalCreated: number; skippedDuplicates: number; senderInfo?: string }> {
      const res = await request<{ success: boolean; data: any }>('/notifications/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.data;
    },
    async getBatchProgress(batchId: string): Promise<any> {
      const res = await request<{ success: boolean; data: any }>(`/notifications/batches/${batchId}/progress`);
      return res.data;
    },
    async list(params: { search?: string; channel?: string; status?: string; exam_id?: string; limit?: number; offset?: number } = {}): Promise<NotificationRecord[]> {
      const qs = new URLSearchParams(params as any).toString();
      const res = await request<{ success: boolean; data: NotificationRecord[] }>(`/notifications?${qs}`);
      return res.data;
    },
    async getById(id: string): Promise<NotificationRecord> {
      const res = await request<{ success: boolean; data: NotificationRecord }>(`/notifications/${id}`);
      return res.data;
    },
    async retry(id: string): Promise<{ success: boolean; message: string }> {
      return request(`/notifications/${id}/retry`, { method: 'POST' });
    },
    async retryAllFailed(): Promise<{ success: boolean; data: any }> {
      return request('/notifications/retry-all/failed', { method: 'POST' });
    },
    async getTemplates(): Promise<MessageTemplate[]> {
      const res = await request<{ success: boolean; data: MessageTemplate[] }>('/notifications/templates/list');
      return res.data;
    },
    async updateTemplate(id: string, data: { template_text: string; is_active?: boolean }): Promise<any> {
      return request(`/notifications/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async previewTemplate(template_text: string): Promise<{ rendered: string; sampleVariables: any }> {
      const res = await request<{ success: boolean; data: any }>('/notifications/templates/test-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_text })
      });
      return res.data;
    }
  },

  // Settings & Audit Logs
  settings: {
    async get(): Promise<{ settings: Record<string, string>; raw: any[] }> {
      const res = await request<{ success: boolean; data: any }>('/settings');
      return res.data;
    },
    async getAll(): Promise<any[]> {
      const res = await request<{ success: boolean; data: any[] }>('/settings/all');
      return res.data;
    },
    async update(settings: Record<string, string>): Promise<any> {
      return request('/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings })
      });
    },
    async bulkUpdate(payload: { key: string; value: string; group: string }[]): Promise<any> {
      return request('/settings/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload })
      });
    },
    async testConnection(channel: 'whatsapp' | 'sms'): Promise<{ ok: boolean; message?: string }> {
      const res = await request<{ success: boolean; data: any }>(`/settings/test-connection/${channel}`, {
        method: 'POST'
      });
      return res.data;
    },
    async getAuditLogs(params: { limit?: number; action?: string; entity?: string } = {}): Promise<AuditLog[]> {
      const qs = new URLSearchParams(params as any).toString();
      const res = await request<{ success: boolean; data: AuditLog[] }>(`/settings/audit-logs?${qs}`);
      return res.data;
    }
  },

  // Message Templates
  templates: {
    async list(): Promise<any[]> {
      const res = await request<{ success: boolean; data: any[] }>('/templates');
      return res.data;
    },
    async getById(id: string): Promise<any> {
      const res = await request<{ success: boolean; data: any }>(`/templates/${id}`);
      return res.data;
    },
    async create(data: any): Promise<any> {
      return request('/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async update(id: string, data: any): Promise<any> {
      return request(`/templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    },
    async delete(id: string): Promise<any> {
      return request(`/templates/${id}`, { method: 'DELETE' });
    }
  },

  // Faculty WhatsApp Session (QR Link & Personal Sender)
  whatsappSession: {
    async getStatus(): Promise<{
      status: 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED';
      phoneNumber?: string;
      pushName?: string;
      qrCode?: string;
      lastConnectedAt?: string;
      isSimulated?: boolean;
      error?: string;
    }> {
      const res = await request<{ success: boolean; data: any }>('/whatsapp-session/status');
      return res.data;
    },
    async connect(): Promise<{
      status: string;
      qrCode?: string;
      phoneNumber?: string;
    }> {
      const res = await request<{ success: boolean; data: any }>('/whatsapp-session/connect', {
        method: 'POST'
      });
      return res.data;
    },
    async disconnect(): Promise<void> {
      await request('/whatsapp-session/disconnect', { method: 'POST' });
    },
    async simulateConnect(phoneNumber?: string): Promise<{
      status: string;
      phoneNumber: string;
      pushName: string;
      isSimulated: boolean;
    }> {
      const res = await request<{ success: boolean; data: any }>('/whatsapp-session/simulate-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      });
      return res.data;
    },
    async sendTestMessage(targetPhone?: string, message?: string): Promise<any> {
      const res = await request<{ success: boolean; message: string; data: any }>('/whatsapp-session/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPhone, message })
      });
      return res;
    }
  }
};
