"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callService = exports.CallService = void 0;
const db_1 = require("@cleya/db");
const ai_1 = require("@cleya/ai");
class CallService {
    ai = (0, ai_1.createAIService)();
    async initiateCall(userId, phoneNumber) {
        console.warn('Voice calls not available — use WhatsApp via Gupshup instead');
        return null;
    }
    async updateCallStatus(callId, status, duration) {
        const statusMap = {
            completed: 'COMPLETED',
            failed: 'FAILED',
            'no-answer': 'NO_ANSWER',
            busy: 'NO_ANSWER',
        };
        const dbStatus = statusMap[status] || 'IN_PROGRESS';
        await db_1.prisma.call.update({
            where: { id: callId },
            data: {
                status: dbStatus,
                duration,
                endedAt: ['completed', 'failed', 'no-answer', 'busy'].includes(status)
                    ? new Date()
                    : undefined,
            },
        });
        if (status === 'completed') {
            const call = await db_1.prisma.call.findUnique({ where: { id: callId } });
            if (call?.extractedData) {
                console.log(`Call ${callId} completed. Extracted data stored.`);
            }
        }
    }
    async getCallHistory(userId) {
        return db_1.prisma.call.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
}
exports.CallService = CallService;
exports.callService = new CallService();
//# sourceMappingURL=callService.js.map