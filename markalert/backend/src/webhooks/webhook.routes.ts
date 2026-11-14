import { Router, Request, Response } from 'express';
import { NotificationStatus } from '../database/types';
import { prisma } from '../database/prisma';
import { config } from '../config';
import { queueService } from '../queue/queue.service';

const router = Router();

// Meta WhatsApp Webhook Verification (hub.challenge handshake)
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp.verifyToken) {
    console.log('[WhatsApp Webhook] Handshake verified successfully.');
    res.status(200).send(challenge);
  } else {
    res.status(403).json({ error: 'Forbidden: Verification token mismatch' });
  }
});

// Meta WhatsApp Delivery Status Updates
router.post('/whatsapp', async (req: Request, res: Response): Promise<void> => {
  // Immediate 200 OK acknowledgment to Meta
  res.status(200).json({ status: 'ok' });

  try {
    const entry = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const statuses = value?.statuses;

    if (!statuses || !Array.isArray(statuses)) return;

    for (const statusObj of statuses) {
      const messageId = statusObj.id; // wamid
      const statusStr = statusObj.status; // 'sent' | 'delivered' | 'read' | 'failed'
      const timestamp = statusObj.timestamp ? new Date(Number(statusObj.timestamp) * 1000) : new Date();

      const notif = await prisma.notification.findFirst({
        where: { provider_message_id: messageId },
      });

      if (!notif) continue;

      let newStatus = notif.status;
      let deliveredAt = notif.delivered_at;
      let failedAt = notif.failed_at;
      let errorCode = notif.error_code;
      let errorMessage = notif.error_message;

      if (statusStr === 'delivered' || statusStr === 'read') {
        newStatus = NotificationStatus.DELIVERED;
        deliveredAt = timestamp;
      } else if (statusStr === 'failed') {
        newStatus = NotificationStatus.FAILED;
        failedAt = timestamp;
        const errObj = statusObj.errors?.[0];
        errorCode = errObj ? String(errObj.code) : 'WHATSAPP_FAILED';
        errorMessage = errObj ? errObj.title || errObj.message : 'Delivery failed';
      }

      await prisma.notification.update({
        where: { id: notif.id },
        data: {
          status: newStatus,
          delivered_at: deliveredAt,
          failed_at: failedAt,
          error_code: errorCode,
          error_message: errorMessage,
        },
      });

      // Log event
      await prisma.notificationEvent.create({
        data: {
          notification_id: notif.id,
          event_type: `WHATSAPP_${statusStr.toUpperCase()}`,
          provider_payload: JSON.stringify({
            status: statusStr,
            timestamp,
            errors: statusObj.errors || null,
          }),
        },
      });

      await queueService.updateBatchStatus(notif.batch_id);
    }
  } catch (err: any) {
    console.error('[WhatsApp Webhook Processing Error]:', err.message);
  }
});

// Indian DLT SMS Gateway Delivery Callback
router.post('/sms', async (req: Request, res: Response): Promise<void> => {
  res.status(200).json({ status: 'ok' });

  try {
    const { request_id, message_id, status, error } = req.body;
    const providerId = request_id || message_id;
    if (!providerId) return;

    const notif = await prisma.notification.findFirst({
      where: { provider_message_id: providerId },
    });

    if (!notif) return;

    const isDelivered = String(status).toLowerCase().includes('deliver') || String(status) === '1';
    const isFailed = String(status).toLowerCase().includes('fail') || String(status) === '2';

    let newStatus = notif.status;
    let deliveredAt = notif.delivered_at;
    let failedAt = notif.failed_at;

    if (isDelivered) {
      newStatus = NotificationStatus.DELIVERED;
      deliveredAt = new Date();
    } else if (isFailed) {
      newStatus = NotificationStatus.FAILED;
      failedAt = new Date();
    }

    await prisma.notification.update({
      where: { id: notif.id },
      data: {
        status: newStatus,
        delivered_at: deliveredAt,
        failed_at: failedAt,
        error_message: isFailed ? (error || 'SMS delivery failed') : null,
      },
    });

    await prisma.notificationEvent.create({
      data: {
        notification_id: notif.id,
        event_type: `SMS_${newStatus}`,
        provider_payload: JSON.stringify(req.body),
      },
    });

    await queueService.updateBatchStatus(notif.batch_id);
  } catch (err: any) {
    console.error('[SMS Webhook Error]:', err.message);
  }
});

export default router;
