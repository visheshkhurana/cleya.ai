import { prisma } from '@cleya/db';
import { createAIService } from '@cleya/ai';
import { env } from '../../config/env';

export class CallService {
  private ai = createAIService();

  async initiateCall(userId: string, phoneNumber: string) {
    console.warn('Voice calls not available — use WhatsApp via Gupshup instead');
    return null;
  }

  // Generate TwiML for AI conversation
  generateTwiML(callId: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">
    Hi! This is Cleya, your AI networking assistant.
    Thanks for taking this call. I'd love to learn a bit more about you
    so I can find you amazing connections.
  </Say>
  <Gather input="speech" timeout="5" speechTimeout="auto"
    action="${env.BACKEND_URL}/api/calls/gather/${callId}" method="POST">
    <Say voice="Polly.Amy">
      Tell me about what you're working on right now and what kind of people you'd love to meet.
    </Say>
  </Gather>
  <Say voice="Polly.Amy">
    I didn't catch that. No worries, you can always update your profile in the app.
    Thanks for your time!
  </Say>
</Response>`;
  }

  // Process speech input during call
  async processGatherInput(callId: string, speechResult: string, confidence: number) {
    // Store transcript segment
    const call = await prisma.call.findUnique({ where: { id: callId } });
    if (!call) return;

    const existingTranscript = (call.transcript as any) || { segments: [] };
    existingTranscript.segments.push({
      speaker: 'user',
      text: speechResult,
      timestamp: Date.now(),
    });

    // Use AI to extract structured data from speech
    const extracted = await this.extractDataFromSpeech(speechResult);

    const existingExtracted = (call.extractedData as any) || {};
    const mergedExtracted = { ...existingExtracted, ...extracted };

    await prisma.call.update({
      where: { id: callId },
      data: {
        transcript: existingTranscript,
        extractedData: mergedExtracted,
      },
    });

    // Generate AI follow-up response
    const followUp = await this.generateFollowUp(existingTranscript.segments);

    return {
      twiml: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${followUp}</Say>
  <Gather input="speech" timeout="5" speechTimeout="auto"
    action="${env.BACKEND_URL}/api/calls/gather/${callId}" method="POST">
    <Say voice="Polly.Amy">Is there anything else you'd like to share?</Say>
  </Gather>
  <Say voice="Polly.Amy">
    Great talking with you! I'll use this to find you the best matches.
    Check the app for updates. Bye!
  </Say>
</Response>`,
      extractedData: mergedExtracted,
    };
  }

  // Handle call status updates
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

    // If completed, update user profile with extracted data
    if (status === 'completed') {
      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (call?.extractedData) {
        // Profile update from call data would happen here
        console.log(`📞 Call ${callId} completed. Extracted data stored.`);
      }
    }
  }

  private async extractDataFromSpeech(text: string): Promise<Record<string, any>> {
    try {
      return await this.ai.chatJSON([
        {
          role: 'system',
          content: `Extract structured profile data from this speech transcript.
Return JSON with any of these fields you can identify:
{ "interests": [], "skills": [], "industries": [], "lookingFor": [], "companyName": "", "currentRole": "", "headline": "" }
Only include fields that are clearly mentioned.`,
        },
        { role: 'user', content: text },
      ]);
    } catch {
      return {};
    }
  }

  private async generateFollowUp(segments: any[]): Promise<string> {
    try {
      const response = await this.ai.chat([
        {
          role: 'system',
          content: `You are Cleya, a warm and conversational AI networking assistant on a phone call.
Generate a brief (1-2 sentence) follow-up response to what the user just said.
Be encouraging, ask a relevant follow-up question about their professional goals.
Keep it natural and conversational.`,
        },
        {
          role: 'user',
          content: segments.map((s: any) => `${s.speaker}: ${s.text}`).join('\n'),
        },
      ]);
      return response.content;
    } catch {
      return "That sounds great! I'm getting a good picture of what you're looking for.";
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
