import { NotificationChannel, NotificationStatus, RecipientStatus, BatchStatus, TemplateChannel } from '../../database/types';
import { prisma } from '../../database/prisma';
import { queueService } from '../../queue/queue.service';
import { renderTemplate, formatMarksBlock, SubjectMarkEntry, buildTemplateVariables } from '../../utils/template';
import { templatesService } from '../templates/templates.service';
import { config } from '../../config';
import { logAudit } from '../../middleware/auth';

export class NotificationsService {
  // Previews rendered messages for all recipients in a batch
  public async previewBatchMessages(batchId: string, customTemplateText?: string) {
    const batch = await prisma.notificationBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch) throw new Error(`Batch '${batchId}' not found`);

    const defaultWaTemplate = customTemplateText || (await templatesService.getActiveTemplate(TemplateChannel.WHATSAPP));
    const defaultSmsTemplate = customTemplateText || (await templatesService.getActiveTemplate(TemplateChannel.SMS));

    const recipients = await prisma.batchRecipient.findMany({
      where: {
        batch_id: batchId,
        status: { in: [RecipientStatus.VALID, RecipientStatus.WARNING] },
      },
      orderBy: { created_at: 'asc' },
    });

    const collegeName = config.college.name;

    const previews = recipients.map((r: any) => {
      const templateVars = buildTemplateVariables(r, batch.exam_name, collegeName);

      const renderedWhatsApp = renderTemplate(defaultWaTemplate, templateVars);
      const renderedSMS = renderTemplate(defaultSmsTemplate, templateVars);

      return {
        recipientId: r.id,
        registerNumber: r.register_number,
        studentName: r.student_name,
        parentName: r.parent_name || 'Parent/Guardian',
        parentMobileMasked: r.phone_masked,
        totalMarks: Number(r.total_marks),
        maxMarks: Number(r.max_marks),
        percentage: Number(r.percentage),
        renderedWhatsApp,
        renderedSMS,
      };
    });

    return {
      batchId,
      examName: batch.exam_name,
      collegeName,
      totalRecipients: previews.length,
      templates: {
        whatsapp: defaultWaTemplate,
        sms: defaultSmsTemplate,
      },
      previews,
    };
  }

  // Dispatches batch notifications asynchronously (supports selecting specific students)
  public async sendBatch(params: {
    batchId: string;
    userId: string;
    channel: 'WHATSAPP' | 'SMS' | 'BOTH';
    customTemplate?: string;
    forceResend?: boolean;
    recipientIds?: string[];
    registerNumbers?: string[];
  }) {
    const { batchId, userId, channel, customTemplate, forceResend, recipientIds, registerNumbers } = params;

    const batch = await prisma.notificationBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw new Error(`Batch '${batchId}' not found`);

    const whereClause: any = {
      batch_id: batchId,
      status: { in: [RecipientStatus.VALID, RecipientStatus.WARNING] },
    };

    if (recipientIds && recipientIds.length > 0) {
      whereClause.id = { in: recipientIds };
    } else if (registerNumbers && registerNumbers.length > 0) {
      whereClause.register_number = { in: registerNumbers };
    }

    const recipients = await prisma.batchRecipient.findMany({
      where: whereClause,
    });

    if (recipients.length === 0) {
      throw new Error('No eligible recipient records selected to notify.');
    }

    const channelsToSend: NotificationChannel[] =
      channel === 'BOTH'
        ? [NotificationChannel.WHATSAPP, NotificationChannel.SMS]
        : [channel as NotificationChannel];

    const defaultWaTemplate = customTemplate || (await templatesService.getActiveTemplate(TemplateChannel.WHATSAPP));
    const defaultSmsTemplate = customTemplate || (await templatesService.getActiveTemplate(TemplateChannel.SMS));
    const collegeName = config.college.name;

    let queuedCount = 0;
    let skippedCount = 0;

    await prisma.notificationBatch.update({
      where: { id: batchId },
      data: { batch_status: BatchStatus.PROCESSING },
    });

    for (const r of recipients) {
      const templateVars = buildTemplateVariables(r, batch.exam_name, collegeName);

      for (const ch of channelsToSend) {
        // Duplicate check: if already sent/delivered, skip unless forceResend
        if (!forceResend) {
          const existing = await prisma.notification.findFirst({
            where: {
              batch_id: batchId,
              recipient_reference: r.register_number,
              channel: ch,
              status: { in: [NotificationStatus.SENT, NotificationStatus.DELIVERED] },
            },
          });

          if (existing) {
            skippedCount++;
            continue;
          }
        }

        const msgText =
          ch === NotificationChannel.WHATSAPP
            ? renderTemplate(defaultWaTemplate, templateVars)
            : renderTemplate(defaultSmsTemplate, templateVars);

        // Create individual notification record
        const notification = await prisma.notification.create({
          data: {
            batch_id: batchId,
            recipient_reference: r.register_number,
            channel: ch,
            message_text: msgText,
            status: NotificationStatus.QUEUED,
          },
        });

        // Add to background queue
        await queueService.enqueue({
          notificationId: notification.id,
          batchId,
          channel: ch,
          encryptedRecipientPhone: r.encrypted_phone,
          messageText: msgText,
          attemptNumber: 1,
        });

        queuedCount++;
      }
    }

    await prisma.notificationBatch.update({
      where: { id: batchId },
      data: {
        total_notifications: queuedCount,
      },
    });

    await logAudit(userId, 'SEND_BATCH', 'notification_batches', batchId, {
      channel,
      queued: queuedCount,
      skipped: skippedCount,
    });

    return {
      batchId,
      queued: queuedCount,
      skippedDuplicates: skippedCount,
      message: `Successfully queued ${queuedCount} notifications for delivery`,
    };
  }

  // Live progress summary
  public async getBatchStatus(batchId: string) {
    const batch = await prisma.notificationBatch.findUnique({
      where: { id: batchId },
      include: {
        creator: {
          select: { full_name: true, department: true },
        },
      },
    });
    if (!batch) throw new Error(`Batch '${batchId}' not found`);

    const stats = await prisma.notification.groupBy({
      by: ['channel', 'status'],
      where: { batch_id: batchId },
      _count: { id: true },
    });

    const breakdown: Record<string, Record<string, number>> = {
      WHATSAPP: { PENDING: 0, QUEUED: 0, PROCESSING: 0, SENT: 0, DELIVERED: 0, FAILED: 0 },
      SMS: { PENDING: 0, QUEUED: 0, PROCESSING: 0, SENT: 0, DELIVERED: 0, FAILED: 0 },
    };

    let total = 0;
    let sent = 0;
    let delivered = 0;
    let failed = 0;
    let inProgress = 0;

    for (const item of stats) {
      const ch = item.channel;
      const st = item.status;
      const count = item._count.id;
      total += count;

      if (!breakdown[ch]) {
        breakdown[ch] = {};
      }
      breakdown[ch][st] = count;

      if (st === NotificationStatus.SENT) sent += count;
      else if (st === NotificationStatus.DELIVERED) delivered += count;
      else if (st === NotificationStatus.FAILED) failed += count;
      else inProgress += count;
    }

    return {
      batchId: batch.id,
      examName: batch.exam_name,
      status: batch.batch_status,
      createdAt: batch.created_at,
      completedAt: batch.completed_at,
      creator: batch.creator,
      counts: {
        total,
        inProgress,
        sent,
        delivered,
        failed,
      },
      channelBreakdown: breakdown,
    };
  }

  // Retry a single failed notification
  public async retryNotification(notificationId: string, userId: string) {
    const notif = await prisma.notification.findUnique({
      where: { id: notificationId },
      include: { batch: true },
    });
    if (!notif) throw new Error(`Notification '${notificationId}' not found`);

    if (notif.status !== NotificationStatus.FAILED) {
      throw new Error(`Notification is currently '${notif.status}' and cannot be retried.`);
    }

    if (notif.attempts >= 5) {
      throw new Error('Maximum retry attempts (5) reached for this notification.');
    }

    const recipient = await prisma.batchRecipient.findFirst({
      where: {
        batch_id: notif.batch_id,
        register_number: notif.recipient_reference,
      },
    });

    if (!recipient) {
      throw new Error('Recipient details could not be found for retry');
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.QUEUED,
        error_code: null,
        error_message: null,
      },
    });

    await queueService.enqueue({
      notificationId: notif.id,
      batchId: notif.batch_id,
      channel: notif.channel as NotificationChannel,
      encryptedRecipientPhone: recipient.encrypted_phone,
      messageText: notif.message_text,
      attemptNumber: notif.attempts + 1,
    });

    await logAudit(userId, 'RETRY_NOTIFICATION', 'notifications', notificationId, {
      channel: notif.channel,
    });

    return { message: 'Notification re-queued for delivery' };
  }

  // Retry all failed notifications for a batch (optionally filtered by channel)
  public async retryFailedBatch(batchId: string, channelFilter?: NotificationChannel, userId?: string) {
    const where: any = {
      batch_id: batchId,
      status: NotificationStatus.FAILED,
      attempts: { lt: 5 },
    };

    if (channelFilter) {
      where.channel = channelFilter;
    }

    const failedNotifs = await prisma.notification.findMany({
      where,
    });

    if (failedNotifs.length === 0) {
      return { message: 'No eligible failed notifications to retry', retriedCount: 0 };
    }

    let retried = 0;
    for (const notif of failedNotifs) {
      const recipient = await prisma.batchRecipient.findFirst({
        where: {
          batch_id: batchId,
          register_number: notif.recipient_reference,
        },
      });

      if (recipient) {
        await prisma.notification.update({
          where: { id: notif.id },
          data: {
            status: NotificationStatus.QUEUED,
            error_code: null,
            error_message: null,
          },
        });

        await queueService.enqueue({
          notificationId: notif.id,
          batchId,
          channel: notif.channel as NotificationChannel,
          encryptedRecipientPhone: recipient.encrypted_phone,
          messageText: notif.message_text,
          attemptNumber: notif.attempts + 1,
        });

        retried++;
      }
    }

    await logAudit(userId, 'RETRY_BATCH_FAILED', 'notification_batches', batchId, {
      retriedCount: retried,
      channelFilter,
    });

    return {
      message: `Re-queued ${retried} failed notifications`,
      retriedCount: retried,
    };
  }

  // List notification records with pagination
  public async listNotifications(params: {
    batchId?: string;
    channel?: NotificationChannel;
    status?: NotificationStatus;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.batchId) where.batch_id = params.batchId;
    if (params.channel) where.channel = params.channel;
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { recipient_reference: { contains: params.search, mode: 'insensitive' } },
        { message_text: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          batch: {
            select: { exam_name: true, original_file_name: true },
          },
        },
      }),
    ]);

    return {
      notifications,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}

export const notificationsService = new NotificationsService();
