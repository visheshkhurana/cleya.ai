import { prisma } from '@cleya/db';
import { createAIService } from '@cleya/ai';
import { messagingService } from './messagingService';
import { activityService } from './activityService';
import { emailService } from './email';
import { safeDisplayName, safeFirstName } from '../utils/displayName';

export class IntroductionService {
  private ai = createAIService();

  async generateIntroduction(matchId: string) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
    });

    if (!match || match.status !== 'ACCEPTED') return null;

    const userA = match.userA;
    const userB = match.userB;
    if (!userA?.profile || !userB?.profile) return null;

    const introText = await this.generateWarmIntro(userA, userB, match.reason || '');
    const talkingPoints = await this.generateTalkingPoints(userA.profile, userB.profile, match.reason || '');

    const intro = await prisma.introductionRecord.upsert({
      where: { matchId },
      update: { introText, talkingPoints },
      create: {
        matchId,
        userAId: userA.id,
        userBId: userB.id,
        status: 'PENDING_APPROVAL',
        introText,
        talkingPoints,
      },
    });

    try {
      await prisma.notification.createMany({
        data: [
          {
            userId: userA.id,
            event: 'INTRO_PENDING',
            channel: 'IN_APP',
            title: "It's a match! Review your introduction",
            body: `Both you and ${safeDisplayName(userB)} want to connect. Review the introduction before it's sent.`,
          },
          {
            userId: userB.id,
            event: 'INTRO_PENDING',
            channel: 'IN_APP',
            title: "It's a match! Review your introduction",
            body: `Both you and ${safeDisplayName(userA)} want to connect. Review the introduction before it's sent.`,
          },
        ],
      });
    } catch (e) {
      console.log('[IntroService] Notification creation failed:', e);
    }

    const sendNotify = async (userId: string, phone: string | null, otherName: string) => {
      if (!phone) return;
      const msg = `✅ It's a match! Both you and ${otherName} want to connect.\n\nI've drafted a warm introduction for you two. Please review it before I send.\n\nReview it on your Introductions page.`;
      try {
        await messagingService.sendWhatsApp(userId, phone, msg);
      } catch {
        try { await messagingService.sendSMS(userId, phone, msg); } catch {}
      }
    };

    await Promise.allSettled([
      sendNotify(userA.id, userA.phone, safeDisplayName(userB)),
      sendNotify(userB.id, userB.phone, safeDisplayName(userA)),
    ]);

    console.log(`[IntroService] Introduction generated (PENDING_APPROVAL) for match ${matchId}`);
    return intro;
  }

  async approveAndSend(introId: string) {
    const existing = await prisma.introductionRecord.findUnique({
      where: { id: introId },
      select: { userAId: true, userBId: true, status: true },
    });
    if (!existing) return null;

    const blocked = await prisma.blockedUser.findFirst({
      where: {
        OR: [
          { blockerId: existing.userAId, blockedId: existing.userBId },
          { blockerId: existing.userBId, blockedId: existing.userAId },
        ],
      },
      select: { id: true },
    });
    if (blocked) {
      await prisma.introductionRecord.update({
        where: { id: introId },
        data: { status: 'CANCELLED' },
      }).catch(() => {});
      return null;
    }

    const updated = await prisma.introductionRecord.updateMany({
      where: {
        id: introId,
        status: { in: ['PENDING_APPROVAL', 'APPROVED'] },
      },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        followUpAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    if (updated.count === 0) return null;

    const intro = await prisma.introductionRecord.findUnique({
      where: { id: introId },
      include: {
        match: true,
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
    });

    if (!intro || !intro.introText) return null;

    const userA = intro.userA;
    const userB = intro.userB;

    const introForA = `🤝 *Cleya Introduction*\n\nGreat news — your introduction has been sent!\n\n${intro.introText}\n\n📧 ${userB.email}${userB.profile?.linkedinUrl ? `\n🔗 ${userB.profile.linkedinUrl}` : ''}\n\n💡 Tip: Reply within 24 hours — first impressions matter!`;
    const introForB = `🤝 *Cleya Introduction*\n\nGreat news — your introduction has been sent!\n\n${intro.introText}\n\n📧 ${userA.email}${userA.profile?.linkedinUrl ? `\n🔗 ${userA.profile.linkedinUrl}` : ''}\n\n💡 Tip: Reply within 24 hours — first impressions matter!`;

    const sendToUser = async (userId: string, phone: string | null, message: string) => {
      if (!phone) return;
      try {
        await messagingService.sendWhatsApp(userId, phone, message);
      } catch {
        try { await messagingService.sendSMS(userId, phone, message); } catch {}
      }
    };

    await Promise.allSettled([
      sendToUser(userA.id, userA.phone, introForA),
      sendToUser(userB.id, userB.phone, introForB),
    ]);

    const matchReason = intro.match?.reason || '';
    const profA = userA.profile;
    const profB = userB.profile;
    const nameA = safeDisplayName(userA);
    const nameB = safeDisplayName(userB);

    // NOTE: We deliberately do NOT fire the two separate per-recipient
    // sendIntroductionEmail calls anymore. matchingService.revealContacts
    // already sends ONE joint Boardy-style intro email (both parties on To:,
    // single shared thread) the moment the second user accepts. Sending
    // separate emails here would mean each user receives THREE emails for
    // the same match — the joint thread + two private notifications — which
    // is exactly the noise we're trying to avoid. The IntroductionRecord is
    // still marked SENT above so admin tooling and outcome tracking work.
    void emailService; // keep import alive for type checking
    void matchReason; void profA; void profB; void nameA; void nameB;

    try {
      await prisma.notification.createMany({
        data: [
          {
            userId: userA.id,
            event: 'INTRO_ACCEPTED',
            channel: 'IN_APP',
            title: 'Introduction Sent!',
            body: `You've been introduced to ${safeDisplayName(userB)}. Check your messages!`,
          },
          {
            userId: userB.id,
            event: 'INTRO_ACCEPTED',
            channel: 'IN_APP',
            title: 'Introduction Sent!',
            body: `You've been introduced to ${safeDisplayName(userA)}. Check your messages!`,
          },
        ],
      });
    } catch {}

    await Promise.allSettled([
      activityService.recordIntroSent(userA.id, safeDisplayName(userB)),
      activityService.recordIntroSent(userB.id, safeDisplayName(userA)),
    ]);

    console.log(`[IntroService] Introduction SENT for intro ${introId}`);
    return updated;
  }

  async updateIntroText(introId: string, newText: string) {
    return prisma.introductionRecord.update({
      where: { id: introId },
      data: { introText: newText },
    });
  }

  async recordOutcome(introId: string, outcome: string, outcomeNotes?: string) {
    const updated = await prisma.introductionRecord.update({
      where: { id: introId },
      data: {
        outcome,
        outcomeNotes: outcomeNotes || null,
        status: 'COMPLETED',
      },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
    });

    await Promise.allSettled([
      activityService.record(updated.userAId, 'INTRO_OUTCOME', `You rated your intro as "${outcome.replace(/_/g, ' ').toLowerCase()}"`),
      activityService.record(updated.userBId, 'INTRO_OUTCOME', `Introduction outcome recorded: "${outcome.replace(/_/g, ' ').toLowerCase()}"`),
    ]);

    return updated;
  }

  async autoApproveStaleIntros() {
    const staleIntros = await prisma.introductionRecord.findMany({
      where: {
        status: 'PENDING_APPROVAL',
        createdAt: { lte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
    });

    for (const intro of staleIntros) {
      try {
        await this.approveAndSend(intro.id);
        console.log(`[IntroService] Auto-approved intro ${intro.id}`);
      } catch (e) {
        console.log(`[IntroService] Auto-approve failed for ${intro.id}:`, e);
      }
    }

    return staleIntros.length;
  }

  async sendFollowUps() {
    const dueFollowUps = await prisma.introductionRecord.findMany({
      where: {
        status: 'SENT',
        followUpAt: { lte: new Date() },
        outcome: null,
      },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
    });

    for (const intro of dueFollowUps) {
      const sendFollowUp = async (userId: string, phone: string | null, otherName: string) => {
        if (!phone) return;
        const msg = `👋 Hi! It's been a week since I connected you with ${otherName}. How did it go?\n\nVisit your Introductions page to share feedback.`;
        try {
          await messagingService.sendWhatsApp(userId, phone, msg);
        } catch {
          try { await messagingService.sendSMS(userId, phone, msg); } catch {}
        }
      };

      await Promise.allSettled([
        sendFollowUp(intro.userAId, intro.userA.phone, safeDisplayName(intro.userB)),
        sendFollowUp(intro.userBId, intro.userB.phone, safeDisplayName(intro.userA)),
      ]);

      await prisma.introductionRecord.update({
        where: { id: intro.id },
        data: { status: 'FOLLOWED_UP' },
      });
    }

    return dueFollowUps.length;
  }

  async sendIntroduction(matchId: string) {
    return this.generateIntroduction(matchId);
  }

  private async generateTalkingPoints(profileA: any, profileB: any, reason: string): Promise<string[]> {
    try {
      const response = await this.ai.chat([
        {
          role: 'system',
          content: 'Generate 4-5 specific conversation starter talking points for two people who have been matched for professional networking. Return ONLY a JSON array of strings. Each talking point should be 1-2 sentences and reference specific details about both people.',
        },
        {
          role: 'user',
          content: `Person A: ${profileA.persona} — ${profileA.headline || profileA.currentRole || ''} at ${profileA.companyName || ''}. Industries: ${profileA.industries?.join(', ') || 'N/A'}. Skills: ${profileA.skills?.join(', ') || 'N/A'}. Interests: ${profileA.interests?.join(', ') || 'N/A'}.
Person B: ${profileB.persona} — ${profileB.headline || profileB.currentRole || ''} at ${profileB.companyName || ''}. Industries: ${profileB.industries?.join(', ') || 'N/A'}. Skills: ${profileB.skills?.join(', ') || 'N/A'}. Interests: ${profileB.interests?.join(', ') || 'N/A'}.
Match reason: ${reason}`,
        },
      ]);
      const parsed = JSON.parse(response.content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      const points = [];
      const sharedIndustries = (profileA.industries || []).filter((i: string) => (profileB.industries || []).includes(i));
      const sharedSkills = (profileA.skills || []).filter((s: string) => (profileB.skills || []).includes(s));
      if (sharedIndustries.length > 0) points.push(`You both work in ${sharedIndustries.join(' and ')} — share your perspectives on industry trends.`);
      if (sharedSkills.length > 0) points.push(`You share expertise in ${sharedSkills.join(', ')}. Compare approaches and best practices.`);
      if (reason) points.push(`The connection was made because: ${reason}`);
      points.push('Discuss your current goals and how you might help each other.');
      if (points.length < 3) points.push("Share what you're most excited about working on right now.");
      return points;
    }
  }

  private async generateWarmIntro(userA: any, userB: any, reason: string): Promise<string> {
    try {
      const profA = userA.profile;
      const profB = userB.profile;
      const response = await this.ai.chat([
        {
          role: 'system',
          content: `You are Cleya, an AI superconnector for India's startup ecosystem. Write a warm introduction connecting these two professionals. The tone should be warm, specific, and personal — like a well-connected friend making an intro, not a corporate email. Reference specific details from both profiles. Keep it under 120 words. Start with "Hi [First Name 1] and [First Name 2]," and end with "I'll let you two take it from here!\n— Cleya"`,
        },
        {
          role: 'user',
          content: `Person 1:
- Name: ${safeDisplayName(userA)}
- Title: ${profA.currentRole || 'Professional'} at ${profA.companyName || 'their company'}
- Bio: ${profA.bio || ''}
- Goal: ${profA.lookingFor?.join(', ') || 'networking'}
- Key details: ${profA.keyTractionPoints || profA.investmentThesis || profA.skills?.join(', ') || ''}

Person 2:
- Name: ${safeDisplayName(userB)}
- Title: ${profB.currentRole || 'Professional'} at ${profB.companyName || 'their company'}
- Bio: ${profB.bio || ''}
- Goal: ${profB.lookingFor?.join(', ') || 'networking'}
- Key details: ${profB.keyTractionPoints || profB.investmentThesis || profB.skills?.join(', ') || ''}

Match reason: ${reason}`,
        },
      ]);
      return response.content;
    } catch {
      const nameA = safeFirstName(userA);
      const nameB = safeFirstName(userB);
      return `Hi ${nameA} and ${nameB},\n\nI'd love to connect you two. ${reason || `Based on your profiles, there's strong potential for a valuable connection.`}\n\nI'll let you two take it from here!\n— Cleya`;
    }
  }
}

export const introductionService = new IntroductionService();
