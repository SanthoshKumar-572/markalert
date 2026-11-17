import { Queue, Worker, Job } from 'bullmq';
import { NotificationChannel, NotificationStatus } from '../database/types';
import { config } from '../config';
import { prisma } from '../database/prisma';
import { whatsAppProvider } from '../providers/whatsapp/whatsapp.provider';
import { smsProvider } from '../providers/sms/sms.provider';
import { decryptText } from '../utils/crypto';

export interface NotificationJobData {
  notificationId: string;
  batchId: string;
  channel: NotificationChannel;
  encryptedRecipientPhone: string;
  messageText: string;
  attemptNumber: number;
}

class QueueService {
  private bullQueue: Queue | null = null;
  private bullWorker: Worker | null = null;
  private isRedisConnected: boolean = false;
  private inMemoryQueue: NotificationJobData[] = [];
  private isProcessingInMemory: boolean = false;

  public async init(): Promise<void> {
    const redisUrl = config.redis.url;
    const isLocalRedis = !redisUrl || redisUrl.includes('localhost') || redisUrl.includes('127.0.0.1');

    // Skip attempting Redis connection if not provided or pointing to localhost in production
    if (!redisUrl || (config.nodeEnv === 'production' && isLocalRedis)) {
      this.isRedisConnected = false;
      this.bullQueue = null;
      this.bullWorker = null;
      console.log('[Queue] Running with robust in-process async worker (Redis not configured).');
      return;
    }

    try {
      const Redis = (await import('ioredis')).default;
      const testClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 2000,
        lazyConnect: true,
        retryStrategy: () => null,
      });

      testClient.on('error', () => {
        // Absorb connection errors during pre-flight check
      });

      await testClient.connect();
      await testClient.ping();
      testClient.disconnect();

      // Redis is alive, initialize BullMQ
      this.bullQueue = new Queue('markalert-notifications', {
        connection: { url: redisUrl },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 1000,
          removeOnFail: 5000,
        },
      });

      this.bullQueue.on('error', err => {
        console.warn(`[BullMQ Queue Warning]:`, err.message);
      });

      this.bullWorker = new Worker(
        'markalert-notifications',
        async (job: Job<NotificationJobData>) => {
          await this.processNotificationJob(job.data);
        },
        {
          connection: { url: redisUrl },
          concurrency: 5,
        }
      );

      this.bullWorker.on('completed', job => {
        console.log(`[BullMQ] Notification job ${job.id} completed for ${job.data.channel}`);
      });

      this.bullWorker.on('failed', (job, err) => {
        console.error(`[BullMQ] Notification job ${job?.id} failed:`, err.message);
      });

      this.bullWorker.on('error', err => {
        console.warn(`[BullMQ Worker Warning]:`, err.message);
      });

      this.isRedisConnected = true;
      console.log('[Queue] BullMQ connected to Redis successfully.');
    } catch (err: any) {
      this.isRedisConnected = false;
      this.bullQueue = null;
      this.bullWorker = null;
      console.warn(`[Queue] Redis connection unavailable (${err.message}). Using robust in-process async worker.`);
    }
  }

  public async enqueue(jobData: NotificationJobData): Promise<void> {
    if (this.isRedisConnected && this.bullQueue) {
      try {
        await this.bullQueue.add(`${jobData.channel}-${jobData.notificationId}`, jobData, {
          jobId: jobData.notificationId, // Idempotency key: prevents duplicate jobs
        });
        return;
      } catch (err: any) {
        console.warn('[Queue] BullMQ add failed, falling back to in-process queue:', err.message);
      }
    }

    // In-process async queue fallback
    this.inMemoryQueue.push(jobData);
    this.triggerInMemoryProcessor();
  }

  private triggerInMemoryProcessor(): void {
    if (this.isProcessingInMemory) return;
    this.isProcessingInMemory = true;

    setImmediate(async () => {
      while (this.inMemoryQueue.length > 0) {
        const job = this.inMemoryQueue.shift();
        if (job) {
          try {
            await this.processNotificationJob(job);
          } catch (err: any) {
            console.error('[In-Process Queue Error]:', err.message);
          }
          // Throttle slightly between dispatches
          await new Promise(r => setTimeout(r, 60));
        }
      }
      this.isProcessingInMemory = false;
    });
  }

  // Core execution logic for both BullMQ and in-process queue
  public async processNotificationJob(job: NotificationJobData): Promise<void> {
    const { notificationId, batchId, channel, encryptedRecipientPhone, messageText } = job;

    // Check if notification is already delivered (prevent duplicate dispatch)
    const existing = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!existing || existing.status === NotificationStatus.DELIVERED) {
      return;
    }

    // Decrypt phone number for sending
    const rawPhone = decryptText(encryptedRecipientPhone);
    if (!rawPhone) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
          error_code: 'DECRYPTION_FAILED',
          error_message: 'Recipient phone number could not be decrypted',
          failed_at: new Date(),
        },
      });
      return;
    }

    // Mark as PROCESSING
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.PROCESSING,
        attempts: { increment: 1 },
      },
    });

    let sendResult: any;

    if (channel === NotificationChannel.WHATSAPP) {
      sendResult = await whatsAppProvider.sendMessage({
        recipient: rawPhone,
        messageText,
      });
    } else {
      sendResult = await smsProvider.sendMessage({
        recipient: rawPhone,
        messageText,
      });
    }

    const now = new Date();

    if (sendResult.success) {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.SENT,
          provider_message_id: sendResult.providerMessageId || null,
          sent_at: now,
          error_code: null,
          error_message: null,
        },
      });

      // Log event
      await prisma.notificationEvent.create({
        data: {
          notification_id: notificationId,
          event_type: 'SENT',
          provider_payload: JSON.stringify(sendResult.rawResponse || { status: 'SENT' }),
        },
      });
    } else {
      await prisma.notification.update({
        where: { id: notificationId },
        data: {
          status: NotificationStatus.FAILED,
          failed_at: now,
          error_code: 'SEND_FAILED',
          error_message: sendResult.errorMessage || 'Failed to dispatch via provider',
        },
      });

      await prisma.notificationEvent.create({
        data: {
          notification_id: notificationId,
          event_type: 'FAILED',
          provider_payload: JSON.stringify({ error: sendResult.errorMessage }),
        },
      });
    }

    // Reconcile batch stats
    await this.updateBatchStatus(batchId);
  }

  public async updateBatchStatus(batchId: string): Promise<void> {
    const stats = await prisma.notification.groupBy({
      by: ['status'],
      where: { batch_id: batchId },
      _count: { id: true },
    });

    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const s of stats) {
      statusCounts[s.status] = s._count.id;
      total += s._count.id;
    }

    const pending = (statusCounts[NotificationStatus.PENDING] || 0) + (statusCounts[NotificationStatus.QUEUED] || 0) + (statusCounts[NotificationStatus.PROCESSING] || 0);
    const sent = statusCounts[NotificationStatus.SENT] || 0;
    const delivered = statusCounts[NotificationStatus.DELIVERED] || 0;
    const failed = statusCounts[NotificationStatus.FAILED] || 0;

    let newBatchStatus = 'PROCESSING';
    let completedAt: Date | null = null;

    if (pending === 0) {
      if (failed === 0) {
        newBatchStatus = 'COMPLETED';
      } else if (delivered + sent > 0) {
        newBatchStatus = 'PARTIAL';
      } else {
        newBatchStatus = 'FAILED';
      }
      completedAt = new Date();
    }

    await prisma.notificationBatch.update({
      where: { id: batchId },
      data: {
        total_notifications: total,
        batch_status: newBatchStatus as any,
        completed_at: completedAt,
      },
    });
  }
}

export const queueService = new QueueService();
