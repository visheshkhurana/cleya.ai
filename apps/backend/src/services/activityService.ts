import { prisma } from '@cleya/db';

export class ActivityService {
  async record(userId: string, type: string, title: string, metadata?: any) {
    try {
      await prisma.activity.create({
        data: { userId, type, title, metadata },
      });
    } catch (e) {
      console.log('[ActivityService] Failed to record activity:', e);
    }
  }

  async recordMatchFound(userId: string, otherName: string) {
    await this.record(userId, 'MATCH_FOUND', `New match found — ${otherName}`);
  }

  async recordIntroSent(userId: string, otherName: string) {
    await this.record(userId, 'INTRO_SENT', `Introduction sent — You and ${otherName} are now connected`);
  }

  async recordInviteUsed(userId: string, inviteeName: string) {
    await this.record(userId, 'INVITE_USED', `${inviteeName} joined Cleya using your invite code`);
  }
}

export const activityService = new ActivityService();
