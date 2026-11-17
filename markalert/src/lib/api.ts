import axios from 'axios';
import {
  User,
  ExcelUploadResponse,
  ExcelValidationResult,
  ColumnMapping,
  BatchPreviewResponse,
  BatchStatusResponse,
  NotificationBatch,
  NotificationRecord,
  DashboardOverview,
  MessageTemplate,
} from '../types';

// API Base URL defaults to /api/v1 (proxied by Vite to http://localhost:5000 in dev)
export const API_BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api/v1`
  : '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach access token
apiClient.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: handle token refresh on 401
apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');

      if (refreshToken) {
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          const { accessToken, refreshToken: newRefreshToken } = res.data.data;

          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return apiClient(originalRequest);
        } catch {
          // Token refresh failed, force logout
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export const api = {
  auth: {
    async login(email: string, password: string): Promise<{ user: User; accessToken: string; refreshToken: string }> {
      const res = await apiClient.post('/auth/login', { email, password });
      return res.data.data;
    },
    async logout(): Promise<void> {
      const refreshToken = localStorage.getItem('refreshToken');
      try {
        await apiClient.post('/auth/logout', { refreshToken });
      } finally {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      }
    },
    async getMe(): Promise<User> {
      const res = await apiClient.get('/auth/me');
      return res.data.data;
    },
    async updateProfile(data: { mobile_number?: string; full_name?: string }): Promise<User> {
      const res = await apiClient.patch('/auth/profile', data);
      return res.data.data;
    },
  },

  admin: {
    async listFaculty(params?: { search?: string; department?: string; is_active?: boolean; page?: number; limit?: number }) {
      const res = await apiClient.get('/admin/faculty', { params });
      return res.data;
    },
    async createFaculty(data: any): Promise<User> {
      const res = await apiClient.post('/admin/faculty', data);
      return res.data.data;
    },
    async updateFaculty(id: string, data: any): Promise<User> {
      const res = await apiClient.patch(`/admin/faculty/${id}`, data);
      return res.data.data;
    },
    async setFacultyStatus(id: string, is_active: boolean): Promise<any> {
      const res = await apiClient.patch(`/admin/faculty/${id}/status`, { is_active });
      return res.data.data;
    },
    async resetFacultyPassword(id: string, new_password: string): Promise<any> {
      const res = await apiClient.post(`/admin/faculty/${id}/reset-password`, { new_password });
      return res.data.data;
    },
  },

  batches: {
    async list(params?: { page?: number; limit?: number }): Promise<{ batches: NotificationBatch[]; pagination: any }> {
      const res = await apiClient.get('/batches', { params });
      return { batches: res.data.data, pagination: res.data.pagination };
    },
    async getById(id: string): Promise<NotificationBatch> {
      const res = await apiClient.get(`/batches/${id}`);
      return res.data.data;
    },
    async create(data: { exam_name: string; department?: string; class_name?: string; academic_year?: string }): Promise<NotificationBatch> {
      const res = await apiClient.post('/batches', data);
      return res.data.data;
    },
    async uploadFile(batchId: string, file: File): Promise<ExcelUploadResponse> {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post(`/batches/${batchId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data.data;
    },
    async validate(
      batchId: string,
      data: {
        stored_file_name: string;
        mapping: ColumnMapping;
        sheet_name?: string;
        max_marks?: Record<string, number>;
      }
    ): Promise<ExcelValidationResult> {
      const res = await apiClient.post(`/batches/${batchId}/validate`, data);
      return res.data.data;
    },
    async getPreview(batchId: string, status?: string): Promise<any[]> {
      const res = await apiClient.get(`/batches/${batchId}/preview`, { params: { status } });
      return res.data.data;
    },
    getErrorReportUrl(batchId: string): string {
      return `${API_BASE_URL}/batches/${batchId}/errors`;
    },
    async getMessagesPreview(batchId: string, customTemplate?: string): Promise<BatchPreviewResponse> {
      const res = await apiClient.get(`/batches/${batchId}/messages`, {
        params: { custom_template: customTemplate },
      });
      return res.data.data;
    },
    async sendBatch(
      batchId: string,
      data: {
        channel: 'WHATSAPP' | 'SMS' | 'BOTH';
        custom_template?: string;
        force_resend?: boolean;
        recipient_ids?: string[];
        register_numbers?: string[];
      }
    ): Promise<{ batchId: string; queued: number; message: string }> {
      const res = await apiClient.post(`/batches/${batchId}/send`, data);
      return res.data.data;
    },
    async getStatus(batchId: string): Promise<BatchStatusResponse> {
      const res = await apiClient.get(`/batches/${batchId}/status`);
      return res.data.data;
    },
    async retryFailedBatch(batchId: string, channel?: 'WHATSAPP' | 'SMS'): Promise<any> {
      const res = await apiClient.post(`/batches/${batchId}/retry-failed`, { channel });
      return res.data;
    },
  },

  notifications: {
    async list(params?: { batch_id?: string; channel?: string; status?: string; search?: string; page?: number; limit?: number }): Promise<{ notifications: NotificationRecord[]; pagination: any }> {
      const res = await apiClient.get('/notifications', { params });
      return { notifications: res.data.data, pagination: res.data.pagination };
    },
    async retry(id: string): Promise<any> {
      const res = await apiClient.post(`/notifications/${id}/retry`);
      return res.data;
    },
  },

  templates: {
    async list(): Promise<MessageTemplate[]> {
      const res = await apiClient.get('/templates');
      return res.data.data;
    },
    async create(data: any): Promise<MessageTemplate> {
      const res = await apiClient.post('/templates', data);
      return res.data.data;
    },
    async update(id: string, data: any): Promise<MessageTemplate> {
      const res = await apiClient.patch(`/templates/${id}`, data);
      return res.data.data;
    },
    async delete(id: string): Promise<void> {
      await apiClient.delete(`/templates/${id}`);
    },
  },

  reports: {
    async getOverview(): Promise<DashboardOverview> {
      const res = await apiClient.get('/reports/overview');
      return res.data.data;
    },
    async getSettings(): Promise<Record<string, string>> {
      const res = await apiClient.get('/reports/settings');
      return res.data.data;
    },
    async updateSettings(settings: Record<string, string>): Promise<any> {
      const res = await apiClient.patch('/reports/settings', { settings });
      return res.data.data;
    },
  },
};
