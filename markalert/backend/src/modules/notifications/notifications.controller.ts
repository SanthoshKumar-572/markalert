import { Request, Response } from 'express';
import { NotificationChannel, NotificationStatus } from '../../database/types';
import { notificationsService } from './notifications.service';

export class NotificationsController {
  public async getMessagesPreview(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { custom_template } = req.query;
      const preview = await notificationsService.previewBatchMessages(
        id,
        custom_template ? String(custom_template) : undefined
      );
      res.json({ success: true, data: preview });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to generate message preview' });
    }
  }

  public async sendBatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { channel, custom_template, force_resend, recipient_ids, register_numbers } = req.body;

      const result = await notificationsService.sendBatch({
        batchId: id,
        userId,
        channel,
        customTemplate: custom_template,
        forceResend: Boolean(force_resend),
        recipientIds: recipient_ids,
        registerNumbers: register_numbers,
      });

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to dispatch batch' });
    }
  }

  public async getBatchStatus(req: Request, res: Response): Promise<void> {
    const { id } = req.params;

    // Support Server-Sent Events (SSE) for live real-time progress updates
    if (req.headers.accept === 'text/event-stream') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      const sendUpdate = async () => {
        try {
          const status = await notificationsService.getBatchStatus(id);
          res.write(`data: ${JSON.stringify(status)}\n\n`);

          // If completed or failed, close the SSE connection after last update
          if (status.status === 'COMPLETED' || status.status === 'FAILED' || status.status === 'PARTIAL') {
            clearInterval(intervalId);
            res.end();
          }
        } catch (e) {
          clearInterval(intervalId);
          res.end();
        }
      };

      await sendUpdate();
      const intervalId = setInterval(sendUpdate, 1500);

      req.on('close', () => {
        clearInterval(intervalId);
      });
      return;
    }

    // Standard JSON response
    try {
      const status = await notificationsService.getBatchStatus(id);
      res.json({ success: true, data: status });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to get batch status' });
    }
  }

  public async retryNotification(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const result = await notificationsService.retryNotification(id, userId);
      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to retry notification' });
    }
  }

  public async retryFailedBatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { channel } = req.body;

      const result = await notificationsService.retryFailedBatch(
        id,
        channel ? (channel as NotificationChannel) : undefined,
        userId
      );

      res.json({ success: true, data: result });
    } catch (err: any) {
      res.status(400).json({ success: false, error: err.message || 'Failed to retry failed notifications' });
    }
  }

  public async list(req: Request, res: Response): Promise<void> {
    try {
      const { batch_id, channel, status, search, page, limit } = req.query;

      const result = await notificationsService.listNotifications({
        batchId: batch_id ? String(batch_id) : undefined,
        channel: channel ? (channel as NotificationChannel) : undefined,
        status: status ? (status as NotificationStatus) : undefined,
        search: search ? String(search) : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });

      res.json({ success: true, data: result.notifications, pagination: result.pagination });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Failed to list notifications' });
    }
  }
}

export const notificationsController = new NotificationsController();
