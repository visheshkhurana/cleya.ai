import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '@cleya/db';
import { authenticate, requireAdmin } from '../middleware/auth';
import { matchingService } from '../services/matchingService';
import { matchScheduler } from '../services/matchScheduler';
import { slackService } from '../services/slackService';
import { messagingService } from '../services/messagingService';
import { automationService } from '../services/automationService';
import { emailService } from '../services/email';
import { whatsappTemplates } from '../services/whatsappTemplates';
import { gupshupService } from '../services/gupshupService';

export const adminRouter = Router();

adminRouter.post('/verify-token', (req: Request, res: Response) => {
  const { token } = req.body;
  const adminToken = process.env.ADMIN_SECRET_TOKEN;
  if (!adminToken || token !== adminToken) {
    res.status(403).json({ error: 'Invalid token' });
    return;
  }
  res.json({ success: true });
});

adminRouter.use(authenticate, requireAdmin);

adminRouter.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalUsers, activeConversations, completedProfiles, totalMatches, acceptedMatches, totalCalls, totalMessages] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count({ where: { status: 'ACTIVE' } }),
      prisma.profile.count({ where: { isComplete: true } }),
      prisma.match.count(),
      prisma.match.count({ where: { status: 'ACCEPTED' } }),
      prisma.call.count(),
      prisma.messageRecord.count(),
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeConversations,
        completedProfiles,
        totalMatches,
        acceptedMatches,
        matchAcceptRate: totalMatches > 0 ? Math.round((acceptedMatches / totalMatches) * 100) : 0,
        totalCalls,
        totalMessages,
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count(),
    ]);

    res.json({
      success: true,
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt,
        profile: u.profile,
      })),
      meta: { page, limit, total },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/matches', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matches = await prisma.match.findMany({
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/funnel', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [signups, startedOnboarding, completedOnboarding, profilesComplete, firstMatch, acceptedMatch] = await Promise.all([
      prisma.user.count(),
      prisma.conversation.count({ where: { flowId: 'onboarding_v1' } }),
      prisma.conversation.count({ where: { flowId: 'onboarding_v1', status: 'COMPLETED' } }),
      prisma.profile.count({ where: { isComplete: true } }),
      prisma.match.count(),
      prisma.match.count({ where: { status: 'ACCEPTED' } }),
    ]);

    res.json({
      success: true,
      data: {
        funnel: [
          { stage: 'Signed Up', count: signups },
          { stage: 'Started Onboarding', count: startedOnboarding },
          { stage: 'Completed Onboarding', count: completedOnboarding },
          { stage: 'Profile Complete', count: profilesComplete },
          { stage: 'Got First Match', count: firstMatch },
          { stage: 'Accepted Match', count: acceptedMatch },
        ],
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/calls', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const calls = await prisma.call.findMany({
      include: { user: { select: { email: true, phone: true, profile: { select: { currentRole: true, companyName: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({ success: true, data: calls });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messages = await messagingService.getAllMessages(50);
    const stats = await messagingService.getMessageStats();
    res.json({ success: true, data: { messages, stats } });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/communications', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [calls, messages, messageStats] = await Promise.all([
      prisma.call.findMany({
        include: { user: { select: { email: true, phone: true, profile: { select: { currentRole: true, companyName: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.messageRecord.findMany({
        include: { user: { select: { email: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      messagingService.getMessageStats(),
    ]);

    const callStats = {
      total: await prisma.call.count(),
      completed: await prisma.call.count({ where: { status: 'COMPLETED' } }),
      failed: await prisma.call.count({ where: { status: 'FAILED' } }),
      inProgress: await prisma.call.count({ where: { status: 'IN_PROGRESS' } }),
    };

    res.json({
      success: true,
      data: { calls, messages, callStats, messageStats },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/trigger/call/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: { message: 'phoneNumber is required', code: 'MISSING_PHONE' },
      });
    }
    const result = await automationService.triggerCallForUser(req.params.userId, phoneNumber);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/trigger/message/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber, channel, message } = req.body;
    if (!phoneNumber || !channel || !message) {
      return res.status(400).json({
        success: false,
        error: { message: 'phoneNumber, channel, and message are required', code: 'MISSING_FIELDS' },
      });
    }
    const result = await automationService.triggerMessageForUser(req.params.userId, phoneNumber, channel, message);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/match/run/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matches = await matchingService.findMatchesForUser(req.params.userId);
    res.json({ success: true, data: matches });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/analytics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalUsers, completedProfiles, totalMatches, acceptedMatches,
      rejectedMatches, totalCalls, totalMessages, totalFeedbacks,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.profile.count({ where: { isComplete: true, user: { role: 'USER' } } }),
      prisma.match.count(),
      prisma.match.count({ where: { status: 'ACCEPTED' } }),
      prisma.match.count({ where: { status: 'REJECTED' } }),
      prisma.call.count(),
      prisma.messageRecord.count(),
      prisma.matchFeedback.count(),
    ]);

    const personaBreakdown = await prisma.profile.groupBy({
      by: ['persona'],
      _count: { persona: true },
      where: { persona: { not: null } },
    });

    const avgScore = await prisma.match.aggregate({ _avg: { score: true } });

    const avgRating = await prisma.matchFeedback.aggregate({ _avg: { rating: true } });

    const ratingDist = await prisma.matchFeedback.groupBy({
      by: ['rating'],
      _count: { rating: true },
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentSignups = await prisma.user.count({
      where: { createdAt: { gte: sevenDaysAgo }, role: 'USER' },
    });

    const dailySignups: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const count = await prisma.user.count({
        where: { createdAt: { gte: start, lt: end }, role: 'USER' },
      });
      dailySignups.push({ date: start.toISOString().split('T')[0], count });
    }

    const channelBreakdown = await prisma.messageRecord.groupBy({
      by: ['channel'],
      _count: { channel: true },
    });

    const attributionBreakdown = await prisma.profile.groupBy({
      by: ['channelSource'],
      _count: { channelSource: true },
      where: { channelSource: { not: null } },
    });

    const topMatchedPersonas = await prisma.$queryRaw`
      SELECT p.persona, COUNT(*)::int as match_count
      FROM matches m
      JOIN profiles p ON (p."userId" = m."userAId" OR p."userId" = m."userBId")
      WHERE p.persona IS NOT NULL
      GROUP BY p.persona
      ORDER BY match_count DESC
      LIMIT 10
    ` as any[];

    const recentActivity = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { user: { select: { email: true } } },
    });

    const startedOnboarding = await prisma.conversation.count({ where: { flowId: 'onboarding_v1' } });

    res.json({
      success: true,
      data: {
        totalUsers,
        completedProfiles,
        onboardingRate: totalUsers > 0 ? Math.round((completedProfiles / totalUsers) * 100) : 0,
        startedOnboarding,
        totalMatches,
        acceptedMatches,
        rejectedMatches,
        matchAcceptRate: totalMatches > 0 ? Math.round((acceptedMatches / totalMatches) * 100) : 0,
        avgMatchScore: Math.round((avgScore._avg.score || 0) * 100),
        totalCalls,
        totalMessages,
        recentSignups,
        dailySignups,
        personaBreakdown: personaBreakdown.map((p) => ({
          persona: p.persona,
          count: p._count.persona,
        })),
        channelBreakdown: channelBreakdown.map((c) => ({
          channel: c.channel,
          count: c._count.channel,
        })),
        topMatchedPersonas,
        attributionBreakdown: attributionBreakdown.map((a) => ({
          source: a.channelSource,
          count: a._count.channelSource,
        })),
        feedbackStats: {
          total: totalFeedbacks,
          avgRating: Math.round((avgRating._avg.rating || 0) * 10) / 10,
          distribution: ratingDist.map((r) => ({ rating: r.rating, count: r._count.rating })),
        },
        recentActivity: recentActivity.map((n) => ({
          id: n.id,
          type: n.event,
          title: n.title,
          body: n.body,
          email: (n as any).user?.email,
          createdAt: n.createdAt,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/send-digest', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await emailService.sendDigestToAll();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/test-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, type } = req.body;
    if (!to) return res.status(400).json({ success: false, error: 'Missing "to" email address' });

    const emailType = type || 'welcome';

    switch (emailType) {
      case 'welcome':
        await emailService.sendWelcome(to);
        break;
      case 'verification':
        await emailService.sendEmailVerification(to, 'test-token-123');
        break;
      case 'password-reset':
        await emailService.sendPasswordReset(to, 'test-token-456');
        break;
      case 'match-proposed':
        await emailService.sendMatchProposed(to, 'You', 'Kartik Dixit', 'Founder', 0.92, {
          companyName: 'Skand Industries',
          raiseAmount: '$2M Seed',
          sector: 'Defense Tech',
          traction: 'Already has a Letter of Intent with India\'s BSF and an active pilot invitation from the Armenian Border Guard.',
          linkedinUrl: 'https://www.linkedin.com/in/example',
          matchReason: 'Feels aligned with your focus on backing repeat founders early.',
        });
        break;
      case 'match-accepted':
        await emailService.sendMatchAccepted(to, 'You', 'Kartik Dixit', 'Founder · Defense Tech', 'kartik@example.com', 'https://www.linkedin.com/in/example');
        break;
      default:
        return res.status(400).json({ success: false, error: `Unknown email type: ${emailType}` });
    }

    res.json({ success: true, message: `Test "${emailType}" email sent to ${to}` });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/whatsapp/templates', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = whatsappTemplates.getAllTemplates();
    const provider = messagingService.getActiveProvider();
    res.json({
      success: true,
      data: {
        provider,
        templates: templates.map(t => ({
          id: t.id,
          name: t.name,
          description: t.description,
          gupshupTemplateId: t.gupshupTemplateId,
          sampleMessage: t.buildMessage({
            name: 'Rahul',
            matchName: 'Priya Sharma',
            matchRole: 'VC Partner',
            matchCompany: 'Sequoia Capital',
            matchScore: '94',
            introName: 'Vikram Singh',
            introRole: 'CTO at Razorpay',
            meetingTitle: 'Coffee Chat',
            withName: 'Ananya Patel',
            proposedTime: 'Tomorrow at 3:00 PM IST',
            confirmedTime: 'Mar 31, 2026 at 3:00 PM IST',
            location: 'Google Meet',
            eventName: 'Pitch by Deel',
            eventDate: 'Apr 15, 2026',
            completionPct: '40',
            newMatches: '3',
            introsSent: '2',
            meetingsScheduled: '1',
            pendingMatches: '5',
          }),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/whatsapp/send-template', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, phoneNumber, templateId, params } = req.body;

    if (!templateId) {
      return res.status(400).json({ success: false, error: { message: 'templateId is required' } });
    }
    if (!userId && !phoneNumber) {
      return res.status(400).json({ success: false, error: { message: 'userId or phoneNumber is required' } });
    }

    const template = whatsappTemplates.getTemplate(templateId);
    if (!template) {
      return res.status(404).json({ success: false, error: { message: `Template '${templateId}' not found` } });
    }

    const result = await whatsappTemplates.sendTemplate(
      userId || 'admin',
      phoneNumber || '',
      templateId,
      params || {}
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/whatsapp/trigger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trigger, userId, params } = req.body;

    if (!trigger || !userId) {
      return res.status(400).json({ success: false, error: { message: 'trigger and userId are required' } });
    }

    let result;
    switch (trigger) {
      case 'welcome':
        result = await whatsappTemplates.triggerWelcome(userId);
        break;
      case 'match_found':
        if (!params?.matchUserId) return res.status(400).json({ success: false, error: { message: 'params.matchUserId required' } });
        result = await whatsappTemplates.triggerMatchFound(userId, params.matchUserId, params.matchScore);
        break;
      case 'match_accepted':
        if (!params?.matchUserId) return res.status(400).json({ success: false, error: { message: 'params.matchUserId required' } });
        result = await whatsappTemplates.triggerMatchAccepted(userId, params.matchUserId);
        break;
      case 'intro_sent':
        result = await whatsappTemplates.triggerIntroSent(userId, params?.introName || 'Someone', params?.introRole);
        break;
      case 'intro_accepted':
        result = await whatsappTemplates.triggerIntroAccepted(userId, params?.introName || 'Someone');
        break;
      case 'meeting_scheduled':
        result = await whatsappTemplates.triggerMeetingScheduled(userId, params?.meetingTitle || 'Meeting', params?.withName || 'Someone', params?.proposedTime);
        break;
      case 'meeting_confirmed':
        result = await whatsappTemplates.triggerMeetingConfirmed(userId, params?.meetingTitle || 'Meeting', params?.withName || 'Someone', params?.confirmedTime || 'TBD', params?.location);
        break;
      case 'meeting_reminder':
        result = await whatsappTemplates.triggerMeetingReminder(userId, params?.meetingTitle || 'Meeting', params?.withName || 'Someone', params?.timeUntil || '1 hour', params?.location, params?.meetingLink);
        break;
      case 'profile_incomplete':
        result = await whatsappTemplates.triggerProfileIncomplete(userId, params?.completionPct || 0);
        break;
      case 'event_registration':
        result = await whatsappTemplates.triggerEventRegistration(userId, params?.eventName || 'Event', params?.eventDate || 'TBD', params?.eventLocation);
        break;
      case 'follow_up':
        result = await whatsappTemplates.triggerFollowUp(userId);
        break;
      case 'weekly_digest':
        result = await whatsappTemplates.triggerWeeklyDigest(userId, params || { newMatches: 0, introsSent: 0, meetingsScheduled: 0 });
        break;
      default:
        return res.status(400).json({ success: false, error: { message: `Unknown trigger: ${trigger}` } });
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/whatsapp/broadcast', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { templateId, params, userFilter } = req.body;

    if (!templateId) {
      return res.status(400).json({ success: false, error: { message: 'templateId is required' } });
    }

    const where: any = { phone: { not: null } };
    if (userFilter?.persona) where.profile = { persona: userFilter.persona };
    if (userFilter?.role) where.role = userFilter.role;

    const users = await prisma.user.findMany({
      where,
      select: { id: true, phone: true, name: true, email: true },
      take: userFilter?.limit || 100,
    });

    const results = { sent: 0, failed: 0, skipped: 0, total: users.length };

    for (const user of users) {
      if (!user.phone) { results.skipped++; continue; }
      try {
        const result = await whatsappTemplates.sendTemplate(user.id, user.phone, templateId, {
          name: user.name || user.email.split('@')[0],
          ...params,
        });
        if (!result || result.status === 'FAILED') {
          results.failed++;
        } else {
          results.sent++;
        }
      } catch {
        results.failed++;
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/whatsapp/register-templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templatesToRegister = [
      {
        elementName: 'cleya_welcome',
        languageCode: 'en',
        category: 'UTILITY',
        templateType: 'TEXT',
        content: "Welcome to Cleya.ai! 🎉 We're excited to help you connect with the right people. You'll receive networking updates and introductions here.",
        example: "Welcome to Cleya.ai! 🎉 We're excited to help you connect with the right people. You'll receive networking updates and introductions here.",
      },
      {
        elementName: 'cleya_introduction',
        languageCode: 'en',
        category: 'UTILITY',
        templateType: 'TEXT',
        content: 'Hi {{1}}! Cleya.ai has found a great connection for you. {{2}} would love to connect. Reply to start the conversation!',
        example: 'Hi [Rahul]! Cleya.ai has found a great connection for you. [Priya from Sequoia] would love to connect. Reply to start the conversation!',
      },
      {
        elementName: 'cleya_meeting_reminder',
        languageCode: 'en',
        category: 'UTILITY',
        templateType: 'TEXT',
        content: 'Reminder: You have a meeting scheduled {{1}}. {{2}}',
        example: 'Reminder: You have a meeting scheduled [tomorrow at 3 PM]. [Coffee chat with Ananya Patel at Starbucks Koramangala]',
      },
      {
        elementName: 'cleya_followup',
        languageCode: 'en',
        category: 'UTILITY',
        templateType: 'TEXT',
        content: "Hi {{1}}! How was your meeting? We'd love to hear your feedback. Reply with your thoughts!",
        example: "Hi [Rahul]! How was your meeting? We'd love to hear your feedback. Reply with your thoughts!",
      },
      {
        elementName: 'cleya_reengagement',
        languageCode: 'en',
        category: 'MARKETING',
        templateType: 'TEXT',
        content: "Hi {{1}}! It's been a while since we connected. Cleya.ai has new networking opportunities waiting for you. Tap to explore!",
        example: "Hi [Rahul]! It's been a while since we connected. Cleya.ai has new networking opportunities waiting for you. Tap to explore!",
      },
    ];

    const results = [];
    for (const t of templatesToRegister) {
      const result = await gupshupService.registerTemplate(
        t.elementName,
        t.languageCode,
        t.category,
        t.templateType,
        t.content,
        t.example
      );
      results.push({ template: t.elementName, ...result });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/whatsapp/gupshup-templates', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await gupshupService.listTemplates();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/batch-matching', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await matchScheduler.runBatchMatching();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/slack/daily-report', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await slackService.sendDailyReport();
    res.json({ success: true, message: 'Daily report sent to Slack' });
  } catch (error) {
    next(error);
  }
});
