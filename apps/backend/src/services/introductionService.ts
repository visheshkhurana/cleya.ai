import { prisma } from '@boardy/db';
import { createAIService } from '@boardy/ai';
import { messagingService } from './messagingService';

export class IntroductionService {
  private ai = createAIService();

  async sendIntroduction(matchId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
    });

    if (!match || match.status !== 'ACCEPTED') return;

    const userA = match.userA;
    const userB = match.userB;
    if (!userA?.profile || !userB?.profile) return;

    const introText = await this.generateIntroMessage(
      userA.profile,
      userB.profile,
      match.reason || ''
    );

    const introForA = `🤝 *Cleo Introduction*\n\nHey! Great news — your match with ${userB.profile.currentRole || 'a professional'} at ${userB.profile.companyName || 'their company'} is confirmed!\n\n${introText}\n\n📧 ${userB.email}${userB.profile.linkedinUrl ? `\n🔗 ${userB.profile.linkedinUrl}` : ''}\n\nReach out and mention Cleo made the intro!`;

    const introForB = `🤝 *Cleo Introduction*\n\nHey! Great news — your match with ${userA.profile.currentRole || 'a professional'} at ${userA.profile.companyName || 'their company'} is confirmed!\n\n${introText}\n\n📧 ${userA.email}${userA.profile.linkedinUrl ? `\n🔗 ${userA.profile.linkedinUrl}` : ''}\n\nReach out and mention Cleo made the intro!`;

    const sendToUser = async (userId: string, phone: string | null, message: string) => {
      if (!phone) return;
      try {
        await messagingService.sendWhatsApp(userId, phone, message);
      } catch {
        try {
          await messagingService.sendSMS(userId, phone, message);
        } catch (e) {
          console.log(`[IntroService] Could not send intro to ${userId}:`, e);
        }
      }
    };

    await Promise.allSettled([
      sendToUser(userA.id, userA.phone, introForA),
      sendToUser(userB.id, userB.phone, introForB),
    ]);

    try {
      await prisma.notification.createMany({
        data: [
          {
            userId: userA.id,
            event: 'INTRO_ACCEPTED',
            channel: 'IN_APP',
            title: 'Introduction Sent!',
            body: `You've been introduced to ${userB.profile.currentRole} at ${userB.profile.companyName}. Check your messages!`,
          },
          {
            userId: userB.id,
            event: 'INTRO_ACCEPTED',
            channel: 'IN_APP',
            title: 'Introduction Sent!',
            body: `You've been introduced to ${userA.profile.currentRole} at ${userA.profile.companyName}. Check your messages!`,
          },
        ],
      });
    } catch (e) {
      console.log('[IntroService] Notification creation failed:', e);
    }

    console.log(`[IntroService] Introduction sent for match ${matchId}`);
  }

  private async generateIntroMessage(
    profileA: any,
    profileB: any,
    reason: string
  ): Promise<string> {
    try {
      const response = await this.ai.chat([
        {
          role: 'system',
          content:
            'You write warm, professional introduction messages for networking matches. Keep it to 2-3 sentences. Be specific about the synergy. Do not include greetings or sign-offs.',
        },
        {
          role: 'user',
          content: `Write a brief intro blurb for a match between:
Person A: ${profileA.persona} — ${profileA.headline || profileA.currentRole || ''} at ${profileA.companyName || ''}. Industries: ${profileA.industries?.join(', ') || 'N/A'}
Person B: ${profileB.persona} — ${profileB.headline || profileB.currentRole || ''} at ${profileB.companyName || ''}. Industries: ${profileB.industries?.join(', ') || 'N/A'}
Match reason: ${reason}`,
        },
      ]);
      return response.content;
    } catch {
      return reason || 'Both of you share complementary backgrounds that could lead to a valuable connection.';
    }
  }
}

export const introductionService = new IntroductionService();
