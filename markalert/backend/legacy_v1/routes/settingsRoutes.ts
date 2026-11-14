import { Router, Request, Response } from 'express';
import { getSettings, updateSettings, getAuditLogs } from '../controllers/settingsController';
import { authMiddleware, roleGuard } from '../middleware/auth';
import { db } from '../database/db';

const router = Router();
router.use(authMiddleware);

// Standard settings
router.get('/', getSettings);
router.put('/', roleGuard(['ADMIN']), updateSettings);
router.get('/audit-logs', roleGuard(['ADMIN']), getAuditLogs);

// All settings as flat key-value array (for Settings UI)
router.get('/all', async (req: Request, res: Response) => {
  try {
    const rows = await db.all(`SELECT key, value, "group" FROM system_settings ORDER BY "group", key`);
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.json({ success: true, data: [] });
  }
});

// Bulk update
router.put('/bulk', roleGuard(['ADMIN']), async (req: Request, res: Response) => {
  try {
    const { settings } = req.body as { settings: { key: string; value: string; group: string }[] };
    for (const s of settings) {
      await db.run(
        `INSERT INTO system_settings (key, value, "group", updated_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [s.key, s.value, s.group]
      );
    }
    res.json({ success: true, message: 'Settings saved.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test connection
router.post('/test-connection/:channel', roleGuard(['ADMIN']), async (req: Request, res: Response) => {
  const { channel } = req.params;
  try {
    if (channel === 'whatsapp') {
      // In mock mode just return ok
      const mockMode = process.env.WHATSAPP_MOCK_MODE !== 'false';
      if (mockMode) {
        return res.json({ success: true, data: { ok: true, message: 'Mock mode – no real request sent.' } });
      }
      // Real test: list phone numbers
      const token = process.env.WHATSAPP_TOKEN;
      const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      if (!token || !phoneId) return res.json({ success: true, data: { ok: false, message: 'Token or Phone ID not configured.' } });
      const r = await fetch(`https://graph.facebook.com/v19.0/${phoneId}?fields=id,display_phone_number`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const d = await r.json() as any;
      return res.json({ success: true, data: { ok: r.ok, message: d.error?.message || d.display_phone_number || 'Connected' } });
    } else if (channel === 'sms') {
      const mockMode = process.env.SMS_MOCK_MODE !== 'false';
      if (mockMode) {
        return res.json({ success: true, data: { ok: true, message: 'Mock mode – no real request sent.' } });
      }
      return res.json({ success: true, data: { ok: false, message: 'SMS gateway test not implemented yet.' } });
    }
    res.status(400).json({ success: false, error: 'Unknown channel' });
  } catch (err: any) {
    res.json({ success: true, data: { ok: false, message: err.message } });
  }
});

export default router;
