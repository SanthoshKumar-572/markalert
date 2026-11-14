import { Request, Response } from 'express';
import { db } from '../database/db';

export async function handleWhatsAppWebhook(req: Request, res: Response): Promise<void> {
  try {
    // Meta verification challenge for webhook setup
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode === 'subscribe' && token === (process.env.WHATSAPP_VERIFY_TOKEN || 'college_wa_verify_token')) {
        res.status(200).send(challenge);
        return;
      }
      res.status(403).send('Forbidden');
      return;
    }

    // POST webhook updates (delivery status callbacks)
    const body = req.body;
    if (body.object === 'whatsapp_business_account') {
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const statuses = change.value?.statuses || [];
          for (const statusObj of statuses) {
            const messageId = statusObj.id;
            const status = statusObj.status?.toUpperCase(); // DELIVERED, READ, FAILED, SENT

            if (messageId && status) {
              const dbStatus = status === 'DELIVERED' || status === 'READ' ? 'DELIVERED' : (status === 'FAILED' ? 'FAILED' : 'SENT');
              const errorMsg = statusObj.errors?.[0]?.message || null;

              await db.execute(
                `UPDATE notifications
                 SET status = ?, error_message = COALESCE(?, error_message),
                     delivered_at = CASE WHEN ? = 'DELIVERED' THEN datetime('now') ELSE delivered_at END
                 WHERE provider_message_id = ?`,
                [dbStatus, errorMsg, dbStatus, messageId]
              );
            }
          }
        }
      }
    }

    res.status(200).json({ status: 'success' });
  } catch (err: any) {
    console.error('[WhatsApp Webhook Error]:', err);
    res.status(200).json({ status: 'ignored_error' });
  }
}

export async function handleSMSWebhook(req: Request, res: Response): Promise<void> {
  try {
    const { request_id, message_id, status, error } = req.body;
    const providerId = request_id || message_id;

    if (providerId && status) {
      const dbStatus = String(status).toUpperCase() === 'DELIVERED' ? 'DELIVERED' : 'FAILED';
      await db.execute(
        `UPDATE notifications
         SET status = ?, error_message = COALESCE(?, error_message),
             delivered_at = CASE WHEN ? = 'DELIVERED' THEN datetime('now') ELSE delivered_at END
         WHERE provider_message_id = ?`,
        [dbStatus, error || null, dbStatus, providerId]
      );
    }

    res.status(200).json({ status: 'success' });
  } catch (err: any) {
    res.status(200).json({ status: 'ignored_error' });
  }
}
