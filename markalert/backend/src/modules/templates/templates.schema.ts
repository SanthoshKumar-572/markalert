import { z } from 'zod';

export const createTemplateSchema = z.object({
  name: z.string().min(2, 'Template name is required'),
  channel: z.enum(['WHATSAPP', 'SMS', 'BOTH']).default('BOTH'),
  template_text: z.string().min(10, 'Template text must have at least 10 characters'),
  is_active: z.boolean().optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(2).optional(),
  channel: z.enum(['WHATSAPP', 'SMS', 'BOTH']).optional(),
  template_text: z.string().min(10).optional(),
  is_active: z.boolean().optional(),
});
