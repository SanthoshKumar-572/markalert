import { NotificationChannel, NotificationStatus, Role } from '../../database/types';
import { prisma } from '../../database/prisma';

export class ReportsService {
  public async getOverview(userId: string, role: Role) {
    const isFaculty = role === Role.FACULTY;

    // Filter by user if faculty, otherwise system-wide for admin
    const batchWhere: any = isFaculty ? { created_by: userId } : {};
    const notifWhere: any = isFaculty
      ? { batch: { created_by: userId } }
      : {};

    const [
      totalBatches,
      totalNotifications,
      whatsappSent,
      smsSent,
      totalDelivered,
      totalFailed,
      recentBatches,
      facultyCount,
    ] = await Promise.all([
      prisma.notificationBatch.count({ where: batchWhere }),
      prisma.notification.count({ where: notifWhere }),
      prisma.notification.count({
        where: { ...notifWhere, channel: NotificationChannel.WHATSAPP },
      }),
      prisma.notification.count({
        where: { ...notifWhere, channel: NotificationChannel.SMS },
      }),
      prisma.notification.count({
        where: { ...notifWhere, status: NotificationStatus.DELIVERED },
      }),
      prisma.notification.count({
        where: { ...notifWhere, status: NotificationStatus.FAILED },
      }),
      prisma.notificationBatch.findMany({
        where: batchWhere,
        take: 5,
        orderBy: { created_at: 'desc' },
        include: {
          creator: {
            select: { full_name: true, department: true },
          },
          _count: {
            select: { notifications: true, recipients: true },
          },
        },
      }),
      role === Role.ADMIN ? prisma.user.count({ where: { role: Role.FACULTY } }) : Promise.resolve(0),
    ]);

    return {
      totalBatches,
      totalNotifications,
      whatsappSent,
      smsSent,
      totalDelivered,
      totalFailed,
      facultyCount,
      deliveryRate:
        totalNotifications > 0
          ? Number(((totalDelivered / totalNotifications) * 100).toFixed(1))
          : 0,
      recentBatches,
    };
  }

  public async getSystemSettings() {
    const settings = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  }

  public async updateSystemSettings(updates: Record<string, string>) {
    for (const [key, value] of Object.entries(updates)) {
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
    }
    return { success: true, message: 'Settings updated successfully' };
  }
}

export const reportsService = new ReportsService();
