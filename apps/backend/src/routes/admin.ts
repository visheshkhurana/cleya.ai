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
import { metaWhatsAppService } from '../services/metaWhatsAppService';
import { twilioWhatsAppService } from '../services/twilioWhatsAppService';
import { whatsappBotService } from '../services/whatsappBotService';
import { analyticsAggregatorService } from '../services/analyticsAggregatorService';
import { agentScheduler } from '../services/agentScheduler';
import cronValidator from 'node-cron';
import { runAgent, getAgentStatuses, KNOWN_AGENT_IDS, getAgentRunHistory, getAgentAccountability, updateAgentConfig, resolveAgentId, emergencyStopAllAgents } from '../services/agentRunner';
import {
  getCrisisMode,
  activateCrisisMode,
  deactivateCrisisMode,
  sendDailyAuditDigest,
  sendWeeklyPerformanceReport,
} from '../services/founderSafetyService';
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

    const userIds = users.map(u => u.id);
    const subscriptions = await prisma.subscription.findMany({
      where: { userId: { in: userIds } },
    });
    const subMap = new Map(subscriptions.map(s => [s.userId, s]));

    res.json({
      success: true,
      data: users.map((u) => {
        const sub = subMap.get(u.id);
        return {
          id: u.id,
          email: u.email,
          phone: u.phone,
          role: u.role,
          tier: u.tier,
          matchesUsed: u.matchesUsed,
          isActive: u.isActive,
          createdAt: u.createdAt,
          profile: u.profile,
          subscription: sub ? {
            status: sub.status,
            razorpaySubscriptionId: sub.razorpaySubscriptionId,
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            cancelledAt: sub.cancelledAt,
          } : null,
        };
      }),
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

adminRouter.get('/analytics/health', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { ga4Service } = await import('../services/ga4Service');
    const { instagramService } = await import('../services/instagramService');
    const { posthogService } = await import('../services/posthogService');
    const { sentryService } = await import('../services/sentryService');

    res.json({
      success: true,
      data: {
        ga4: {
          configured: ga4Service.isConfigured(),
          method: ga4Service.getAuthMethod(),
          propertyId: process.env.GA4_PROPERTY_ID || null,
          requiredVars: ga4Service.isConfigured() ? [] : ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ANALYTICS_REFRESH_TOKEN'],
        },
        instagram: {
          configured: instagramService.isConfigured(),
          method: instagramService.getConnectionMethod(),
          requiredVars: ['INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_BUSINESS_ACCOUNT_ID', 'or META_ADS_ACCESS_TOKEN', 'or AYRSHARE_API_KEY'],
        },
        ayrshare: {
          configured: !!process.env.AYRSHARE_API_KEY,
          platforms: process.env.AYRSHARE_API_KEY ? ['linkedin', 'facebook', 'instagram'] : [],
        },
        metaAds: {
          configured: !!(process.env.META_ADS_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID),
          accountId: process.env.META_AD_ACCOUNT_ID || null,
        },
        linkedinAds: {
          configured: !!process.env.LINKEDIN_CLIENT_ID,
          status: 'pending_approval',
          accountId: process.env.LINKEDIN_AD_ACCOUNT_ID || null,
        },
        googleAds: {
          configured: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
          accessLevel: 'test',
          customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || null,
        },
        posthog: {
          configured: posthogService.isConfigured(),
          requiredVars: ['POSTHOG_API_KEY'],
        },
        sentry: {
          configured: sentryService.isConfigured(),
          requiredVars: ['SENTRY_AUTH_TOKEN', 'SENTRY_ORG', 'SENTRY_PROJECT'],
        },
      },
    });
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
    const { to, type, matchName, matchRole, matchScore, companyName, raiseAmount, sector, traction, linkedinUrl, matchReason, matchEmail, matchTitle } = req.body;
    if (!to) return res.status(400).json({ success: false, error: 'Missing "to" email address' });

    const emailType = type || 'welcome';

    let testUser: { name: string; company: string; role: string; email: string; linkedinUrl: string } | null = null;
    if (['match-proposed', 'match-accepted'].includes(emailType) && !matchName) {
      const dbUser = await prisma.user.findFirst({
        where: { onboardingComplete: true },
        select: { name: true, email: true, profile: { select: { companyName: true, linkedinUrl: true, currentRole: true } } },
        orderBy: { createdAt: 'desc' },
      });
      if (dbUser) {
        testUser = {
          name: dbUser.name || 'Test User',
          company: dbUser.profile?.companyName || 'Test Company',
          role: dbUser.profile?.currentRole || 'Founder',
          email: dbUser.email,
          linkedinUrl: dbUser.profile?.linkedinUrl || '',
        };
      }
    }

    const resolvedMatchName = matchName || testUser?.name || 'Test User';
    const resolvedCompany = companyName || testUser?.company || 'Test Company';
    const resolvedLinkedin = linkedinUrl || testUser?.linkedinUrl || 'https://www.linkedin.com/in/example';
    const resolvedEmail = matchEmail || testUser?.email || 'test@example.com';

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
        const parsedScore = matchScore ? parseFloat(matchScore) : 0.92;
        const validScore = isNaN(parsedScore) ? 0.92 : Math.min(1, Math.max(0, parsedScore));
        await emailService.sendMatchProposed(to, 'You', resolvedMatchName, matchRole || 'Founder', validScore, {
          companyName: resolvedCompany,
          raiseAmount: raiseAmount || '$2M Seed',
          sector: sector || 'Technology',
          traction: traction || 'Growing steadily with strong engagement metrics.',
          linkedinUrl: resolvedLinkedin,
          matchReason: matchReason || 'Strong alignment with your investment thesis and focus areas.',
        });
        break;
      case 'match-accepted':
        await emailService.sendMatchAccepted(to, 'You', resolvedMatchName, matchTitle || `${matchRole || 'Founder'} · ${sector || 'Technology'}`, resolvedEmail, resolvedLinkedin);
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

    let sampleUser: { name: string } = { name: 'User' };
    let sampleMatch: { name: string; role: string; company: string } = { name: 'Match Name', role: 'Founder', company: 'Company' };
    try {
      const users = await prisma.user.findMany({
        where: { onboardingComplete: true },
        select: { name: true, profile: { select: { currentRole: true, companyName: true } } },
        take: 2,
        orderBy: { createdAt: 'desc' },
      });
      if (users[0]) sampleUser = { name: users[0].name || 'User' };
      if (users[1]) sampleMatch = { name: users[1].name || 'Match Name', role: users[1].profile?.currentRole || 'Founder', company: users[1].profile?.companyName || 'Company' };
    } catch (err) {
      console.warn('[WhatsApp templates] Failed to fetch sample users from DB:', err);
    }

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
            name: sampleUser.name,
            matchName: sampleMatch.name,
            matchRole: sampleMatch.role,
            matchCompany: sampleMatch.company,
            matchScore: '94',
            introName: sampleMatch.name,
            introRole: `${sampleMatch.role} at ${sampleMatch.company}`,
            meetingTitle: 'Coffee Chat',
            withName: sampleMatch.name,
            proposedTime: 'Tomorrow at 3:00 PM IST',
            confirmedTime: new Date(Date.now() + 86400000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }) + ' at 3:00 PM IST',
            location: 'Google Meet',
            eventName: 'Networking Event',
            eventDate: new Date(Date.now() + 7 * 86400000).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
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
        example: 'Hi [User]! Cleya.ai has found a great connection for you. [Connection Name from Company] would love to connect. Reply to start the conversation!',
      },
      {
        elementName: 'cleya_meeting_reminder',
        languageCode: 'en',
        category: 'UTILITY',
        templateType: 'TEXT',
        content: 'Reminder: You have a meeting scheduled {{1}}. {{2}}',
        example: 'Reminder: You have a meeting scheduled [tomorrow at 3 PM]. [Coffee chat with Connection Name at Meeting Location]',
      },
      {
        elementName: 'cleya_followup',
        languageCode: 'en',
        category: 'UTILITY',
        templateType: 'TEXT',
        content: "Hi {{1}}! How was your meeting? We'd love to hear your feedback. Reply with your thoughts!",
        example: "Hi [User]! How was your meeting? We'd love to hear your feedback. Reply with your thoughts!",
      },
      {
        elementName: 'cleya_reengagement',
        languageCode: 'en',
        category: 'MARKETING',
        templateType: 'TEXT',
        content: "Hi {{1}}! It's been a while since we connected. Cleya.ai has new networking opportunities waiting for you. Tap to explore!",
        example: "Hi [User]! It's been a while since we connected. Cleya.ai has new networking opportunities waiting for you. Tap to explore!",
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

adminRouter.get('/whatsapp/meta-templates', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await metaWhatsAppService.listTemplates();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/whatsapp/diagnostics', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const activeProvider = messagingService.getActiveProvider();

    // Gupshup diagnostics
    const gupshupConfig = {
      apiKey: !!process.env.GUPSHUP_API_KEY,
      appName: !!process.env.GUPSHUP_APP_NAME,
      sourceNumber: !!process.env.GUPSHUP_SOURCE_NUMBER,
      templateNamespace: !!process.env.GUPSHUP_TEMPLATE_NAMESPACE,
      webhookSecret: !!process.env.GUPSHUP_WEBHOOK_SECRET,
    };
    const gupshupIsConfigured = gupshupConfig.apiKey && gupshupConfig.appName && gupshupConfig.sourceNumber;

    let gupshupApiReachable = false;
    let gupshupApiError: string | null = null;
    let gupshupTemplateCount: number | null = null;

    if (gupshupIsConfigured) {
      try {
        const result = await gupshupService.listTemplates();
        if (result.success) {
          gupshupApiReachable = true;
          const data = result.data;
          if (Array.isArray(data)) {
            gupshupTemplateCount = data.length;
          } else if (data?.templates && Array.isArray(data.templates)) {
            gupshupTemplateCount = data.templates.length;
          } else if (data?.status === 'success') {
            gupshupApiReachable = true;
          }
        } else {
          gupshupApiError = result.error || 'Unknown API error';
        }
      } catch (err: any) {
        gupshupApiError = err.message || 'Failed to reach Gupshup API';
      }
    }

    // Meta diagnostics
    const metaConfig = {
      token: !!process.env.META_WHATSAPP_TOKEN,
      phoneId: !!process.env.META_WHATSAPP_PHONE_ID,
      wabaId: !!process.env.META_WHATSAPP_WABA_ID,
      appSecret: !!process.env.META_WHATSAPP_APP_SECRET,
      verifyToken: !!process.env.META_WHATSAPP_VERIFY_TOKEN,
    };
    const metaIsConfigured = metaWhatsAppService.isConfigured();

    let metaApiReachable = false;
    let metaApiError: string | null = null;
    let metaTemplateCount: number | null = null;

    if (metaIsConfigured && metaConfig.wabaId) {
      try {
        const result = await metaWhatsAppService.listTemplates();
        if (result.success) {
          metaApiReachable = true;
          const data = result.data?.data;
          if (Array.isArray(data)) {
            metaTemplateCount = data.length;
          }
        } else {
          metaApiError = result.error || 'Unknown API error';
        }
      } catch (err: any) {
        metaApiError = err.message || 'Failed to reach Meta API';
      }
    }

    // Twilio diagnostics
    const twilioConfig = {
      accountSid: !!process.env.TWILIO_ACCOUNT_SID,
      authToken: !!process.env.TWILIO_AUTH_TOKEN,
      whatsappFrom: !!process.env.TWILIO_WHATSAPP_FROM,
    };
    const twilioIsConfigured = twilioWhatsAppService.isConfigured();

    const anyConfigured = gupshupIsConfigured || metaIsConfigured || twilioIsConfigured;
    const anyReachable = gupshupApiReachable || metaApiReachable || twilioIsConfigured;
    const overallHealth = anyConfigured && anyReachable ? 'healthy' : anyConfigured ? 'degraded' : 'not_configured';

    res.json({
      success: true,
      data: {
        health: overallHealth,
        activeProvider,
        gupshup: {
          config: gupshupConfig,
          isConfigured: gupshupIsConfigured,
          apiReachable: gupshupApiReachable,
          apiError: gupshupApiError,
          templateCount: gupshupTemplateCount,
          sourceNumber: gupshupIsConfigured ? process.env.GUPSHUP_SOURCE_NUMBER!.replace(/.(?=.{4})/g, '*') : null,
          appName: process.env.GUPSHUP_APP_NAME || null,
        },
        meta: {
          config: metaConfig,
          isConfigured: metaIsConfigured,
          apiReachable: metaApiReachable,
          apiError: metaApiError,
          templateCount: metaTemplateCount,
        },
        twilio: {
          config: twilioConfig,
          isConfigured: twilioIsConfigured,
          whatsappFrom: twilioIsConfigured ? process.env.TWILIO_WHATSAPP_FROM?.replace(/.(?=.{4})/g, '*') : null,
        },
        // Backwards compat fields
        config: gupshupConfig,
        isConfigured: anyConfigured,
        apiReachable: anyReachable,
        apiError: gupshupApiError || metaApiError,
        templateCount: gupshupTemplateCount ?? metaTemplateCount,
        sourceNumber: gupshupIsConfigured ? process.env.GUPSHUP_SOURCE_NUMBER!.replace(/.(?=.{4})/g, '*') : null,
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

    const activeProvider = messagingService.getActiveProvider();
    if (activeProvider === 'none') {
      return res.status(400).json({
        success: false,
        error: { message: 'No WhatsApp provider configured. Please set Twilio (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM), Meta (META_WHATSAPP_TOKEN, META_WHATSAPP_PHONE_ID), or Gupshup (GUPSHUP_API_KEY, GUPSHUP_APP_NAME, GUPSHUP_SOURCE_NUMBER) credentials.' },
      });
    }

    // Connectivity check using active provider
    try {
      if (activeProvider === 'twilio') {
        // Twilio connectivity is verified by having valid credentials; no template list API needed
      } else if (activeProvider === 'meta') {
        if (metaWhatsAppService.isConfigured()) {
          const check = await metaWhatsAppService.listTemplates();
          if (!check.success) {
            return res.status(502).json({
              success: false,
              error: { message: `Meta API connectivity check failed: ${check.error || 'Unknown error'}` },
            });
          }
        }
      } else {
        const connectivityCheck = await gupshupService.listTemplates();
        if (!connectivityCheck.success) {
          return res.status(502).json({
            success: false,
            error: { message: `Gupshup API connectivity check failed: ${connectivityCheck.error || 'Unknown error'}` },
          });
        }
      }
    } catch (connErr: any) {
      return res.status(502).json({
        success: false,
        error: { message: `WhatsApp API unreachable: ${connErr.message || 'Connection failed'}` },
      });
    }

    const testMessage = `Hello from Cleya! This is a test message sent from the Control Tower at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST via ${activeProvider.toUpperCase()}. If you received this, your WhatsApp connection is working.`;

    const adminUserId = req.user?.userId || 'system';
    const result = await messagingService.sendWhatsApp(adminUserId, phoneNumber, testMessage);

    const sendStatus = result?.status || 'UNKNOWN';
    const sendFailed = sendStatus === 'FAILED';

    res.status(sendFailed ? 502 : 200).json({
      success: !sendFailed,
      data: {
        provider: activeProvider,
        messageId: (result as any)?.messageSid || (result as any)?.messageId || null,
        status: sendStatus,
        errorMessage: (result as any)?.errorMessage || null,
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

adminRouter.post('/agents/activate-workforce', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentConfigs: Array<{
      id: string;
      cronExpression: string;
      cronDescription: string;
      guardrails: { maxActionsPerDay: number; maxPostsPerDay: number; maxSpendPerDay: number; contentBlocklist: string[] };
      taskContext: string;
    }> = [
      {
        id: 'probe',
        cronExpression: '0 7 * * *',
        cronDescription: 'Daily at 7:00 AM IST',
        guardrails: { maxActionsPerDay: 10, maxPostsPerDay: 5, maxSpendPerDay: 0, contentBlocklist: [] },
        taskContext: `Run a comprehensive QA sweep for Cleya.ai. Test the following:
1. Page loads: Landing page, About page, Pricing page, Login page, Signup page, Dashboard
2. API health: /api/health, /api/auth endpoints, /api/matches, /api/profiles
3. Authentication flows: Login with email, session management, token refresh
4. Agent chat functionality: Verify each agent responds to messages
5. Security headers: Check HTTPS, CSP, X-Frame-Options
6. Performance: Measure page load times and API response times
7. Navigation: Verify all internal links resolve correctly
Report all findings as structured QA items with pass/fail/warning status and priority levels.`,
      },
      {
        id: 'maven',
        cronExpression: '0 10 * * 1,3,5',
        cronDescription: 'Mon/Wed/Fri at 10:00 AM IST',
        guardrails: { maxActionsPerDay: 10, maxPostsPerDay: 5, maxSpendPerDay: 0, contentBlocklist: [] },
        taskContext: `Generate 3-5 social media posts for Cleya.ai, an AI-powered networking platform for India's startup ecosystem. Current stage: ~24 users, early traction, members-only.

Content themes to cover:
1. LinkedIn post about how AI-powered warm introductions are changing startup networking in India (thought leadership)
2. LinkedIn post highlighting the power of curated, quality connections vs mass networking (education)  
3. Instagram post about the Indian startup ecosystem's growth and why founders need better networking tools (awareness)
4. LinkedIn post about Cleya.ai's AI matchmaking — how it works and why it's different from LinkedIn (product update)
5. Optional: A community-focused post celebrating early adopters or sharing a networking tip

Each post should feel authentic to a founder's voice, reference Indian cities (Bangalore, Delhi NCR, Mumbai), and include relevant hashtags. Do NOT generate more than 5 posts. Queue everything for founder approval.`,
      },
      {
        id: 'scout',
        cronExpression: '0 6 * * 1',
        cronDescription: 'Weekly on Monday at 6:00 AM IST',
        guardrails: { maxActionsPerDay: 10, maxPostsPerDay: 5, maxSpendPerDay: 0, contentBlocklist: [] },
        taskContext: `Run a comprehensive SEO audit and keyword research for Cleya.ai. Focus areas:

1. TECHNICAL SEO AUDIT:
   - Audit the landing page (https://cleya.ai), about page, and pricing page
   - Check meta tags, headings hierarchy, structured data, image alt tags
   - Evaluate page speed and mobile-friendliness
   - Check robots.txt and sitemap.xml

2. SCHEMA MARKUP:
   - Generate JSON-LD Organization schema for Cleya.ai
   - Generate WebSite schema with search action
   - Generate FAQPage schema for common questions about AI networking

3. KEYWORD RESEARCH (10-15 target keywords):
   - "startup networking India"
   - "AI matchmaking founders investors"
   - "professional networking platform India"
   - "founder investor matching AI"
   - "startup ecosystem India networking"
   - "AI-powered introductions"
   - "venture capital networking India"
   - "Bangalore startup networking"
   - "Delhi NCR founder community"
   - "Mumbai startup connections"
   - Plus 3-5 related long-tail keywords

4. GEO OPTIMIZATION: Recommend content structure for AI search engine citability (ChatGPT, Perplexity, Gemini).

Store all results for review.`,
      },
      {
        id: 'nexus',
        cronExpression: '0 7 * * 1',
        cronDescription: 'Weekly on Monday at 7:00 AM IST',
        guardrails: { maxActionsPerDay: 10, maxPostsPerDay: 5, maxSpendPerDay: 0, contentBlocklist: [] },
        taskContext: `Generate a weekly operational plan for Cleya.ai's AI agent workforce. Current context:
- Platform: AI-powered networking for India's startup ecosystem
- Stage: Early stage, ~24 users, members-only
- Active agents: Maven (Marketing), Scout (SEO), Probe (QA), Outreach (Cold Email)
- Focus: Build awareness, grow user base organically, maintain platform quality

Weekly plan should include:
1. Maven tasks: 3 LinkedIn posts (Mon/Wed/Fri), 2 Instagram posts, focus on thought leadership and product awareness
2. Scout tasks: Monitor keyword rankings, check for new SEO opportunities, update schema markup if needed
3. Probe tasks: Daily QA sweep, report any regressions or new issues
4. Outreach tasks: Draft personalized outreach emails for 5-10 target founders in Bangalore and Delhi NCR

Assign appropriate models to each task. Prioritize quality over quantity. All content must go through founder approval before publishing.`,
      },
      {
        id: 'outreach',
        cronExpression: '0 10 * * 2,4',
        cronDescription: 'Tue/Thu at 10:00 AM IST (as-needed)',
        guardrails: { maxActionsPerDay: 10, maxPostsPerDay: 5, maxSpendPerDay: 0, contentBlocklist: [] },
        taskContext: `Draft a 3-email drip sequence targeting startup founders in India for Cleya.ai. This is for DRAFTING ONLY — do not send or launch. Store as campaign drafts for founder approval.

EMAIL 1 — Introduction (Day 0):
- Subject: Something personal and curiosity-driven (4-7 words)
- Body: Introduce Cleya.ai as an AI-powered networking platform. Mention the problem: founders waste hours on cold outreach and irrelevant connections. Cleya uses AI to match founders with the right investors, co-founders, and advisors. Under 120 words. CTA: "Would love to show you how it works — worth a quick look?"

EMAIL 2 — Value of Warm Intros (Day 3):
- Subject: Reference the value of warm introductions
- Body: Share a stat or insight about how warm intros lead to 3x higher response rates. Explain how Cleya.ai's AI identifies the best matches based on stage, sector, and goals. Mention early traction in Bangalore/Delhi NCR. Under 120 words. CTA: "Reply and I'll send you an invite."

EMAIL 3 — Invite to Join (Day 7):
- Subject: Exclusive/scarcity-driven
- Body: Final touch. Mention that Cleya is currently members-only with limited spots. Reference the growing community of founders and investors. Under 100 words. CTA: "Claim your spot: {{invite_link}}"

Target segment: founders (Seed to Series B). Use personalization fields: {{first_name}}, {{company}}, {{role}}.`,
      },
    ];

    const configResults: Array<{ agentId: string; configUpdated: boolean; error?: string }> = [];

    for (const agentConfig of agentConfigs) {
      try {
        await updateAgentConfig(agentConfig.id, {
          enabled: true,
          cronExpression: agentConfig.cronExpression,
          cronDescription: agentConfig.cronDescription,
          autonomyLevel: 'manual',
          guardrails: agentConfig.guardrails,
        });
        configResults.push({ agentId: agentConfig.id, configUpdated: true });
      } catch (configErr: any) {
        configResults.push({ agentId: agentConfig.id, configUpdated: false, error: configErr.message });
      }
    }

    await agentScheduler.reload();

    const configuredAgents = agentConfigs.filter(ac =>
      configResults.find(cr => cr.agentId === ac.id && cr.configUpdated)
    );

    (async () => {
      for (const agentConfig of configuredAgents) {
        try {
          console.log(`[WorkforceActivation] Running ${agentConfig.id} via scheduler...`);
          const result = await agentScheduler.executeAgent(agentConfig.id, agentConfig.taskContext);
          if (result.blocked) {
            console.log(`[WorkforceActivation] ${agentConfig.id} blocked: ${result.reason}`);
          } else if (result.skipped) {
            console.log(`[WorkforceActivation] ${agentConfig.id} skipped (already running)`);
          } else {
            console.log(`[WorkforceActivation] ${agentConfig.id} completed: ${result.status} (${(result.duration / 1000).toFixed(1)}s)`);
          }
        } catch (err: any) {
          console.error(`[WorkforceActivation] ${agentConfig.id} failed: ${err.message}`);
        }
      }
      console.log(`[WorkforceActivation] All agent runs completed`);
    })().catch(err => console.error('[WorkforceActivation] Background execution failed:', err));

    const summary = {
      totalAgents: configResults.length,
      configured: configResults.filter(r => r.configUpdated).length,
      configFailed: configResults.filter(r => !r.configUpdated).length,
      agents: configResults.map(cr => ({
        agentId: cr.agentId,
        configUpdated: cr.configUpdated,
        runResult: cr.configUpdated ? { status: 'queued' } : null,
        error: cr.error,
      })),
      message: 'Agents configured and runs queued. Check agent status and run history for results.',
    };

    const allConfigured = configResults.every(r => r.configUpdated);
    res.json({ success: allConfigured, data: summary });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/agents/emergency-stop', async (req: Request, res: Response, next: NextFunction) => {
  try {
    agentScheduler.stop();
    const result = await emergencyStopAllAgents();
    try {
      await activateCrisisMode(
        (req as any).user?.email || 'admin',
        'Emergency stop triggered from Control Tower'
      );
    } catch {}
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/crisis-mode/status', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const state = await getCrisisMode();
    res.json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/crisis-mode/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const activatedBy = (req as any).user?.email || 'admin';
    agentScheduler.stop();
    await emergencyStopAllAgents();
    const state = await activateCrisisMode(activatedBy, reason || 'Manually activated from Control Tower');
    res.json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/crisis-mode/deactivate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deactivatedBy = (req as any).user?.email || 'admin';
    const state = await deactivateCrisisMode(deactivatedBy);
    await agentScheduler.reload();
    res.json({ success: true, data: state });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/founder/audit-digest', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await sendDailyAuditDigest();
    res.json({ success: true, message: 'Daily audit digest sent' });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/founder/weekly-report', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await sendWeeklyPerformanceReport();
    res.json({ success: true, message: 'Weekly performance report sent' });
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

adminRouter.get('/content-calendar', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string | undefined;
    const platform = req.query.platform as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const filters: Record<string, string> = {};
    if (status) filters.status = status;
    if (platform) filters.platform = platform;
    const items = await supabaseSelect('content_calendar', Object.keys(filters).length > 0 ? filters : undefined, {
      order: 'scheduled_time.asc',
      limit,
    });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/content-calendar/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: { message: 'Invalid calendar item ID' } });
      return;
    }
    const { founder_notes, publish_immediately } = req.body;
    const result = await publishingService.approveCalendarItem(id, founder_notes, publish_immediately);
    if (!result.success) {
      res.status(400).json({ success: false, error: { message: result.error } });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/content-calendar/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: { message: 'Invalid calendar item ID' } });
      return;
    }
    const { founder_notes } = req.body;
    const result = await publishingService.rejectCalendarItem(id, founder_notes);
    if (!result.success) {
      res.status(400).json({ success: false, error: { message: result.error } });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/content-calendar/:id/publish', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ success: false, error: { message: 'Invalid calendar item ID' } });
      return;
    }
    const result = await publishingService.publishCalendarItem(id);
    res.json({ success: result.success, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/content-calendar/process', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await publishingService.processContentCalendar();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/approval-queue', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string || 'pending';
    const items = await supabaseSelect('founder_approval_queue', { status }, {
      order: 'created_at.desc',
      limit: 50,
    });
    res.json({ success: true, data: items });
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

adminRouter.get('/agents/data/list', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await supabaseSelect('dm_agents');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/agents/data/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = req.query.agent_id as string | undefined;
    const filters = agentId ? { agent_id: agentId } : undefined;
    const data = await supabaseSelect('dm_agent_logs', filters, { order: 'created_at.desc', limit: 100 });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/agents/data/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = req.query.agent_id as string | undefined;
    const filters = agentId ? { agent_id: agentId } : undefined;
    const data = await supabaseSelect('dm_agent_tasks', filters, { order: 'created_at.desc', limit: 100 });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/agents/data/tasks/:taskId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, error: { message: 'status is required' } });
    const { supabaseUpdate } = await import('../services/supabaseClient');
    await supabaseUpdate('dm_agent_tasks', { id: taskId }, { status });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/agents/data/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = req.query.agent_id as string | undefined;
    const filters = agentId ? { agent_id: agentId } : undefined;
    const data = await supabaseSelect('dm_content_queue', filters, { order: 'created_at.desc', limit: 100 });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch('/agents/data/content/:contentId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { contentId } = req.params;
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, error: { message: 'status is required' } });
    const { supabaseUpdate } = await import('../services/supabaseClient');
    await supabaseUpdate('dm_content_queue', { id: contentId }, { status });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/agents/data/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { agent_id, direction, message, message_type, metadata } = req.body;
    if (!agent_id || !message) return res.status(400).json({ success: false, error: { message: 'agent_id and message are required' } });
    const { supabaseInsert } = await import('../services/supabaseClient');
    await supabaseInsert('dm_agent_messages', {
      agent_id,
      direction: direction || 'inbound',
      message,
      message_type: message_type || 'text',
      metadata: metadata || {},
      read: false,
    });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/agents/data/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = req.query.agent_id as string | undefined;
    const filters = agentId ? { agent_id: agentId } : undefined;
    const data = await supabaseSelect('dm_agent_messages', filters, { order: 'created_at.desc', limit: 100 });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/agents/data/code-changes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = req.query.agent_id as string | undefined;
    const filters = agentId ? { agent_id: agentId } : undefined;
    const data = await supabaseSelect('dm_code_changes', filters, { order: 'created_at.desc', limit: 100 });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/agents/data/campaigns', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await supabaseSelect('dm_campaign_metrics');
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// --- SEO Reports ---

adminRouter.get('/seo/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getSEOReports } = await import('../services/seoAutomation');
    const limit = parseInt(req.query.limit as string) || 30;
    const data = await getSEOReports(limit);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/seo/latest', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { getLatestSEOReport } = await import('../services/seoAutomation');
    const data = await getLatestSEOReport();
    if (!data) {
      res.status(404).json({ success: false, error: { message: 'No SEO reports found' } });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/seo/reports/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getSEOReportByDate } = await import('../services/seoAutomation');
    const data = await getSEOReportByDate(req.params.date);
    if (!data) {
      res.status(404).json({ success: false, error: { message: `No SEO report found for ${req.params.date}` } });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// --- QA Reports ---

adminRouter.get('/qa/reports', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getQAReports } = await import('../services/qaAutomation');
    const limit = parseInt(req.query.limit as string) || 30;
    const data = await getQAReports(limit);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/qa/latest', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { getLatestQAReport } = await import('../services/qaAutomation');
    const data = await getLatestQAReport();
    if (!data) {
      res.status(404).json({ success: false, error: { message: 'No QA reports found' } });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.get('/qa/reports/:date', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getQAReportByDate } = await import('../services/qaAutomation');
    const data = await getQAReportByDate(req.params.date);
    if (!data) {
      res.status(404).json({ success: false, error: { message: `No QA report found for ${req.params.date}` } });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

adminRouter.post('/qa/run', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const { runDailyQARoutine } = await import('../services/qaAutomation');
    const result = await runDailyQARoutine();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});
