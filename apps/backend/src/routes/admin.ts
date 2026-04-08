import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma, Prisma } from '@cleya/db';
import { authenticate, requireRole, requireReauth } from '../middleware/auth';
import { matchingService } from '../services/matchingService';
import { matchScheduler } from '../services/matchScheduler';
import { slackService } from '../services/slackService';
import { messagingService } from '../services/messagingService';
import { automationService } from '../services/automationService';
import { emailService } from '../services/email';
import { whatsappTemplates } from '../services/whatsappTemplates';
import { gupshupService } from '../services/gupshupService';
import { whatsappBotService } from '../services/whatsappBotService';
import { analyticsAggregatorService } from '../services/analyticsAggregatorService';
import { agentScheduler } from '../services/agentScheduler';
import cronValidator from 'node-cron';
import { runAgent, getAgentStatuses, KNOWN_AGENT_IDS, getAgentRunHistory, getAgentAccountability, updateAgentConfig, resolveAgentId, emergencyStopAllAgents } from '../services/agentRunner';
import { getAllMemories, addShortTermMemory, addLongTermMemory, addEpisodicMemory, addSemanticMemory, deleteShortTermMemory, deleteLongTermMemory, deleteEpisodicMemory, deleteSemanticMemory, setWorkingMemory, clearWorkingMemory } from '../services/agentMemoryService';
import { publishingService } from '../services/publishingService';
import { supabaseSelect } from '../services/supabaseClient';
import { securityLogger } from '../services/securityLogger';
import { logAdminAction, getAuditLogs } from '../services/auditLogger';
import {
  createDecision,
  getDecisions,
  updateDecisionStatus,
  updateDecisionOutcome,
  triggerDebate,
  getDebateEntries,
  generateDailyBriefing,
  getLatestBriefing,
  getPriorityInbox,
} from '../services/founderModeService';

export const adminRouter = Router();

adminRouter.use(authenticate, requireRole('MANAGER'));

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

adminRouter.get('/analytics', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rangeParam = (req.query.range as string) || '7d';
    const days = rangeParam === '90d' ? 90 : rangeParam === '30d' ? 30 : 7;
    const rangeStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalUsers, completedProfiles, totalMatches, acceptedMatches,
      rejectedMatches, totalCalls, totalMessages, totalFeedbacks,
    ] = await Promise.all([
      prisma.user.count({ where: { role: { in: ['USER', 'VIEWER'] } } }),
      prisma.profile.count({ where: { isComplete: true, user: { role: { in: ['USER', 'VIEWER'] } } } }),
      prisma.match.count({ where: { createdAt: { gte: rangeStart } } }),
      prisma.match.count({ where: { status: 'ACCEPTED', createdAt: { gte: rangeStart } } }),
      prisma.match.count({ where: { status: 'REJECTED', createdAt: { gte: rangeStart } } }),
      prisma.call.count({ where: { createdAt: { gte: rangeStart } } }),
      prisma.messageRecord.count({ where: { createdAt: { gte: rangeStart } } }),
      prisma.matchFeedback.count({ where: { createdAt: { gte: rangeStart } } }),
    ]);

    const personaBreakdown = await prisma.profile.groupBy({
      by: ['persona'],
      _count: { persona: true },
      where: { persona: { not: null } },
    });

    const avgScore = await prisma.match.aggregate({
      _avg: { score: true },
      where: { createdAt: { gte: rangeStart } },
    });

    const avgRating = await prisma.matchFeedback.aggregate({
      _avg: { rating: true },
      where: { createdAt: { gte: rangeStart } },
    });

    const ratingDist = await prisma.matchFeedback.groupBy({
      by: ['rating'],
      _count: { rating: true },
      where: { createdAt: { gte: rangeStart } },
    });

    const recentSignups = await prisma.user.count({
      where: { createdAt: { gte: rangeStart }, role: { in: ['USER', 'VIEWER'] } },
    });

    const dailySignups: { date: string; count: number }[] = [];
    const chartDays = Math.min(days, 30);
    for (let i = chartDays - 1; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const count = await prisma.user.count({
        where: { createdAt: { gte: start, lt: end }, role: { in: ['USER', 'VIEWER'] } },
      });
      dailySignups.push({ date: start.toISOString().split('T')[0], count });
    }

    const channelBreakdown = await prisma.messageRecord.groupBy({
      by: ['channel'],
      _count: { channel: true },
      where: { createdAt: { gte: rangeStart } },
    });

    const attributionBreakdown = await prisma.profile.groupBy({
      by: ['channelSource'],
      _count: { channelSource: true },
      where: { channelSource: { not: null } },
    });

    interface TopMatchedPersona {
      persona: string;
      match_count: number;
    }
    const topMatchedPersonas: TopMatchedPersona[] = await prisma.$queryRaw`
      SELECT p.persona, COUNT(*)::int as match_count
      FROM matches m
      JOIN profiles p ON (p."userId" = m."userAId" OR p."userId" = m."userBId")
      WHERE p.persona IS NOT NULL AND m."createdAt" >= ${rangeStart}
      GROUP BY p.persona
      ORDER BY match_count DESC
      LIMIT 10
    `;

    const recentActivity = await prisma.notification.findMany({
      where: { createdAt: { gte: rangeStart } },
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
          email: (n.user as { email?: string } | null)?.email,
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

adminRouter.get('/analytics/overview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateRange = (req.query.range as string) || '30d';
    const validRange = ['7d', '30d', '90d'].includes(dateRange) ? dateRange as '7d' | '30d' | '90d' : '30d';
    const overview = await analyticsAggregatorService.getOverview(validRange);
    res.json({ success: true, data: overview });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/analytics/ga4', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateRange = (req.query.range as string) || '30d';
    const validRange = ['7d', '30d', '90d'].includes(dateRange) ? dateRange as '7d' | '30d' | '90d' : '30d';
    const result = await analyticsAggregatorService.getGA4(validRange);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/analytics/instagram', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateRange = (req.query.range as string) || '30d';
    const validRange = ['7d', '30d', '90d'].includes(dateRange) ? dateRange as '7d' | '30d' | '90d' : '30d';
    const result = await analyticsAggregatorService.getInstagram(validRange);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/analytics/posthog', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateRange = (req.query.range as string) || '30d';
    const validRange = ['7d', '30d', '90d'].includes(dateRange) ? dateRange as '7d' | '30d' | '90d' : '30d';
    const result = await analyticsAggregatorService.getPostHog(validRange);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/analytics/sentry', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateRange = (req.query.range as string) || '30d';
    const validRange = ['7d', '30d', '90d'].includes(dateRange) ? dateRange as '7d' | '30d' | '90d' : '30d';
    const result = await analyticsAggregatorService.getSentry(validRange);
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

adminRouter.get('/whatsapp/diagnostics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = {
      apiKey: !!process.env.GUPSHUP_API_KEY,
      appName: !!process.env.GUPSHUP_APP_NAME,
      sourceNumber: !!process.env.GUPSHUP_SOURCE_NUMBER,
      templateNamespace: !!process.env.GUPSHUP_TEMPLATE_NAMESPACE,
      webhookSecret: !!process.env.GUPSHUP_WEBHOOK_SECRET,
    };

    const isConfigured = config.apiKey && config.appName && config.sourceNumber;

    let apiReachable = false;
    let apiError: string | null = null;
    let templateCount: number | null = null;

    if (isConfigured) {
      try {
        const result = await gupshupService.listTemplates();
        if (result.success) {
          apiReachable = true;
          const data = result.data;
          if (Array.isArray(data)) {
            templateCount = data.length;
          } else if (data?.templates && Array.isArray(data.templates)) {
            templateCount = data.templates.length;
          } else if (data?.status === 'success') {
            apiReachable = true;
          }
        } else {
          apiError = result.error || 'Unknown API error';
        }
      } catch (err: any) {
        apiError = err.message || 'Failed to reach Gupshup API';
      }
    }

    const overallHealth = isConfigured && apiReachable ? 'healthy' : isConfigured ? 'degraded' : 'not_configured';

    res.json({
      success: true,
      data: {
        health: overallHealth,
        config,
        isConfigured,
        apiReachable,
        apiError,
        templateCount,
        sourceNumber: isConfigured ? process.env.GUPSHUP_SOURCE_NUMBER!.replace(/.(?=.{4})/g, '*') : null,
        appName: process.env.GUPSHUP_APP_NAME || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/whatsapp/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: { message: 'phoneNumber is required' } });
    }

    const phoneRegex = /^[\d+\s\-()]{7,20}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({ success: false, error: { message: 'Invalid phone number format' } });
    }

    if (!gupshupService.isConfigured()) {
      return res.status(400).json({
        success: false,
        error: { message: 'Gupshup is not configured. Please set GUPSHUP_API_KEY, GUPSHUP_APP_NAME, and GUPSHUP_SOURCE_NUMBER.' },
      });
    }

    try {
      const connectivityCheck = await gupshupService.listTemplates();
      if (!connectivityCheck.success) {
        return res.status(502).json({
          success: false,
          error: { message: `Gupshup API connectivity check failed: ${connectivityCheck.error || 'Unknown error'}` },
        });
      }
    } catch (connErr: any) {
      return res.status(502).json({
        success: false,
        error: { message: `Gupshup API unreachable: ${connErr.message || 'Connection failed'}` },
      });
    }

    const testMessage = `Hello from Cleya! This is a test message sent from the Control Tower at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. If you received this, your WhatsApp connection is working.`;

    const adminUserId = req.user?.userId || 'system';
    const result = await gupshupService.sendWhatsApp(adminUserId, phoneNumber, testMessage);

    const sendStatus = result?.status || 'UNKNOWN';
    const sendFailed = sendStatus === 'FAILED';

    res.status(sendFailed ? 502 : 200).json({
      success: !sendFailed,
      data: {
        messageId: result?.messageSid || null,
        status: sendStatus,
        errorMessage: result?.errorMessage || null,
        phone: phoneNumber,
        sentAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/whatsapp/test/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const messageId = req.query.messageId as string;
    if (!messageId) {
      return res.status(400).json({ success: false, error: { message: 'messageId is required' } });
    }

    const record = await prisma.messageRecord.findFirst({
      where: { messageSid: messageId },
      select: { status: true, errorMessage: true, updatedAt: true },
    });

    if (!record) {
      return res.status(404).json({ success: false, error: { message: 'Message not found' } });
    }

    res.json({
      success: true,
      data: {
        status: record.status,
        errorMessage: record.errorMessage,
        updatedAt: record.updatedAt,
      },
    });
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

adminRouter.get('/whatsapp/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const data = await whatsappBotService.getWhatsAppActivity(limit);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/whatsapp/users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await whatsappBotService.getWhatsAppUsers();

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/agents/:id/run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    if (!KNOWN_AGENT_IDS.includes(id)) {
      res.status(400).json({ success: false, error: { message: `Unknown agent: ${id}` } });
      return;
    }
    const result = await agentScheduler.executeAgent(id);
    if (result && result.status === 'error') {
      res.status(500).json({ success: false, error: { message: result.error || 'Agent execution failed' }, data: result });
      return;
    }
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/agents/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const scheduleInfo = agentScheduler.getScheduleInfo();
    const statuses = getAgentStatuses(scheduleInfo);
    res.json({ success: true, data: statuses });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/agents/:id/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 30;
    const history = await getAgentRunHistory(id, limit);
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/agents/:id/accountability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const stats = await getAgentAccountability(id);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/agents/:id/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { enabled, cronExpression, cronDescription, autonomyLevel, guardrails } = req.body;

    const resolved = resolveAgentId(id);
    if (!KNOWN_AGENT_IDS.includes(resolved) && !KNOWN_AGENT_IDS.includes(id)) {
      res.status(400).json({ success: false, error: { message: `Unknown agent: ${id}` } });
      return;
    }

    if (cronExpression !== undefined && cronExpression !== null && !cronValidator.validate(cronExpression)) {
      res.status(400).json({ success: false, error: { message: `Invalid cron expression: ${cronExpression}` } });
      return;
    }

    if (autonomyLevel !== undefined && !['manual', 'semi_autonomous', 'autonomous'].includes(autonomyLevel)) {
      res.status(400).json({ success: false, error: { message: `Invalid autonomy level: ${autonomyLevel}` } });
      return;
    }

    if (guardrails !== undefined) {
      if (typeof guardrails !== 'object' || guardrails === null) {
        res.status(400).json({ success: false, error: { message: 'Guardrails must be an object' } });
        return;
      }
      const { maxActionsPerDay, maxSpendPerDay, maxPostsPerDay, contentBlocklist } = guardrails;
      if (maxActionsPerDay !== undefined && (typeof maxActionsPerDay !== 'number' || maxActionsPerDay < 0 || maxActionsPerDay > 1000)) {
        res.status(400).json({ success: false, error: { message: 'maxActionsPerDay must be a number between 0 and 1000' } });
        return;
      }
      if (maxSpendPerDay !== undefined && (typeof maxSpendPerDay !== 'number' || maxSpendPerDay < 0 || maxSpendPerDay > 100000)) {
        res.status(400).json({ success: false, error: { message: 'maxSpendPerDay must be a number between 0 and 100000' } });
        return;
      }
      if (maxPostsPerDay !== undefined && (typeof maxPostsPerDay !== 'number' || maxPostsPerDay < 0 || maxPostsPerDay > 100)) {
        res.status(400).json({ success: false, error: { message: 'maxPostsPerDay must be a number between 0 and 100' } });
        return;
      }
      if (contentBlocklist !== undefined && (!Array.isArray(contentBlocklist) || !contentBlocklist.every((t: any) => typeof t === 'string'))) {
        res.status(400).json({ success: false, error: { message: 'contentBlocklist must be an array of strings' } });
        return;
      }
    }

    await updateAgentConfig(resolved, { enabled, cronExpression, cronDescription, autonomyLevel, guardrails });

    if (cronExpression !== undefined) {
      await agentScheduler.reload();
    }

    const scheduleInfo = agentScheduler.getScheduleInfo();
    const statuses = getAgentStatuses(scheduleInfo);
    const updated = statuses.find(s => s.agentId === resolved);

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/agents/emergency-stop', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    agentScheduler.stop();
    const result = await emergencyStopAllAgents();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/agents/:id/memory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const resolved = resolveAgentId(id);
    const memories = await getAllMemories(resolved);
    res.json({ success: true, data: memories });
  } catch (error) {
    next(error);
  }
});

const memoryAddSchema = z.object({
  layer: z.enum(['working', 'short_term', 'long_term', 'episodic', 'semantic']),
  content: z.string().max(10000).optional(),
  category: z.string().max(200).optional(),
  pattern: z.string().max(10000).optional(),
  eventType: z.string().max(200).optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(10000).optional(),
  impact: z.string().max(200).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  data: z.any().optional(),
});

adminRouter.post('/agents/:id/memory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const resolved = resolveAgentId(id);

    const parsed = memoryAddSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { message: 'Invalid input', details: parsed.error.flatten() } });
      return;
    }

    const { layer, content, category, pattern, eventType, title, description, impact, tags, data } = parsed.data;

    if (layer === 'semantic' && !content) {
      res.status(400).json({ success: false, error: { message: 'Content is required for semantic memory' } });
      return;
    }
    if (['short_term', 'long_term'].includes(layer) && !content && !pattern) {
      res.status(400).json({ success: false, error: { message: 'Content or pattern is required' } });
      return;
    }

    let memoryId: string | null = null;

    switch (layer) {
      case 'working':
        await setWorkingMemory(resolved, data || {});
        res.json({ success: true, data: { layer: 'working' } });
        return;
      case 'short_term':
        memoryId = await addShortTermMemory(resolved, category || 'general', content!);
        break;
      case 'long_term':
        memoryId = await addLongTermMemory(resolved, category || 'general', pattern || content!);
        break;
      case 'episodic':
        memoryId = await addEpisodicMemory(
          resolved, eventType || 'manual', title || 'Manual entry',
          description || content || '', impact, tags || []
        );
        break;
      case 'semantic':
        memoryId = await addSemanticMemory(resolved, content!, category || 'general');
        break;
    }

    res.json({ success: true, data: { id: memoryId, layer } });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/content/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: { message: 'Invalid content ID' } });
      return;
    }
    const result = await publishingService.publishContentItem(id);
    res.json({ success: result.success, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/agents/:id/memory/:memoryId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, memoryId } = req.params;
    const { layer } = req.query;
    const resolved = resolveAgentId(id);

    switch (layer) {
      case 'working':
        await clearWorkingMemory(resolved);
        break;
      case 'short_term':
        await deleteShortTermMemory(memoryId, resolved);
        break;
      case 'long_term':
        await deleteLongTermMemory(memoryId, resolved);
        break;
      case 'episodic':
        await deleteEpisodicMemory(memoryId, resolved);
        break;
      case 'semantic':
        await deleteSemanticMemory(memoryId, resolved);
        break;
      default:
        res.status(400).json({ success: false, error: { message: `Invalid memory layer: ${layer}` } });
        return;
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/content/publish-approved', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await publishingService.publishApprovedContent();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/execution-log', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = req.query.agentId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const filters: Record<string, string> = {};
    if (agentId) filters.agent_id = agentId;

    const logs = await supabaseSelect('dm_execution_log', Object.keys(filters).length > 0 ? filters : undefined, {
      order: 'executed_at.desc',
      limit,
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

const securityLogQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.enum([
    'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'SIGNUP', 'LOGOUT',
    'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_COMPLETE', 'EMAIL_VERIFICATION',
    'OAUTH_GOOGLE', 'OAUTH_LINKEDIN', 'TOKEN_REFRESH', 'TOKEN_INVALID',
    'ACCESS_DENIED', 'ROLE_CHECK_FAILURE', 'PROFILE_VIEW', 'DATA_EXPORT',
    'PII_ACCESS', 'ADMIN_DATA_QUERY', 'ROLE_CHANGE', 'CONFIG_CHANGE',
    'RATE_LIMIT_HIT', 'REPEATED_AUTH_FAILURE', 'BLOCKED_INPUT',
    'ACCOUNT_DELETION', 'PASSWORD_CHANGE',
  ]).optional(),
  userId: z.string().optional(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(),
  result: z.enum(['SUCCESS', 'FAILURE', 'BLOCKED']).optional(),
  startDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  endDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  ipAddress: z.string().optional(),
});

adminRouter.get('/security-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    securityLogger.accessEvent(req, 'ADMIN_DATA_QUERY', req.user!.userId, { endpoint: '/admin/security-logs' });

    const parsed = securityLogQuerySchema.parse(req.query);
    const { page, limit } = parsed;
    const skip = (page - 1) * limit;

    const where: Prisma.SecurityLogWhereInput = {};

    if (parsed.action) {
      where.action = parsed.action;
    }
    if (parsed.userId) {
      where.userId = parsed.userId;
    }
    if (parsed.severity) {
      where.severity = parsed.severity;
    }
    if (parsed.result) {
      where.result = parsed.result;
    }
    if (parsed.startDate || parsed.endDate) {
      where.timestamp = {};
      if (parsed.startDate) {
        where.timestamp.gte = new Date(parsed.startDate);
      }
      if (parsed.endDate) {
        where.timestamp.lte = new Date(parsed.endDate);
      }
    }
    if (parsed.ipAddress) {
      where.ipAddress = parsed.ipAddress;
    }

    const [logs, total] = await Promise.all([
      prisma.securityLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
      prisma.securityLog.count({ where }),
    ]);

    res.json({
      success: true,
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/users/:userId/role', requireRole('ADMIN'), requireReauth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = z.object({ role: z.enum(['VIEWER', 'USER', 'MANAGER', 'ADMIN']) }).parse(req.body);
    const targetUserId = req.params.userId;

    if (targetUserId === req.user!.userId) {
      res.status(400).json({ success: false, error: { message: 'Cannot change your own role' } });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      res.status(404).json({ success: false, error: { message: 'User not found' } });
      return;
    }

    const previousRole = targetUser.role;
    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { role },
      select: { id: true, email: true, role: true },
    });

    securityLogger.configEvent(req, 'ROLE_CHANGE', req.user!.userId, {
      targetUserId,
      previousRole,
      newRole: role,
    });

    await logAdminAction(req, 'ROLE_CHANGE', {
      targetId: targetUserId,
      metadata: { previousRole, newRole: role, targetEmail: targetUser.email },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

adminRouter.delete('/users/:userId', requireRole('ADMIN'), requireReauth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const targetUserId = req.params.userId;

    if (targetUserId === req.user!.userId) {
      res.status(400).json({ success: false, error: { message: 'Cannot delete your own account' } });
      return;
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      res.status(404).json({ success: false, error: { message: 'User not found' } });
      return;
    }

    await logAdminAction(req, 'USER_DELETION', {
      targetId: targetUserId,
      metadata: { targetEmail: targetUser.email, targetRole: targetUser.role },
    });

    securityLogger.configEvent(req, 'USER_MANAGEMENT', req.user!.userId, {
      action: 'DELETE',
      targetUserId,
      targetEmail: targetUser.email,
    });

    await prisma.$transaction(async (tx) => {
      await tx.adminAuditLog.deleteMany({ where: { OR: [{ actorId: targetUserId }, { targetId: targetUserId }] } });
      await tx.activity.deleteMany({ where: { userId: targetUserId } });
      await tx.notification.deleteMany({ where: { userId: targetUserId } });
      await tx.matchFeedback.deleteMany({ where: { userId: targetUserId } });
      await tx.messageRecord.deleteMany({ where: { userId: targetUserId } });
      await tx.communicationPreference.deleteMany({ where: { userId: targetUserId } });
      await tx.eventParticipant.deleteMany({ where: { userId: targetUserId } });
      await tx.introductionRecord.deleteMany({ where: { OR: [{ userAId: targetUserId }, { userBId: targetUserId }] } });
      await tx.match.deleteMany({ where: { OR: [{ userAId: targetUserId }, { userBId: targetUserId }] } });
      await tx.dealTracking.deleteMany({ where: { OR: [{ dealPartnerId: targetUserId }, { founderId: targetUserId }] } });
      await tx.conversation.deleteMany({ where: { userId: targetUserId } });
      await tx.call.deleteMany({ where: { userId: targetUserId } });
      await tx.userEmbedding.deleteMany({ where: { userId: targetUserId } });
      await tx.inviteCode.updateMany({ where: { usedById: targetUserId }, data: { usedById: null, usedAt: null } });
      await tx.inviteCode.deleteMany({ where: { createdById: targetUserId } });
      await tx.profile.deleteMany({ where: { userId: targetUserId } });
      await tx.user.delete({ where: { id: targetUserId } });
    });

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    next(error);
  }
});

adminRouter.put('/users/:userId/status', requireRole('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const targetUserId = req.params.userId;

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      res.status(404).json({ success: false, error: { message: 'User not found' } });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: { isActive },
      select: { id: true, email: true, isActive: true },
    });

    await logAdminAction(req, 'USER_STATUS_CHANGE', {
      targetId: targetUserId,
      metadata: { previousStatus: targetUser.isActive, newStatus: isActive, targetEmail: targetUser.email },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const action = req.query.action as string | undefined;
    const actorId = req.query.actorId as string | undefined;
    const targetId = req.query.targetId as string | undefined;

    const result = await getAuditLogs({ page, limit, action, actorId, targetId });
    res.json({ success: true, data: result.logs, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/founder/briefing', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const briefing = await getLatestBriefing();
    res.json({ success: true, data: briefing });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/founder/briefing/generate', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const briefing = await generateDailyBriefing();
    res.json({ success: true, data: briefing });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/founder/decisions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const urgency = req.query.urgency as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const decisions = await getDecisions({ status, urgency, limit });
    res.json({ success: true, data: decisions });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/founder/decisions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, context, options, requesting_agent, urgency } = req.body;
    if (!title || !requesting_agent) {
      res.status(400).json({ success: false, error: { message: 'title and requesting_agent are required' } });
      return;
    }
    const decision = await createDecision({
      title,
      context: context || '',
      options: options || [],
      requesting_agent,
      urgency: urgency || 'medium',
    });
    res.json({ success: true, data: decision });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/founder/decisions/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: { message: 'Invalid decision ID' } });
      return;
    }
    const { status, chosen_option, founder_notes } = req.body;
    if (!status || !['approved', 'rejected', 'deferred'].includes(status)) {
      res.status(400).json({ success: false, error: { message: 'Status must be approved, rejected, or deferred' } });
      return;
    }
    await updateDecisionStatus(id, status, chosen_option, founder_notes);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/founder/decisions/:id/outcome', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: { message: 'Invalid decision ID' } });
      return;
    }
    const { outcome } = req.body;
    if (!outcome) {
      res.status(400).json({ success: false, error: { message: 'Outcome is required' } });
      return;
    }
    await updateDecisionOutcome(id, outcome);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/founder/decisions/:id/debate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: { message: 'Invalid decision ID' } });
      return;
    }
    const entries = await triggerDebate(id);
    res.json({ success: true, data: entries });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/founder/decisions/:id/debate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: { message: 'Invalid decision ID' } });
      return;
    }
    const entries = await getDebateEntries(id);
    res.json({ success: true, data: entries });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/founder/priority-inbox', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const inbox = await getPriorityInbox();
    res.json({ success: true, data: inbox });
  } catch (error) {
    next(error);
  }
});
