import { db } from '../../database/db';
import { whatsAppProvider } from '../whatsapp/whatsAppProvider';
import { smsProvider } from '../sms/smsProvider';
import { baileysWhatsAppManager } from '../whatsapp/baileysService';

export interface MessagePreviewItem {
  studentId: string;
  registerNumber: string;
  studentName: string;
  parentName: string;
  parentMobileMasked: string;
  parentMobileRaw: string;
  renderedWhatsApp?: string;
  renderedSMS?: string;
  hasExistingSentNotification: boolean;
  totalMarks: number;
  maxMarks: number;
  percentage: number;
}

export class NotificationService {
  // Format subject-wise marks for text messages with bullet points
  private formatMarksBlock(marks: Array<{ subjectName: string; marksObtained: number; maxMarks: number }>): string {
    return marks
      .map(m => `• ${m.subjectName}: ${m.marksObtained}/${m.maxMarks}`)
      .join('\n');
  }

  // Render template by replacing placeholder tags: {{key}}, {key}, [key]
  public renderTemplate(template: string, vars: { [key: string]: string | number }): string {
    let result = template;
    for (const [key, val] of Object.entries(vars)) {
      const regexDouble = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
      const regexSingle = new RegExp(`\\{${key}\\}`, 'gi');
      result = result.replace(regexDouble, String(val)).replace(regexSingle, String(val));
    }
    // Also support brackets like [Student Name], [Register Number], [College Name], etc.
    const bracketMap: Record<string, string | number> = {
      'College Name': vars.college_name || '',
      'Student Name': vars.student_name || '',
      'Register Number': vars.register_number || '',
      'Class & Section': vars.class_section || '',
      'Class/Section': vars.class_section || '',
      'Total Marks': vars.total || '',
      'Maximum Total': vars.maximum_marks || '',
      'Result': vars.result || ''
    };
    for (const [bKey, bVal] of Object.entries(bracketMap)) {
      const bRegex = new RegExp(`\\[${bKey}\\]`, 'gi');
      result = result.replace(bRegex, String(bVal));
    }
    // Clean up empty bullet lines for subjects that were not provided
    result = result.replace(/^•\s*:\s*\/100\s*–\s*.*$\n?/gm, '');
    result = result.replace(/^•\s*\{subject\d+_[^}]+\}:.*$\n?/gm, '');
    return result;
  }

  // Preview personalized messages for a list of students or an exam
  public async previewNotifications(
    examId: string,
    studentRecords?: Array<{
      registerNumber: string;
      studentName: string;
      parentMobile: string;
      parentName?: string;
      marks: { [subjectName: string]: number };
      totalMarks: number;
      maxMarks: number;
      percentage: number;
      studentId?: string;
    }>
  ): Promise<{
    collegeName: string;
    examName: string;
    previews: MessagePreviewItem[];
    duplicateCount: number;
  }> {
    const exam = await db.queryOne<any>('SELECT * FROM exams WHERE id = ?', [examId]);
    const examName = exam ? exam.exam_name : 'Internal Assessment – II';

    const collegeSetting = await db.queryOne<any>('SELECT value FROM system_settings WHERE key = ?', ['COLLEGE_NAME']);
    const collegeName = collegeSetting ? collegeSetting.value : 'VSB ENGINEERING COLLEGE';

    const waTemplateRow = await db.queryOne<any>("SELECT COALESCE(body, template_text) as template_body FROM message_templates WHERE channel = 'WHATSAPP' AND is_active = 1 ORDER BY (CASE WHEN id = 'tpl-ia2-whatsapp' THEN 0 ELSE 1 END), id ASC LIMIT 1");
    const smsTemplateRow = await db.queryOne<any>("SELECT COALESCE(body, template_text) as template_body FROM message_templates WHERE channel = 'SMS' AND is_active = 1 ORDER BY (CASE WHEN id = 'tpl-ia2-sms' THEN 0 ELSE 1 END), id ASC LIMIT 1");

    const defaultWATemplate = `VSB ENGINEERING COLLEGE, KARUR

Dear Parent of {student_name},

Internal Assessment – II Marks

Register No.: {register_number}
Class: {class_name} | Department: {department}

{marks}

Overall Result: {overall_result}

Regards,
VSB Engineering College, Karur.`;

    const defaultSMSTemplate = `VSB ENGINEERING COLLEGE, KARUR: Dear Parent of {student_name}, Register No: {register_number}, Class: {class_name}, Dept: {department}. IA-II Marks: {marks}. Overall Result: {overall_result}. Regards, VSB Engineering College, Karur.`;

    const waTemplate = waTemplateRow?.template_body || defaultWATemplate;
    const smsTemplate = smsTemplateRow?.template_body || defaultSMSTemplate;

    let recordsToProcess = studentRecords;
    if (!recordsToProcess || recordsToProcess.length === 0) {
      const dbMarks = await db.query<any>(
        `SELECT s.id as student_id, s.register_number, s.name as student_name,
                COALESCE(p.parent_name, s.parent_name) as parent_name,
                COALESCE(p.mobile_number, s.parent_phone) as parent_mobile,
                sub.subject_name, sub.max_marks, m.marks_obtained
         FROM marks m
         JOIN students s ON m.student_id = s.id
         JOIN subjects sub ON m.subject_id = sub.id
         LEFT JOIN parents p ON p.student_id = s.id
         WHERE m.exam_id = ?
         ORDER BY s.register_number ASC`,
        [examId]
      );

      const grouped = new Map<string, any>();
      for (const row of dbMarks) {
        if (!grouped.has(row.register_number)) {
          grouped.set(row.register_number, {
            studentId: row.student_id,
            registerNumber: row.register_number,
            studentName: row.student_name,
            parentName: row.parent_name,
            parentMobile: row.parent_mobile,
            marks: {},
            totalMarks: 0,
            maxMarks: 0,
            percentage: 0
          });
        }
        const student = grouped.get(row.register_number);
        student.marks[row.subject_name] = row.marks_obtained;
        student.totalMarks += row.marks_obtained;
        student.maxMarks += (row.max_marks || 100);
      }

      recordsToProcess = Array.from(grouped.values()).map(std => {
        std.percentage = std.maxMarks > 0 ? Number(((std.totalMarks / std.maxMarks) * 100).toFixed(1)) : 0;
        return std;
      });
    }

    const previews: MessagePreviewItem[] = [];
    let duplicateCount = 0;

    if (recordsToProcess && recordsToProcess.length > 0) {
      for (const rec of recordsToProcess) {
        let student = await db.queryOne<any>(
          `SELECT s.id, s.register_number, s.name, s.parent_name, s.parent_phone, p.parent_name as p_parent_name, p.mobile_number,
                  c.name as class_name, d.name as department_name
           FROM students s
           LEFT JOIN classes c ON s.class_id = c.id
           LEFT JOIN departments d ON c.department_id = d.id
           LEFT JOIN parents p ON p.student_id = s.id
           WHERE s.register_number = ?`,
          [rec.registerNumber]
        );

        const studentId = student?.id || rec.studentId || `std-tmp-${rec.registerNumber}`;
        const parentName = rec.parentName || student?.p_parent_name || student?.parent_name || 'Parent/Guardian';
        const parentMobile = rec.parentMobile || student?.mobile_number || student?.parent_phone || '';
        const department = (rec as any).department || student?.department_name || 'Information Technology';
        const className = (rec as any).className || student?.class_name || 'IT-C';

        // Duplicate check
        const existingSent = await db.queryOne<any>(
          `SELECT id FROM notifications
           WHERE student_id = ? AND exam_id = ? AND status IN ('SENT', 'DELIVERED')
           LIMIT 1`,
          [studentId, examId]
        );

        if (existingSent) duplicateCount++;

        const marksEntries = Object.entries(rec.marks).map(([subjectName, marksObtained]) => ({
          subjectName,
          marksObtained,
          maxMarks: 100
        }));
        const formattedMarks = this.formatMarksBlock(marksEntries);

        // Result is FAIL if ANY subject mark is < 50, otherwise PASS
        const hasFailSubject = marksEntries.some(m => m.marksObtained < 50);
        const resultStatus = hasFailSubject ? 'FAIL' : 'PASS';

        const subjectVars: Record<string, string | number> = {
          department,
          class_name: className,
          overall_result: resultStatus
        };

        for (let i = 0; i < 6; i++) {
          const entry = marksEntries[i];
          const num = i + 1;
          if (entry) {
            subjectVars[`subject${num}_name`] = entry.subjectName;
            subjectVars[`subject${num}_marks`] = entry.marksObtained;
            subjectVars[`subject${num}_result`] = entry.marksObtained >= 50 ? 'Pass' : 'Fail';
          } else {
            subjectVars[`subject${num}_name`] = '';
            subjectVars[`subject${num}_marks`] = '';
            subjectVars[`subject${num}_result`] = '';
          }
        }

        const templateVars = {
          parent_name: parentName,
          student_name: rec.studentName,
          register_number: rec.registerNumber,
          class_section: `${department} - ${className}`,
          exam_name: examName,
          marks: formattedMarks,
          total: rec.totalMarks,
          total_marks: rec.totalMarks,
          maximum_marks: rec.maxMarks || (marksEntries.length * 100),
          max_marks: rec.maxMarks || (marksEntries.length * 100),
          percentage: rec.percentage,
          result: resultStatus,
          college_name: collegeName,
          ...subjectVars
        };

        const renderedWhatsApp = this.renderTemplate(waTemplate, templateVars);
        const renderedSMS = this.renderTemplate(smsTemplate, templateVars);

        const lastFour = parentMobile.length >= 4 ? parentMobile.slice(-4) : '****';
        const masked = '******' + lastFour;

        previews.push({
          studentId,
          registerNumber: rec.registerNumber,
          studentName: rec.studentName,
          parentName,
          parentMobileMasked: masked,
          parentMobileRaw: parentMobile,
          renderedWhatsApp,
          renderedSMS,
          hasExistingSentNotification: !!existingSent,
          totalMarks: rec.totalMarks,
          maxMarks: rec.maxMarks || (marksEntries.length * 100),
          percentage: rec.percentage,
          marks: rec.marks,
          department,
          className,
          overallResult: resultStatus,
          result: resultStatus
        } as any);
      }
    }

    return { collegeName, examName, previews, duplicateCount };
  }

  // Create batch and dispatch notifications asynchronously
  public async sendBatchNotifications(params: {
    examId: string;
    uploadedFileId?: string;
    createdBy: string;
    channel: 'WHATSAPP' | 'SMS' | 'BOTH';
    whatsappSenderType?: 'PERSONAL' | 'CENTRAL';
    records: Array<{
      studentId: string;
      registerNumber: string;
      studentName: string;
      parentMobile: string;
      renderedWhatsApp?: string;
      renderedSMS?: string;
    }>;
    forceResend?: boolean;
  }): Promise<{ batchId: string; totalCreated: number; skippedDuplicates: number; senderInfo?: string }> {
    const { examId, uploadedFileId, createdBy, channel, records, forceResend, whatsappSenderType = 'PERSONAL' } = params;

    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await db.execute(
      `INSERT INTO notification_batches (id, exam_id, uploaded_file_id, created_by, total_notifications, successful_notifications, failed_notifications, status)
       VALUES (?, ?, ?, ?, ?, 0, 0, 'PROCESSING')`,
      [batchId, examId, uploadedFileId || null, createdBy, 0]
    );

    const channelsToSend: ('WHATSAPP' | 'SMS')[] = channel === 'BOTH' ? ['WHATSAPP', 'SMS'] : [channel];
    let createdCount = 0;
    let skippedCount = 0;

    const queuedNotifications: Array<{
      id: string;
      studentId: string;
      channel: 'WHATSAPP' | 'SMS';
      recipient: string;
      message: string;
    }> = [];

    for (const rec of records) {
      for (const ch of channelsToSend) {
        // Prevent duplicate unless forceResend is specified
        if (!forceResend) {
          const alreadySent = await db.queryOne<any>(
            `SELECT id FROM notifications
             WHERE student_id = ? AND exam_id = ? AND channel = ? AND status IN ('SENT', 'DELIVERED')`,
            [rec.studentId, examId, ch]
          );
          if (alreadySent) {
            skippedCount++;
            continue;
          }
        }

        const msg = ch === 'WHATSAPP' ? (rec.renderedWhatsApp || '') : (rec.renderedSMS || '');
        if (!msg || !rec.parentMobile) continue;

        const notifId = `notif-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
        await db.execute(
          `INSERT INTO notifications (id, batch_id, student_id, exam_id, channel, recipient, message, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'QUEUED')`,
          [notifId, batchId, rec.studentId, examId, ch, rec.parentMobile, msg]
        );

        queuedNotifications.push({
          id: notifId,
          studentId: rec.studentId,
          channel: ch,
          recipient: rec.parentMobile,
          message: msg
        });
        createdCount++;
      }
    }

    // Update total notifications in batch
    await db.execute('UPDATE notification_batches SET total_notifications = ? WHERE id = ?', [createdCount, batchId]);

    // Check sender info
    let senderInfo = 'Central Gateway';
    if (whatsappSenderType === 'PERSONAL') {
      const personalSession = baileysWhatsAppManager.getSession(createdBy);
      if (personalSession.status === 'CONNECTED') {
        senderInfo = `Personal WhatsApp (${personalSession.phoneNumber || 'Linked Phone'})`;
      }
    }

    // Process queued notifications asynchronously in background worker
    this.processQueue(batchId, queuedNotifications, createdBy, whatsappSenderType).catch(err => {
      console.error('[Notification Worker Error]:', err);
    });

    return { batchId, totalCreated: createdCount, skippedDuplicates: skippedCount, senderInfo };
  }

  // Background queue processor
  private async processQueue(
    batchId: string,
    queue: Array<{ id: string; channel: 'WHATSAPP' | 'SMS'; recipient: string; message: string }>,
    createdBy: string,
    whatsappSenderType: 'PERSONAL' | 'CENTRAL'
  ): Promise<void> {
    let successCount = 0;
    let failedCount = 0;

    for (const item of queue) {
      try {
        let result: { success: boolean; providerMessageId?: string; status: 'SENT' | 'DELIVERED' | 'FAILED'; errorMessage?: string };

        if (item.channel === 'WHATSAPP') {
          if (whatsappSenderType === 'PERSONAL') {
            const baileysRes = await baileysWhatsAppManager.sendMessage(createdBy, item.recipient, item.message);
            if (baileysRes.success) {
              result = {
                success: true,
                providerMessageId: baileysRes.messageId,
                status: 'SENT'
              };
            } else {
              // Fallback to central provider if personal failed
              console.warn(`[Baileys Personal Send Failed]: ${baileysRes.error}. Falling back to Central Gateway.`);
              result = await whatsAppProvider.sendMessage(item.recipient, item.message);
            }
          } else {
            result = await whatsAppProvider.sendMessage(item.recipient, item.message);
          }
        } else {
          result = await smsProvider.sendMessage(item.recipient, item.message);
        }

        if (result.success) {
          successCount++;
          await db.execute(
            `UPDATE notifications
             SET status = ?, provider_message_id = ?, sent_at = datetime('now'), delivered_at = datetime('now')
             WHERE id = ?`,
            [result.status, result.providerMessageId || null, item.id]
          );
        } else {
          failedCount++;
          await db.execute(
            `UPDATE notifications
             SET status = 'FAILED', error_message = ?, last_error = ?, last_retry_at = datetime('now')
             WHERE id = ?`,
            [result.errorMessage || 'Send failed', result.errorMessage || 'Send failed', item.id]
          );
        }
      } catch (err: any) {
        failedCount++;
        await db.execute(
          `UPDATE notifications
           SET status = 'FAILED', error_message = ?, last_error = ?, last_retry_at = datetime('now')
           WHERE id = ?`,
          [err.message, err.message, item.id]
        );
      }

      // Small throttling delay to mimic realistic queue dispatching
      await new Promise(resolve => setTimeout(resolve, 80));

      // Periodically update batch counters
      await db.execute(
        `UPDATE notification_batches
         SET successful_notifications = ?, failed_notifications = ?
         WHERE id = ?`,
        [successCount, failedCount, batchId]
      );
    }

    const finalStatus = failedCount === 0 ? 'COMPLETED' : (successCount > 0 ? 'PARTIAL' : 'FAILED');
    await db.execute(
      `UPDATE notification_batches
       SET status = ?, completed_at = datetime('now'), successful_notifications = ?, failed_notifications = ?
       WHERE id = ?`,
      [finalStatus, successCount, failedCount, batchId]
    );
  }

  // Retry a single failed notification (Section 25: max retries = 3)
  public async retrySingleNotification(notificationId: string): Promise<{ success: boolean; message: string }> {
    const notif = await db.queryOne<any>('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    if (!notif) throw new Error('Notification record not found');

    const maxRetrySetting = await db.queryOne<any>("SELECT value FROM system_settings WHERE key = 'MAX_RETRY_COUNT'");
    const maxRetries = maxRetrySetting ? parseInt(maxRetrySetting.value, 10) : 3;

    if (notif.retry_count >= maxRetries) {
      throw new Error(`Maximum retry limit (${maxRetries}) reached for this notification.`);
    }

    const newRetryCount = (notif.retry_count || 0) + 1;
    await db.execute(
      `UPDATE notifications SET status = 'RETRYING', retry_count = ?, last_retry_at = datetime('now') WHERE id = ?`,
      [newRetryCount, notificationId]
    );

    let result: { success: boolean; providerMessageId?: string; status: 'SENT' | 'DELIVERED' | 'FAILED'; errorMessage?: string };
    if (notif.channel === 'WHATSAPP') {
      result = await whatsAppProvider.sendMessage(notif.recipient, notif.message);
    } else {
      result = await smsProvider.sendMessage(notif.recipient, notif.message);
    }

    if (result.success) {
      await db.execute(
        `UPDATE notifications
         SET status = ?, provider_message_id = ?, error_message = NULL, sent_at = datetime('now'), delivered_at = datetime('now')
         WHERE id = ?`,
        [result.status, result.providerMessageId || null, notificationId]
      );
      return { success: true, message: 'Notification resent successfully.' };
    } else {
      await db.execute(
        `UPDATE notifications
         SET status = 'FAILED', error_message = ?, last_error = ?
         WHERE id = ?`,
        [result.errorMessage || 'Retry failed', result.errorMessage || 'Retry failed', notificationId]
      );
      return { success: false, message: result.errorMessage || 'Retry failed.' };
    }
  }

  // Retry all failed notifications in bulk (up to max retries)
  public async retryAllFailed(limit: number = 50): Promise<{ retried: number; successful: number; failed: number }> {
    const maxRetrySetting = await db.queryOne<any>("SELECT value FROM system_settings WHERE key = 'MAX_RETRY_COUNT'");
    const maxRetries = maxRetrySetting ? parseInt(maxRetrySetting.value, 10) : 3;

    const failedNotifs = await db.query<any>(
      `SELECT id FROM notifications
       WHERE status = 'FAILED' AND retry_count < ?
       LIMIT ?`,
      [maxRetries, limit]
    );

    let successful = 0;
    let failed = 0;

    for (const item of failedNotifs) {
      try {
        const res = await this.retrySingleNotification(item.id);
        if (res.success) successful++;
        else failed++;
      } catch (err) {
        failed++;
      }
    }

    return { retried: failedNotifs.length, successful, failed };
  }
}

export const notificationService = new NotificationService();
