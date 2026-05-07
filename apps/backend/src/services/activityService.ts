import { prisma } from '@cleya/db';

/**
 * Thin wrapper around the `activities` table. All methods are
 * intentionally fire-and-forget (errors are caught and logged) so an
 * activity-recording failure can never break a primary user action like
 * "respond to match" or "save profile". The audit found this table empty
 * in the engagement report — every recommended hook below is now wired
 * from matchingService, profileService, and conversationService.
 */
export class ActivityService {
  async record(userId: string, type: string, title: string, metadata?: any) {
    try {
      await prisma.activity.create({
        data: { userId, type, title, metadata },
      });
    } catch (e) {
      console.log('[ActivityService] Failed to record activity:', (e as Error).message);
    }
  }

  async recordMatchFound(userId: string, otherName: string, matchId?: string) {
    await this.record(userId, 'MATCH_FOUND', `New match found — ${otherName}`, matchId ? { matchId } : undefined);
  }

  async recordMatchProposed(userId: string, otherName: string, matchId: string, score?: number) {
    await this.record(userId, 'MATCH_PROPOSED', `New match: ${otherName}`, { matchId, score });
  }

  async recordMatchViewed(userId: string, matchId: string) {
    await this.record(userId, 'MATCH_VIEWED', 'Match viewed', { matchId });
  }

  async recordMatchResponded(userId: string, matchId: string, response: 'ACCEPTED' | 'REJECTED', otherName?: string) {
    const verb = response === 'ACCEPTED' ? 'accepted' : 'declined';
    const title = otherName ? `You ${verb} match with ${otherName}` : `You ${verb} a match`;
    await this.record(userId, `MATCH_${response}`, title, { matchId });
  }

  async recordIntroSent(userId: string, otherName: string, matchId?: string) {
    await this.record(userId, 'INTRO_SENT', `Introduction sent — You and ${otherName} are now connected`, matchId ? { matchId } : undefined);
  }

  async recordInviteUsed(userId: string, inviteeName: string) {
    await this.record(userId, 'INVITE_USED', `${inviteeName} joined Cleya using your invite code`);
  }

  async recordProfileUpdated(userId: string, changedFields: string[]) {
    if (!changedFields.length) return;
    const summary = changedFields.length <= 3
      ? changedFields.join(', ')
      : `${changedFields.slice(0, 3).join(', ')} +${changedFields.length - 3} more`;
    await this.record(userId, 'PROFILE_UPDATED', `Profile updated (${summary})`, { fields: changedFields });
  }

  async recordConversationStarted(userId: string, flowId: string, conversationId: string) {
    await this.record(userId, 'CONVERSATION_STARTED', `Started ${flowId}`, { flowId, conversationId });
  }

  async recordConversationCompleted(userId: string, flowId: string, conversationId: string) {
    await this.record(userId, 'CONVERSATION_COMPLETED', `Completed ${flowId}`, { flowId, conversationId });
  }
}

export const activityService = new ActivityService();
