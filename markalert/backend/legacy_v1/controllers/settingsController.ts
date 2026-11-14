import { Request, Response } from 'express';
import { db } from '../database/db';
import { logAudit } from '../middleware/auth';

export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    const settings = await db.query<any>('SELECT * FROM system_settings');
    const settingsMap: { [key: string]: any } = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    res.json({
      success: true,
      data: {
        settings: settingsMap,
        raw: settings
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve system settings' });
  }
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    const { settings } = req.body as { settings: { [key: string]: string } };
    if (!settings) {
      res.status(400).json({ success: false, error: 'Settings object is required' });
      return;
    }

    for (const [key, val] of Object.entries(settings)) {
      const existing = await db.queryOne<any>('SELECT key FROM system_settings WHERE key = ?', [key]);
      if (existing) {
        await db.execute('UPDATE system_settings SET value = ?, updated_at = datetime(\'now\') WHERE key = ?', [String(val), key]);
      } else {
        await db.execute('INSERT INTO system_settings (key, value) VALUES (?, ?)', [key, String(val)]);
      }
    }

    await logAudit(req.user?.id, 'UPDATE_SETTINGS', 'system_settings', null, Object.keys(settings));

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update settings' });
  }
}

export async function getAuditLogs(req: Request, res: Response): Promise<void> {
  try {
    const { limit = 100, action, entity } = req.query;

    let queryStr = `
      SELECT a.*, u.name as user_name, u.email as user_email, u.role as user_role
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (action) {
      queryStr += ' AND a.action = ?';
      params.push(action);
    }
    if (entity) {
      queryStr += ' AND a.entity = ?';
      params.push(entity);
    }

    queryStr += ' ORDER BY a.created_at DESC LIMIT ?';
    params.push(Number(limit));

    const logs = await db.query<any>(queryStr, params);
    res.json({ success: true, count: logs.length, data: logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve audit logs' });
  }
}
