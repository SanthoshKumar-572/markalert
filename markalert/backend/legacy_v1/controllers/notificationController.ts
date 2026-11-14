import { Request, Response } from 'express';
import { db } from '../database/db';
import { notificationService } from '../services/notification/notificationService';
import { logAudit, verifyExamAccess, checkFacultyClassAccess, getFacultyAssignedClassIds } from '../middleware/auth';

export async function previewNotifications(req: Request, res: Response): Promise<void> {
  try {
    const { examId, records } = req.body;
    if (!examId) {
      res.status(400).json({ success: false, error: 'Exam ID is required for notification preview' });
      return;
    }

    if (req.user) {
      const authCheck = await verifyExamAccess(req.user.id, req.user.role, examId);
      if (!authCheck.authorized) {
        res.status(403).json({ success: false, error: authCheck.error || 'Forbidden: You do not have access to preview notifications for this exam/class' });
        return;
      }
    }

    const previewResult = await notificationService.previewNotifications(examId, records);
    res.json({ success: true, data: previewResult });
  } catch (err: any) {
    console.error('[Preview Notifications Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to generate preview' });
  }
}

export async function sendBatch(req: Request, res: Response): Promise<void> {
  try {
    const { examId, uploadedFileId, channel, records, forceResend, whatsappSenderType } = req.body;

    if (!examId || !channel || !records || records.length === 0) {
      res.status(400).json({ success: false, error: 'Exam ID, channel, and student records are required to send notifications' });
      return;
    }

    if (req.user) {
      const authCheck = await verifyExamAccess(req.user.id, req.user.role, examId);
      if (!authCheck.authorized) {
        res.status(403).json({ success: false, error: authCheck.error || 'Forbidden: You do not have access to send notifications for this exam/class' });
        return;
      }
    }

    const result = await notificationService.sendBatchNotifications({
      examId,
      uploadedFileId,
      createdBy: req.user?.id || 'system',
      channel,
      whatsappSenderType: whatsappSenderType || 'PERSONAL',
      records,
      forceResend: !!forceResend
    });

    const auditAction = req.user?.role === 'FACULTY' ? 'FACULTY_STARTED_DISPATCH' : 'ADMIN_STARTED_DISPATCH';
    await logAudit(req.user?.id, auditAction, 'notification_batches', result.batchId, {
      exam_id: examId,
      channel,
      whatsapp_sender_type: whatsappSenderType || 'PERSONAL',
      total_created: result.totalCreated,
      skipped_duplicates: result.skippedDuplicates
    });

    res.json({
      success: true,
      message: `Batch job queued with ${result.totalCreated} notifications.`,
      data: result
    });
  } catch (err: any) {
    console.error('[Send Batch Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to dispatch batch notifications' });
  }
}

export async function getBatchProgress(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const batch = await db.queryOne<any>('SELECT * FROM notification_batches WHERE id = ?', [id]);
    if (!batch) {
      res.status(404).json({ success: false, error: 'Batch not found' });
      return;
    }

    // Get live status counts from notifications table
    const counts = await db.query<any>(
      `SELECT status, COUNT(*) as cnt FROM notifications WHERE batch_id = ? GROUP BY status`,
      [id]
    );

    let sent = 0;
    let delivered = 0;
    let failed = 0;
    let queued = 0;

    for (const c of counts) {
      if (c.status === 'SENT') sent = c.cnt;
      else if (c.status === 'DELIVERED') delivered = c.cnt;
      else if (c.status === 'FAILED') failed = c.cnt;
      else if (c.status === 'QUEUED' || c.status === 'PENDING' || c.status === 'RETRYING') queued = c.cnt;
    }

    const total = batch.total_notifications || 0;
    const processed = sent + delivered + failed;
    const percentage = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 100;

    res.json({
      success: true,
      data: {
        batchId: batch.id,
        status: batch.status,
        total,
        processed,
        sent,
        delivered,
        failed,
        pending: queued,
        percentage,
        createdAt: batch.created_at,
        completedAt: batch.completed_at
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to get batch progress' });
  }
}

export async function getNotifications(req: Request, res: Response): Promise<void> {
  try {
    const { search, channel, status, exam_id, limit = 50, offset = 0 } = req.query;

    let queryStr = `
      SELECT n.*, s.register_number, s.name as student_name, ex.exam_name,
             p.parent_name, p.mobile_number as parent_mobile, p.whatsapp_number as parent_whatsapp
      FROM notifications n
      JOIN students s ON n.student_id = s.id
      JOIN exams ex ON n.exam_id = ex.id
      LEFT JOIN parents p ON p.student_id = s.id
      WHERE 1=1
    `;
    const user = req.user;
    const params: any[] = [];

    // Backend Authorization: If user is FACULTY, filter only to their assigned classes
    if (user?.role === 'FACULTY') {
      const assignedClassIds = await getFacultyAssignedClassIds(user.id);
      if (assignedClassIds.length === 0) {
        res.json({ success: true, count: 0, data: [] });
        return;
      }
      const placeholders = assignedClassIds.map(() => '?').join(',');
      queryStr += ` AND (s.class_id IN (${placeholders}) OR ex.class_id IN (${placeholders}))`;
      params.push(...assignedClassIds, ...assignedClassIds);
    }

    if (search) {
      queryStr += ` AND (s.name LIKE ? OR s.register_number LIKE ? OR n.recipient LIKE ? OR p.parent_name LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    if (channel && channel !== 'ALL') {
      queryStr += ` AND n.channel = ?`;
      params.push(channel);
    }

    if (status && status !== 'ALL') {
      queryStr += ` AND n.status = ?`;
      params.push(status);
    }

    if (exam_id) {
      queryStr += ` AND n.exam_id = ?`;
      params.push(exam_id);
    }

    queryStr += ` ORDER BY n.created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const notifications = await db.query<any>(queryStr, params);

    // Provide recipient_masked for UI display and recipient_raw for direct SMS/WhatsApp links
    const sanitized = notifications.map(n => {
      const realPhone = n.recipient || n.parent_mobile || n.parent_whatsapp || '';
      const masked = realPhone.length >= 4 ? '******' + realPhone.slice(-4) : '******';
      return {
        ...n,
        recipient_masked: masked,
        recipient_raw: realPhone,
        recipient: realPhone
      };
    });

    res.json({ success: true, count: sanitized.length, data: sanitized });
  } catch (err: any) {
    console.error('[Get Notifications Error]:', err);
    res.status(500).json({ success: false, error: 'Failed to retrieve notification history' });
  }
}

export async function getNotificationById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const user = req.user;
    const notif = await db.queryOne<any>(
      `SELECT n.*, s.register_number, s.name as student_name, s.class_id as student_class_id,
              ex.exam_name, ex.class_id as exam_class_id, p.parent_name,
              p.mobile_number as parent_mobile, p.whatsapp_number as parent_whatsapp
       FROM notifications n
       JOIN students s ON n.student_id = s.id
       JOIN exams ex ON n.exam_id = ex.id
       LEFT JOIN parents p ON p.student_id = s.id
       WHERE n.id = ?`,
      [id]
    );

    if (!notif) {
      res.status(404).json({ success: false, error: 'Notification record not found' });
      return;
    }

    if (user?.role === 'FACULTY') {
      const targetClass = notif.student_class_id || notif.exam_class_id;
      if (targetClass) {
        const hasAccess = await checkFacultyClassAccess(user.id, user.role, targetClass);
        if (!hasAccess) {
          res.status(403).json({ success: false, error: 'Forbidden: You do not have access to view this notification' });
          return;
        }
      }
    }

    const realPhone = notif.recipient || notif.parent_mobile || notif.parent_whatsapp || '';
    const masked = realPhone.length >= 4 ? '******' + realPhone.slice(-4) : '******';

    res.json({
      success: true,
      data: {
        ...notif,
        recipient_masked: masked,
        recipient_raw: realPhone,
        recipient: realPhone
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retrieve notification' });
  }
}

export async function retryNotification(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const user = req.user;

    if (user?.role === 'FACULTY') {
      const notif = await db.queryOne<any>(
        `SELECT n.id, s.class_id as student_class_id, ex.class_id as exam_class_id
         FROM notifications n
         JOIN students s ON n.student_id = s.id
         JOIN exams ex ON n.exam_id = ex.id
         WHERE n.id = ?`,
        [id]
      );
      if (notif) {
        const targetClass = notif.student_class_id || notif.exam_class_id;
        if (targetClass) {
          const hasAccess = await checkFacultyClassAccess(user.id, user.role, targetClass);
          if (!hasAccess) {
            res.status(403).json({ success: false, error: 'Forbidden: You do not have permission to retry notifications for this class' });
            return;
          }
        }
      }
    }

    const result = await notificationService.retrySingleNotification(id);
    const auditAction = user?.role === 'FACULTY' ? 'FACULTY_RETRIED_NOTIFICATION' : 'ADMIN_RETRIED_NOTIFICATION';
    await logAudit(user?.id, auditAction, 'notifications', id, { success: result.success });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message || 'Retry failed' });
  }
}

export async function retryAllFailed(req: Request, res: Response): Promise<void> {
  try {
    const result = await notificationService.retryAllFailed(50);
    await logAudit(req.user?.id, 'RETRY_ALL_FAILED', 'notifications', null, result);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to retry failed notifications' });
  }
}

// Templates
export async function getTemplates(req: Request, res: Response): Promise<void> {
  try {
    const templates = await db.query<any>('SELECT * FROM message_templates ORDER BY name ASC');
    res.json({ success: true, data: templates });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to fetch message templates' });
  }
}

export async function updateTemplate(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { template_text, is_active } = req.body;

    if (!template_text) {
      res.status(400).json({ success: false, error: 'Template text cannot be empty' });
      return;
    }

    await db.execute(
      `UPDATE message_templates
       SET template_text = ?, is_active = COALESCE(?, is_active), updated_at = datetime('now')
       WHERE id = ?`,
      [template_text, is_active !== undefined ? (is_active ? 1 : 0) : null, id]
    );

    await logAudit(req.user?.id, 'UPDATE_TEMPLATE', 'message_templates', id, { length: template_text.length });

    res.json({ success: true, message: 'Template updated successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to update template' });
  }
}

export async function previewTemplateRendering(req: Request, res: Response): Promise<void> {
  try {
    const { template_text } = req.body;
    if (!template_text) {
      res.status(400).json({ success: false, error: 'Template text is required' });
      return;
    }

    const dummyVars = {
      parent_name: 'Mr. Ramesh Kumar',
      student_name: 'Arun Kumar',
      register_number: '24CS001',
      exam_name: 'Internal Assessment 1',
      marks: 'Java: 18/20\nDBMS: 19/20\nMathematics: 17/20\nOperating Systems: 18/20',
      total: 72,
      maximum_marks: 80,
      percentage: 90.0,
      college_name: 'ABC College of Engineering'
    };

    const rendered = notificationService.renderTemplate(template_text, dummyVars);
    res.json({ success: true, data: { rendered, sampleVariables: dummyVars } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to preview template' });
  }
}
