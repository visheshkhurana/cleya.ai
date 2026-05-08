"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityService = exports.ActivityService = void 0;
const db_1 = require("@cleya/db");
/**
 * Thin wrapper around the `activities` table. All methods are
 * intentionally fire-and-forget (errors are caught and logged) so an
 * activity-recording failure can never break a primary user action like
 * "respond to match" or "save profile". The audit found this table empty
 * in the engagement report — every recommended hook below is now wired
 * from matchingService, profileService, and conversationService.
 */
class ActivityService {
    async record(userId, type, title, metadata) {
        try {
            await db_1.prisma.activity.create({
                data: { userId, type, title, metadata },
            });
        }
        catch (e) {
            console.log('[ActivityService] Failed to record activity:', e.message);
        }
    }
    async recordMatchFound(userId, otherName, matchId) {
        await this.record(userId, 'MATCH_FOUND', `New match found — ${otherName}`, matchId ? { matchId } : undefined);
    }
    async recordMatchProposed(userId, otherName, matchId, score) {
        await this.record(userId, 'MATCH_PROPOSED', `New match: ${otherName}`, { matchId, score });
    }
    async recordMatchViewed(userId, matchId) {
        await this.record(userId, 'MATCH_VIEWED', 'Match viewed', { matchId });
    }
    async recordMatchResponded(userId, matchId, response, otherName) {
        const verb = response === 'ACCEPTED' ? 'accepted' : 'declined';
        const title = otherName ? `You ${verb} match with ${otherName}` : `You ${verb} a match`;
        await this.record(userId, `MATCH_${response}`, title, { matchId });
    }
    async recordIntroSent(userId, otherName, matchId) {
        await this.record(userId, 'INTRO_SENT', `Introduction sent — You and ${otherName} are now connected`, matchId ? { matchId } : undefined);
    }
    async recordInviteUsed(userId, inviteeName) {
        await this.record(userId, 'INVITE_USED', `${inviteeName} joined Cleya using your invite code`);
    }
    async recordProfileUpdated(userId, changedFields) {
        if (!changedFields.length)
            return;
        const summary = changedFields.length <= 3
            ? changedFields.join(', ')
            : `${changedFields.slice(0, 3).join(', ')} +${changedFields.length - 3} more`;
        await this.record(userId, 'PROFILE_UPDATED', `Profile updated (${summary})`, { fields: changedFields });
    }
    async recordConversationStarted(userId, flowId, conversationId) {
        await this.record(userId, 'CONVERSATION_STARTED', `Started ${flowId}`, { flowId, conversationId });
    }
    async recordConversationCompleted(userId, flowId, conversationId) {
        await this.record(userId, 'CONVERSATION_COMPLETED', `Completed ${flowId}`, { flowId, conversationId });
    }
}
exports.ActivityService = ActivityService;
exports.activityService = new ActivityService();
//# sourceMappingURL=activityService.js.map