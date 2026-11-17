import { z } from 'zod';

export const createBatchSchema = z.object({
  exam_name: z.string().min(2, 'Exam name is required (e.g. IA-1, IA-2, Model Exam)'),
  department: z.string().optional(),
  class_name: z.string().optional(),
  academic_year: z.string().optional(),
});

export const validateBatchSchema = z.object({
  stored_file_name: z.string().min(1, 'stored_file_name is required'),
  sheet_name: z.string().optional(),
  mapping: z.object({
    registerNumberCol: z.string().min(1, 'Register Number column is required'),
    studentNameCol: z.string().optional(),
    parentNameCol: z.string().optional(),
    parentMobileCol: z.string().min(1, 'Parent Mobile column is required'),
    subjectCols: z.record(z.string()),
  }),
  max_marks: z.record(z.number().positive()).optional(),
});

export const sendBatchSchema = z.object({
  channel: z.enum(['WHATSAPP', 'SMS', 'BOTH']),
  template_text: z.string().optional(),
  custom_template: z.string().optional(),
  force_resend: z.boolean().optional(),
  recipient_ids: z.array(z.string()).optional(),
  register_numbers: z.array(z.string()).optional(),
});
