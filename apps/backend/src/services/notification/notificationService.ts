import { prisma } from '@cleya/db';
import { sendToUser } from '../../websocket/server';

type NotifChannel = 'WHATSAPP' | 'EMAIL' | 'SMS' | 'IN_APP';
type NotifEvent = 'MATCH_FOUND' | 'INTRO_REQUEST' | 'INTRO_ACCEPTED' | 'INTRO_REJECTED' | 'PROFILE_COMPLETE' | 'CALL_SCHEDULED' | 'CALL_REMINDER';

interface NotificationPayload {
  userId: string;
  channel: NotifChannel;
  event: NotifEvent;
  title: string;
  body: string;
  metadata?: Record<string, any>;
}

export class NotificationService {
  async send(payload: NotificationPayload) {
    const notification = await prisma.notification.create({
      data: {
        userId: payload.userId,
        channel: payload.channel,
        event: payload.event,
        title: payload.title,
        body: payload.body,
        metadata: payload.metadata || {},
      },
    });

    try {
      switch (payload.channel) {
        case 'IN_APP':
          this.sendInApp(payload);
          break;
        case 'WHATSAPP':
          await this.sendWhatsApp(payload);
          break;
        case 'SMS':
          await this.sendSMS(payload);
          break;
        case 'EMAIL':
          await this.sendEmail(payload);
          break;
      }

      await prisma.notification.update({
        where: { id: notification.id },
        data: { sentAt: new Date() },
      });
    } catch (error) {
      console.error(`Notification dispatch failed for ${payload.channel}:`, error);
    }

    return notification;
  }

  async sendMultiChannel(userId: string, event: NotifEvent, title: string, body: string, metadata?: Record<string, any>) {
    const channels: NotifChannel[] = ['IN_APP'];

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.phone) channels.push('WHATSAPP');

    const results = await Promise.allSettled(
      channels.map((channel) =>
        this.send({ userId, channel, event, title, body, metadata })
      )
    );

    return results;
  }

  private sendInApp(payload: NotificationPayload) {
    sendToUser(payload.userId, 'notification', {
      title: payload.title,
      body: payload.body,
      event: payload.event,
      metadata: payload.metadata,
    });
  }

  private async sendWhatsApp(payload: NotificationPayload) {
    const { messagingService } = await import('../messagingService');
    const provider = messagingService.getActiveProvider();

    if (provider === 'none') {
      console.warn('Gupshup not configured, WhatsApp notification skipped');
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.phone) return;

    try {
      await messagingService.sendWhatsApp(
        payload.userId,
        user.phone,
        `*${payload.title}*\n\n${payload.body}`
      );
    } catch (error) {
      console.error('WhatsApp notification failed:', error);
    }
  }

  private async sendSMS(payload: NotificationPayload) {
    const { messagingService } = await import('../messagingService');
    const provider = messagingService.getActiveProvider();

    if (provider === 'none') {
      console.warn('Gupshup not configured, SMS notification skipped (would send via WhatsApp)');
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.phone) return;

    try {
      await messagingService.sendWhatsApp(
        payload.userId,
        user.phone,
        `${payload.title}: ${payload.body}`
      );
    } catch (error) {
      console.error('SMS (via WhatsApp) notification failed:', error);
    }
  }

  private async sendEmail(payload: NotificationPayload) {
    console.log(`Email would be sent to user ${payload.userId}: ${payload.title}`);
  }

  async getNotifications(userId: string, limit = 20) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async markRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, readAt: null },
    });
  }
}

export const notificationService = new NotificationService();
