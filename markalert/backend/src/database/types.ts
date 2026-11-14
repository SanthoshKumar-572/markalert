export const Role = {
  ADMIN: 'ADMIN',
  FACULTY: 'FACULTY',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const BatchStatus = {
  DRAFT: 'DRAFT',
  VALIDATED: 'VALIDATED',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
} as const;
export type BatchStatus = (typeof BatchStatus)[keyof typeof BatchStatus];

export const RecipientStatus = {
  VALID: 'VALID',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
} as const;
export type RecipientStatus = (typeof RecipientStatus)[keyof typeof RecipientStatus];

export const NotificationChannel = {
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
} as const;
export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const NotificationStatus = {
  PENDING: 'PENDING',
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
} as const;
export type NotificationStatus = (typeof NotificationStatus)[keyof typeof NotificationStatus];

export const TemplateChannel = {
  WHATSAPP: 'WHATSAPP',
  SMS: 'SMS',
  BOTH: 'BOTH',
} as const;
export type TemplateChannel = (typeof TemplateChannel)[keyof typeof TemplateChannel];
