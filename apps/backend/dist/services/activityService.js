"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityService = exports.ActivityService = void 0;
const db_1 = require("@cleya/db");
class ActivityService {
    async record(userId, type, title, metadata) {
        try {
            await db_1.prisma.activity.create({
                data: { userId, type, title, metadata },
            });
        }
        catch (e) {
            console.log('[ActivityService] Failed to record activity:', e);
        }
    }
    async recordMatchFound(userId, otherName) {
        await this.record(userId, 'MATCH_FOUND', `New match found — ${otherName}`);
    }
    async recordIntroSent(userId, otherName) {
        await this.record(userId, 'INTRO_SENT', `Introduction sent — You and ${otherName} are now connected`);
    }
    async recordInviteUsed(userId, inviteeName) {
        await this.record(userId, 'INVITE_USED', `${inviteeName} joined Cleya using your invite code`);
    }
}
exports.ActivityService = ActivityService;
exports.activityService = new ActivityService();
//# sourceMappingURL=activityService.js.map