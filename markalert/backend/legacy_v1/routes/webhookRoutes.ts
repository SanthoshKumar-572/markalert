import { Router } from 'express';
import { handleWhatsAppWebhook, handleSMSWebhook } from '../controllers/webhookController';

const router = Router();

// Meta WhatsApp Webhook
router.get('/whatsapp', handleWhatsAppWebhook);
router.post('/whatsapp', handleWhatsAppWebhook);

// SMS Provider Webhook
router.post('/sms', handleSMSWebhook);

export default router;
