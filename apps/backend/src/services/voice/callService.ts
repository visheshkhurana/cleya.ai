import { prisma } from '@cleya/db';
import { createAIService } from '@cleya/ai';

export class CallService {
  private ai = createAIService();

  async initiateCall(userId: string, phoneNumber: string) {
    console.warn('Voice calls not available — use WhatsApp via Gupshup instead');
    return null;
  }

  async updateCallStatus(callId: string, status: string, duration?: number) {
    const statusMap: Record<string, string> = {
      completed: 'COMPLETED',
      failed: 'FAILED',
      'no-answer': 'NO_ANSWER',
      busy: 'NO_ANSWER',
    };

    const dbStatus = statusMap[status] || 'IN_PROGRESS';

    await prisma.call.update({
      where: { id: callId },
      data: {
        status: dbStatus as any,
        duration,
        endedAt: ['completed', 'failed', 'no-answer', 'busy'].includes(status)
          ? new Date()
          : undefined,
      },
    });

    if (status === 'completed') {
      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (call?.extractedData) {
        console.log(`Call ${callId} completed. Extracted data stored.`);
      }
    }
  }

  async getCallHistory(userId: string) {
    return prisma.call.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const callService = new CallService();
