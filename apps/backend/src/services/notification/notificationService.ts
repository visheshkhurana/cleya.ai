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

interface SendResult {
  channel: NotifChannel;
  success: boolean;
  fallback?: NotifChannel;
}

export class NotificationService {
  async send(payload: NotificationPayload): Promise<{ notification: any; result: SendResult }> {
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

    let sendSuccess = false;
    let fallbackChannel: NotifChannel | undefined;

    try {
      switch (payload.channel) {
        case 'IN_APP':
          this.sendInApp(payload);
          sendSuccess = true;
          break;
        case 'WHATSAPP':
          sendSuccess = await this.sendWhatsApp(payload);
          if (!sendSuccess) {
            console.log(`[NotificationService] WhatsApp failed for ${payload.userId}, falling back to EMAIL`);
            fallbackChannel = 'EMAIL';
            sendSuccess = await this.sendEmail(payload);
            if (!sendSuccess) {
              console.log(`[NotificationService] Email fallback also failed for ${payload.userId}, falling back to IN_APP`);
              fallbackChannel = 'IN_APP';
              this.sendInApp(payload);
              sendSuccess = true;
            }
          }
          break;
        case 'SMS':
          sendSuccess = await this.sendSMS(payload);
          if (!sendSuccess) {
            console.log(`[NotificationService] SMS failed for ${payload.userId}, falling back to EMAIL`);
            fallbackChannel = 'EMAIL';
            sendSuccess = await this.sendEmail(payload);
            if (!sendSuccess) {
              fallbackChannel = 'IN_APP';
              this.sendInApp(payload);
              sendSuccess = true;
            }
          }
          break;
        case 'EMAIL':
          sendSuccess = await this.sendEmail(payload);
          if (!sendSuccess) {
            console.log(`[NotificationService] Email failed for ${payload.userId}, falling back to IN_APP`);
            fallbackChannel = 'IN_APP';
            this.sendInApp(payload);
            sendSuccess = true;
          }
          break;
      }

      if (sendSuccess) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: { sentAt: new Date() },
        });
      }
    } catch (error) {
      console.error(`Notification dispatch failed for ${payload.channel}:`, error);
    }

    return {
      notification,
      result: { channel: payload.channel, success: sendSuccess, fallback: fallbackChannel },
    };
  }

  async sendMultiChannel(userId: string, event: NotifEvent, title: string, body: string, channels?: NotifChannel[], metadata?: Record<string, any>) {
    const requestedChannels: NotifChannel[] = channels || ['IN_APP'];

    if (!channels) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user?.phone) requestedChannels.push('WHATSAPP');
    }

    const results = await Promise.allSettled(
      requestedChannels.map((channel) =>
        this.send({ userId, channel, event, title, body, metadata })
      )
    );

    const summary = results.map((r, i) => ({
      channel: requestedChannels[i],
      status: r.status,
      ...(r.status === 'fulfilled' ? { result: r.value.result } : { error: (r as PromiseRejectedResult).reason?.message }),
    }));

    console.log(`[NotificationService] Multi-channel send for ${userId}: ${JSON.stringify(summary)}`);
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

  private async sendWhatsApp(payload: NotificationPayload): Promise<boolean> {
    const { messagingService } = await import('../messagingService');
    const provider = messagingService.getActiveProvider();

    if (provider === 'none') {
      console.warn('Gupshup not configured, WhatsApp notification skipped');
      return false;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.phone) return false;

    try {
      const result = await messagingService.sendWhatsApp(
        payload.userId,
        user.phone,
        `*${payload.title}*\n\n${payload.body}`
      );
      return result?.status !== 'FAILED';
    } catch (error) {
      console.error('WhatsApp notification failed:', error);
      return false;
    }
  }

  private async sendSMS(payload: NotificationPayload): Promise<boolean> {
    const { messagingService } = await import('../messagingService');
    const provider = messagingService.getActiveProvider();

    if (provider === 'none') {
      console.warn('Gupshup not configured, SMS notification skipped (would send via WhatsApp)');
      return false;
    }

    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.phone) return false;

    try {
      const result = await messagingService.sendWhatsApp(
        payload.userId,
        user.phone,
        `${payload.title}: ${payload.body}`
      );
      return result?.status !== 'FAILED';
    } catch (error) {
      console.error('SMS (via WhatsApp) notification failed:', error);
      return false;
    }
  }

  private async sendEmail(payload: NotificationPayload): Promise<boolean> {
    try {
      const { emailService } = await import('../email');
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user?.email) {
        console.warn(`No email for user ${payload.userId}, email notification skipped`);
        return false;
      }

      await emailService.sendFollowup(user.email, payload.title, payload.body);
      console.log(`[NotificationService] Email sent to ${user.email}: ${payload.title}`);
      return true;
    } catch (error) {
      console.error(`Email notification failed for ${payload.userId}:`, error);
      return false;
    }
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
