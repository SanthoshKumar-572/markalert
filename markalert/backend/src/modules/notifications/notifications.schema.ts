import { z } from 'zod';

export const sendBatchConfirmSchema = z.object({
  channel: z.enum(['WHATSAPP', 'SMS', 'BOTH']),
  custom_template: z.string().optional(),
  force_resend: z.boolean().optional(),
});

export const retryFailedBatchSchema = z.object({
  channel: z.enum(['WHATSAPP', 'SMS']).optional(),
});
