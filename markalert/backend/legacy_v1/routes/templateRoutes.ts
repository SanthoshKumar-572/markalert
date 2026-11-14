import { Router, Request, Response } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth';
import { db } from '../database/db';
import { randomUUID } from 'crypto';

const router = Router();
router.use(authMiddleware);

// List all templates
router.get('/', async (req: Request, res: Response) => {
  try {
    const rows = await db.all(
      `SELECT id, name, channel, template_type, body, is_active, created_at, updated_at
       FROM message_templates
       ORDER BY channel, template_type, name`
    );
    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.json({ success: true, data: [] });
  }
});

// Get by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const row = await db.get(`SELECT * FROM message_templates WHERE id = ?`, [req.params.id]);
    if (!row) return res.status(404).json({ success: false, error: 'Template not found' });
    res.json({ success: true, data: row });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Create
router.post('/', roleGuard(['ADMIN', 'FACULTY']), async (req: Request, res: Response) => {
  try {
    const { name, channel, template_type, body, is_active } = req.body;
    const id = req.body.id || randomUUID();
    await db.run(
      `INSERT INTO message_templates (id, name, channel, template_type, body, template_text, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [id, name, channel, template_type || 'MARKS', body, body, is_active ? 1 : 0]
    );
    res.json({ success: true, data: { id } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update
router.put('/:id', roleGuard(['ADMIN', 'FACULTY']), async (req: Request, res: Response) => {
  try {
    const { name, channel, template_type, body, is_active } = req.body;
    await db.run(
      `UPDATE message_templates SET name=?, channel=?, template_type=?, body=?, template_text=?, is_active=?, updated_at=datetime('now')
       WHERE id = ?`,
      [name, channel, template_type, body, body, is_active ? 1 : 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete
router.delete('/:id', roleGuard(['ADMIN', 'FACULTY']), async (req: Request, res: Response) => {
  try {
    const templateId = req.params.id;
    await db.run(`DELETE FROM message_templates WHERE id = ?`, [templateId]);
    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
