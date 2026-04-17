"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.introductionService = exports.IntroductionService = void 0;
const db_1 = require("@cleya/db");
const ai_1 = require("@cleya/ai");
const messagingService_1 = require("./messagingService");
const activityService_1 = require("./activityService");
const email_1 = require("./email");
class IntroductionService {
    ai = (0, ai_1.createAIService)();
    async generateIntroduction(matchId) {
        const match = await db_1.prisma.match.findUnique({
            where: { id: matchId },
            include: {
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
        });
        if (!match || match.status !== 'ACCEPTED')
            return null;
        const userA = match.userA;
        const userB = match.userB;
        if (!userA?.profile || !userB?.profile)
            return null;
        const introText = await this.generateWarmIntro(userA, userB, match.reason || '');
        const talkingPoints = await this.generateTalkingPoints(userA.profile, userB.profile, match.reason || '');
        const intro = await db_1.prisma.introductionRecord.upsert({
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
            await db_1.prisma.notification.createMany({
                data: [
                    {
                        userId: userA.id,
                        event: 'INTRO_PENDING',
                        channel: 'IN_APP',
                        title: "It's a match! Review your introduction",
                        body: `Both you and ${userB.profile.currentRole || userB.name || 'your match'} want to connect. Review the introduction before it's sent.`,
                    },
                    {
                        userId: userB.id,
                        event: 'INTRO_PENDING',
                        channel: 'IN_APP',
                        title: "It's a match! Review your introduction",
                        body: `Both you and ${userA.profile.currentRole || userA.name || 'your match'} want to connect. Review the introduction before it's sent.`,
                    },
                ],
            });
        }
        catch (e) {
            console.log('[IntroService] Notification creation failed:', e);
        }
        const sendNotify = async (userId, phone, otherName) => {
            if (!phone)
                return;
            const msg = `✅ It's a match! Both you and ${otherName} want to connect.\n\nI've drafted a warm introduction for you two. Please review it before I send.\n\nReview it on your Introductions page.`;
            try {
                await messagingService_1.messagingService.sendWhatsApp(userId, phone, msg);
            }
            catch {
                try {
                    await messagingService_1.messagingService.sendSMS(userId, phone, msg);
                }
                catch { }
            }
        };
        await Promise.allSettled([
            sendNotify(userA.id, userA.phone, userB.profile.currentRole || userB.name || 'your match'),
            sendNotify(userB.id, userB.phone, userA.profile.currentRole || userA.name || 'your match'),
        ]);
        console.log(`[IntroService] Introduction generated (PENDING_APPROVAL) for match ${matchId}`);
        return intro;
    }
    async approveAndSend(introId) {
        const existing = await db_1.prisma.introductionRecord.findUnique({
            where: { id: introId },
            select: { userAId: true, userBId: true, status: true },
        });
        if (!existing)
            return null;
        const blocked = await db_1.prisma.blockedUser.findFirst({
            where: {
                OR: [
                    { blockerId: existing.userAId, blockedId: existing.userBId },
                    { blockerId: existing.userBId, blockedId: existing.userAId },
                ],
            },
            select: { id: true },
        });
        if (blocked) {
            await db_1.prisma.introductionRecord.update({
                where: { id: introId },
                data: { status: 'CANCELLED' },
            }).catch(() => { });
            return null;
        }
        const updated = await db_1.prisma.introductionRecord.updateMany({
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
        if (updated.count === 0)
            return null;
        const intro = await db_1.prisma.introductionRecord.findUnique({
            where: { id: introId },
            include: {
                match: true,
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
        });
        if (!intro || !intro.introText)
            return null;
        const userA = intro.userA;
        const userB = intro.userB;
        const introForA = `🤝 *Cleya Introduction*\n\nGreat news — your introduction has been sent!\n\n${intro.introText}\n\n📧 ${userB.email}${userB.profile?.linkedinUrl ? `\n🔗 ${userB.profile.linkedinUrl}` : ''}\n\n💡 Tip: Reply within 24 hours — first impressions matter!`;
        const introForB = `🤝 *Cleya Introduction*\n\nGreat news — your introduction has been sent!\n\n${intro.introText}\n\n📧 ${userA.email}${userA.profile?.linkedinUrl ? `\n🔗 ${userA.profile.linkedinUrl}` : ''}\n\n💡 Tip: Reply within 24 hours — first impressions matter!`;
        const sendToUser = async (userId, phone, message) => {
            if (!phone)
                return;
            try {
                await messagingService_1.messagingService.sendWhatsApp(userId, phone, message);
            }
            catch {
                try {
                    await messagingService_1.messagingService.sendSMS(userId, phone, message);
                }
                catch { }
            }
        };
        await Promise.allSettled([
            sendToUser(userA.id, userA.phone, introForA),
            sendToUser(userB.id, userB.phone, introForB),
        ]);
        const matchReason = intro.match?.reason || '';
        const profA = userA.profile;
        const profB = userB.profile;
        const nameA = userA.name || profA?.currentRole || userA.email.split('@')[0];
        const nameB = userB.name || profB?.currentRole || userB.email.split('@')[0];
        email_1.emailService.sendIntroductionEmail(userA.email, nameA, nameB, intro.introText, profB?.linkedinUrl || undefined, {
            headline: profB?.headline || profB?.currentRole || undefined,
            companyName: profB?.companyName || undefined,
            sector: profB?.industries?.[0] || undefined,
            location: profB?.location || undefined,
            traction: profB?.keyTractionPoints || undefined,
            matchReason,
            partnerUserId: userB.id,
        }).catch(() => { });
        email_1.emailService.sendIntroductionEmail(userB.email, nameB, nameA, intro.introText, profA?.linkedinUrl || undefined, {
            headline: profA?.headline || profA?.currentRole || undefined,
            companyName: profA?.companyName || undefined,
            sector: profA?.industries?.[0] || undefined,
            location: profA?.location || undefined,
            traction: profA?.keyTractionPoints || undefined,
            matchReason,
            partnerUserId: userA.id,
        }).catch(() => { });
        try {
            await db_1.prisma.notification.createMany({
                data: [
                    {
                        userId: userA.id,
                        event: 'INTRO_ACCEPTED',
                        channel: 'IN_APP',
                        title: 'Introduction Sent!',
                        body: `You've been introduced to ${userB.profile?.currentRole || userB.email}. Check your messages!`,
                    },
                    {
                        userId: userB.id,
                        event: 'INTRO_ACCEPTED',
                        channel: 'IN_APP',
                        title: 'Introduction Sent!',
                        body: `You've been introduced to ${userA.profile?.currentRole || userA.email}. Check your messages!`,
                    },
                ],
            });
        }
        catch { }
        await Promise.allSettled([
            activityService_1.activityService.recordIntroSent(userA.id, userB.profile?.currentRole || userB.email),
            activityService_1.activityService.recordIntroSent(userB.id, userA.profile?.currentRole || userA.email),
        ]);
        console.log(`[IntroService] Introduction SENT for intro ${introId}`);
        return updated;
    }
    async updateIntroText(introId, newText) {
        return db_1.prisma.introductionRecord.update({
            where: { id: introId },
            data: { introText: newText },
        });
    }
    async recordOutcome(introId, outcome, outcomeNotes) {
        const updated = await db_1.prisma.introductionRecord.update({
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
            activityService_1.activityService.record(updated.userAId, 'INTRO_OUTCOME', `You rated your intro as "${outcome.replace(/_/g, ' ').toLowerCase()}"`),
            activityService_1.activityService.record(updated.userBId, 'INTRO_OUTCOME', `Introduction outcome recorded: "${outcome.replace(/_/g, ' ').toLowerCase()}"`),
        ]);
        return updated;
    }
    async autoApproveStaleIntros() {
        const staleIntros = await db_1.prisma.introductionRecord.findMany({
            where: {
                status: 'PENDING_APPROVAL',
                createdAt: { lte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
            },
        });
        for (const intro of staleIntros) {
            try {
                await this.approveAndSend(intro.id);
                console.log(`[IntroService] Auto-approved intro ${intro.id}`);
            }
            catch (e) {
                console.log(`[IntroService] Auto-approve failed for ${intro.id}:`, e);
            }
        }
        return staleIntros.length;
    }
    async sendFollowUps() {
        const dueFollowUps = await db_1.prisma.introductionRecord.findMany({
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
            const sendFollowUp = async (userId, phone, otherName) => {
                if (!phone)
                    return;
                const msg = `👋 Hi! It's been a week since I connected you with ${otherName}. How did it go?\n\nVisit your Introductions page to share feedback.`;
                try {
                    await messagingService_1.messagingService.sendWhatsApp(userId, phone, msg);
                }
                catch {
                    try {
                        await messagingService_1.messagingService.sendSMS(userId, phone, msg);
                    }
                    catch { }
                }
            };
            await Promise.allSettled([
                sendFollowUp(intro.userAId, intro.userA.phone, intro.userB.profile?.currentRole || intro.userB.email),
                sendFollowUp(intro.userBId, intro.userB.phone, intro.userA.profile?.currentRole || intro.userA.email),
            ]);
            await db_1.prisma.introductionRecord.update({
                where: { id: intro.id },
                data: { status: 'FOLLOWED_UP' },
            });
        }
        return dueFollowUps.length;
    }
    async sendIntroduction(matchId) {
        return this.generateIntroduction(matchId);
    }
    async generateTalkingPoints(profileA, profileB, reason) {
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
        }
        catch {
            const points = [];
            const sharedIndustries = (profileA.industries || []).filter((i) => (profileB.industries || []).includes(i));
            const sharedSkills = (profileA.skills || []).filter((s) => (profileB.skills || []).includes(s));
            if (sharedIndustries.length > 0)
                points.push(`You both work in ${sharedIndustries.join(' and ')} — share your perspectives on industry trends.`);
            if (sharedSkills.length > 0)
                points.push(`You share expertise in ${sharedSkills.join(', ')}. Compare approaches and best practices.`);
            if (reason)
                points.push(`The connection was made because: ${reason}`);
            points.push('Discuss your current goals and how you might help each other.');
            if (points.length < 3)
                points.push("Share what you're most excited about working on right now.");
            return points;
        }
    }
    async generateWarmIntro(userA, userB, reason) {
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
- Name: ${userA.name || userA.email.split('@')[0]}
- Title: ${profA.currentRole || 'Professional'} at ${profA.companyName || 'their company'}
- Bio: ${profA.bio || ''}
- Goal: ${profA.lookingFor?.join(', ') || 'networking'}
- Key details: ${profA.keyTractionPoints || profA.investmentThesis || profA.skills?.join(', ') || ''}

Person 2:
- Name: ${userB.name || userB.email.split('@')[0]}
- Title: ${profB.currentRole || 'Professional'} at ${profB.companyName || 'their company'}
- Bio: ${profB.bio || ''}
- Goal: ${profB.lookingFor?.join(', ') || 'networking'}
- Key details: ${profB.keyTractionPoints || profB.investmentThesis || profB.skills?.join(', ') || ''}

Match reason: ${reason}`,
                },
            ]);
            return response.content;
        }
        catch {
            const nameA = userA.name || userA.email.split('@')[0];
            const nameB = userB.name || userB.email.split('@')[0];
            return `Hi ${nameA} and ${nameB},\n\nI'd love to connect you two. ${reason || `Based on your profiles, there's strong potential for a valuable connection.`}\n\nI'll let you two take it from here!\n— Cleya`;
        }
    }
}
exports.IntroductionService = IntroductionService;
exports.introductionService = new IntroductionService();
//# sourceMappingURL=introductionService.js.map