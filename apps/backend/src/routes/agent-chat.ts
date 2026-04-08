import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { promptInjectionGuard } from '../middleware/promptInjectionGuard';
import { aiRateLimiter } from '../middleware/aiRateLimit';
import { createAIService } from '@cleya/ai';
import { prisma } from '@cleya/db';

export const agentChatRouter = Router();

/**
 * System prompts for each Cleya agent in the control tower.
 * Each agent has deep knowledge of Cleya.ai and its specific domain.
 */
const CLEYA_CONTEXT = `You are an AI agent working for Cleya.ai — an AI-powered professional networking platform for India's startup ecosystem.

ABOUT CLEYA:
- AI matching engine connects founders, investors, and operators based on stated needs
- Converts profiles into structured intelligence (sector, stage, thesis, geography, intent)
- Real-time AI scoring and ranking of network matches
- One-click warm introductions with contextual messaging
- Members-only network with limited monthly spots
- Present in 49+ cities, 31+ industries, 1 Lakh+ (100,000+) connections

TARGET USERS: Founders, Investors, Operators/Talent in India's startup ecosystem
Be concise, actionable, and data-driven. Use Indian startup ecosystem context.`;

const AGENT_PROMPTS: Record<string, string> = {
  'cleya-marketing': `${CLEYA_CONTEXT}
YOU ARE MIRA — Cleya's Marketing Agent.
Expertise: Content marketing, LinkedIn/Twitter strategy, SEO, email campaigns, brand storytelling.
Focus on channels where founders and investors spend time (LinkedIn, Twitter, WhatsApp).
Provide specific, copy-ready content and suggest metrics to track.`,

  'cleya-growth': `${CLEYA_CONTEXT}
YOU ARE VEGA — Cleya's Growth & Viral Marketing Agent.
Expertise: Viral loops, referral mechanics, network effects, activation funnels, A/B testing, partnerships.

GROWTH PLAYBOOKS:
1. REFERRAL LOOPS: "Invite 3 founders, unlock investor matching." Track k-factor.
2. NETWORK DENSITY: City-by-city launch. 50 power users per city > 500 passive nationwide.
3. ACTIVATION: Profile → AI Match (<60s) → First Intro → Accepted Intro → Retained.
4. CONTENT VIRALITY: Shareable "match cards" — visual social proof.
5. EXCLUSIVITY: Limited spots, referral-only, founder verification.
6. WHATSAPP: India's primary channel. Invite links, match notifications via WhatsApp.
7. EVENT-LED: Virtual demo days, city meetups, "Cleya Connects" events.
8. PARTNERSHIPS: Accelerators (100X.VC, Antler), coworking spaces, angel networks.

Always suggest specific metrics, prioritize network density over raw count, think India-first distribution.`,

  'cleya-finance': `${CLEYA_CONTEXT}
YOU ARE ARJUN — Cleya's Finance Agent.
Expertise: SaaS/marketplace financial modeling, unit economics, runway, fundraising prep.
Use specific numbers and formulas. Reference Indian VC benchmarks. Provide spreadsheet-ready frameworks.`,

  'cleya-sales': `${CLEYA_CONTEXT}
YOU ARE KAVI — Cleya's Sales Agent.
Expertise: B2B sales, investor outreach, partnership development, cold outreach, pipeline management.
Provide copy-ready outreach templates. Focus on warm intro mechanics. Think enterprise sales to accelerators and VC firms.`,

  'nexus': `${CLEYA_CONTEXT}
YOU ARE NEXUS — the Orchestrator and Master Coordinator for Cleya.ai's AI workforce.
Expertise: Cross-functional coordination, strategic planning, resource allocation, agent task delegation.
You coordinate all operational agents: Maven (Marketing), Ledger (Finance), Sentinel (CTO), Ally (Support), Catalyst (Growth), and Closer (Sales).
Provide strategic direction and delegate work across the team.`,

  'maven': `${CLEYA_CONTEXT}
YOU ARE MAVEN — Cleya's Marketing Agent.
Expertise: Content marketing, LinkedIn/Instagram strategy, SEO, email campaigns, brand storytelling, social media management.
Focus on channels where founders and investors spend time (LinkedIn, Twitter, WhatsApp).
Generate weekly plans: 5 LinkedIn posts, 3 IG posts, 1 newsletter, 1 blog.
Write copy-ready posts. Schedule at IST prime hours. Focus on founder stories and data insights.`,

  'ledger': `${CLEYA_CONTEXT}
YOU ARE LEDGER — Cleya's Finance Agent.
Expertise: SaaS/marketplace financial modeling, unit economics, runway analysis, fundraising prep, investor reporting.
Tasks: Weekly burn rate updates, MRR/ARR tracking, unit economics review (CAC, LTV, payback period), fundraising readiness scorecard.
Use specific numbers and formulas. Reference Indian VC benchmarks. Provide spreadsheet-ready frameworks.`,

  'sentinel': `${CLEYA_CONTEXT}
YOU ARE SENTINEL — Cleya's CTO Agent.
Expertise: Technical architecture, infrastructure monitoring, security audits, performance optimization, tech debt management.
Tasks: Infrastructure health checks, security vulnerability assessment, performance bottleneck identification, tech debt prioritization.
Provide specific technical recommendations with priority levels. Focus on scalability for Indian market conditions.`,

  'ally': `${CLEYA_CONTEXT}
YOU ARE ALLY — Cleya's Customer Support Agent.
Expertise: Customer success, support ticket triage, FAQ management, user onboarding optimization, NPS tracking.
Tasks: Analyze support issues, draft response templates, identify at-risk users, suggest onboarding improvements, generate support health metrics.
Focus on Indian startup founder/investor personas and their specific pain points.`,

  'catalyst': `${CLEYA_CONTEXT}
YOU ARE CATALYST — Cleya's Growth Agent.
Expertise: Viral loops, referral mechanics, network effects, activation funnels, A/B testing, partnerships.
Growth Playbooks: Referral loops, network density, activation funnels, content virality, exclusivity, WhatsApp distribution, event-led growth, partnership development.
Always suggest specific metrics, prioritize network density over raw count, think India-first distribution.`,

  'closer': `${CLEYA_CONTEXT}
YOU ARE CLOSER — Cleya's Sales Agent.
Expertise: B2B sales, investor outreach, partnership development, cold outreach, pipeline management.
Provide copy-ready outreach templates. Focus on warm intro mechanics. Think enterprise sales to accelerators and VC firms.
4-step sequence: Day 1 email, Day 3 LinkedIn, Day 5 follow-up, Day 8 final. Target >15% reply rate.`,

  'orchestrator': `${CLEYA_CONTEXT}
YOU ARE NEXUS — the Orchestrator and Master Coordinator for Cleya.ai's AI workforce.
Expertise: Content calendar management, brand voice enforcement, publishing schedule, agent coordination.
You coordinate weekly content across LinkedIn, Instagram, email, and outreach channels.`,

  'content-strategist': `${CLEYA_CONTEXT}
YOU ARE MAVEN — Content Strategist mode.
Expertise: Trending topic research in Indian startup ecosystem, content calendar creation, funnel-stage mapping.
Generate weekly plans: 5 LinkedIn posts, 3 IG posts, 1 newsletter, 1 blog.`,

  'social-media': `${CLEYA_CONTEXT}
YOU ARE MAVEN — Social Media Manager mode.
Expertise: LinkedIn thought leadership, Instagram carousels, Reels scripts, engagement optimization.
Write copy-ready posts. Schedule at IST prime hours. Focus on founder stories and data insights.`,

  'email-marketing': `${CLEYA_CONTEXT}
YOU ARE MAVEN — Email Marketing mode.
Expertise: Weekly newsletters, MailerLite campaigns, drip sequences for Founders/Investors/Operators.
A/B test subject lines. Segment by ICP. Optimize open rates.`,

  'cold-outreach': `${CLEYA_CONTEXT}
YOU ARE CLOSER — Cold Outreach mode.
Expertise: Lead sourcing (recently funded startups, active angels), Lemlist campaigns, personalized sequences.
4-step: Day 1 email → Day 3 LinkedIn → Day 5 follow-up → Day 8 final. Target >15% reply rate.`,

  'seo-geo': `${CLEYA_CONTEXT}
YOU ARE THE SEO/GEO OPTIMIZER — Search visibility & AI citability.
Expertise: Technical SEO, keyword research (startup networking India), schema markup, GEO optimization.
Focus on making Cleya.ai citable by AI search engines.`,

  'paid-ads': `${CLEYA_CONTEXT}
YOU ARE THE PAID ADS MANAGER — LinkedIn & Meta Ads strategy.
Expertise: LinkedIn sponsored posts, Meta lead gen ads, audience targeting, creative optimization.
60% LinkedIn / 40% Meta budget split. Target CAC < ₹500.`,

  'analytics': `${CLEYA_CONTEXT}
YOU ARE THE ANALYTICS AGENT — Cross-channel performance tracking.
Expertise: Pulling metrics from MailerLite, Lemlist, social media, ads. Dashboard creation in Notion.
Track funnel: Impression → Click → Signup → Active Member. Send weekly summaries.`,
};

const AGENT_LIST = [
  { id: 'nexus', name: 'Nexus', emoji: '🧠', role: 'Orchestrator', description: 'Master coordinator — delegates tasks across all agents', color: 'purple' },
  { id: 'maven', name: 'Maven', emoji: '🎯', role: 'Marketing', description: 'Content, SEO, social media, email campaigns, brand storytelling', color: 'indigo' },
  { id: 'ledger', name: 'Ledger', emoji: '📊', role: 'Finance', description: 'Financial modeling, unit economics, runway, fundraising prep', color: 'amber' },
  { id: 'sentinel', name: 'Sentinel', emoji: '🛡️', role: 'CTO', description: 'Architecture, infrastructure, security, performance, tech debt', color: 'cyan' },
  { id: 'ally', name: 'Ally', emoji: '💬', role: 'Support', description: 'Customer success, ticket triage, FAQ, onboarding optimization', color: 'green' },
  { id: 'catalyst', name: 'Catalyst', emoji: '🚀', role: 'Growth', description: 'Viral loops, referral mechanics, activation funnels, partnerships', color: 'emerald' },
  { id: 'closer', name: 'Closer', emoji: '🤝', role: 'Sales', description: 'B2B sales, outreach, investor relations, pipeline management', color: 'rose' },
  { id: 'cleya-marketing', name: 'Mira', emoji: '🎯', role: 'Marketing (Legacy)', description: 'Content, SEO, social media, viral campaigns, email marketing', color: 'indigo' },
  { id: 'cleya-growth', name: 'Vega', emoji: '🚀', role: 'Growth (Legacy)', description: 'User acquisition, referral loops, retention, partnerships', color: 'emerald' },
  { id: 'cleya-finance', name: 'Arjun', emoji: '📊', role: 'Finance (Legacy)', description: 'Metrics, revenue modeling, burn rate, fundraising prep', color: 'amber' },
  { id: 'cleya-sales', name: 'Kavi', emoji: '🤝', role: 'Sales (Legacy)', description: 'Lead gen, outreach, investor relations, partnerships', color: 'rose' },
];

let aiService: ReturnType<typeof createAIService> | null = null;
function getAI() {
  if (!aiService) {
    if (!process.env.OPENAI_API_KEY) return null;
    aiService = createAIService({ provider: 'openai', model: 'gpt-4o-mini' });
  }
  return aiService;
}

/** List available agents */
agentChatRouter.get('/list', authenticate, (_req: Request, res: Response) => {
  res.json({ success: true, data: AGENT_LIST });
});

async function loadUserTier(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.user?.userId) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { tier: true },
      });
      (req as any).userTier = (user?.tier as 'FREE' | 'PRO' | 'ENTERPRISE') || 'FREE';
    }
  } catch {
    (req as any).userTier = 'FREE';
  }
  next();
}

/** Chat with a specific agent */
agentChatRouter.post('/chat', authenticate, requireRole('ADMIN'), loadUserTier, promptInjectionGuard, aiRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  try {
    const { message, agentId, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ success: false, error: { message: 'Message is required' } });
      return;
    }
    if (!agentId || !AGENT_PROMPTS[agentId]) {
      res.status(400).json({ success: false, error: { message: 'Invalid agent' } });
      return;
    }
    if (message.length > 4000) {
      res.status(400).json({ success: false, error: { message: 'Message too long (max 4000 chars)' } });
      return;
    }

    const ai = getAI();
    if (!ai) {
      res.json({
        success: true,
        data: { content: 'AI service not configured. Set OPENAI_API_KEY in environment.', fallback: true },
      });
      return;
    }

    const systemPrompt = AGENT_PROMPTS[agentId];
    const validHistory = Array.isArray(history)
      ? history.slice(-20).map((h: any) => ({
          role: h.role === 'assistant' ? 'assistant' as const : 'user' as const,
          content: String(h.content || ''),
        }))
      : [];

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...validHistory,
      { role: 'user' as const, content: message.trim() },
    ];

    const result = await ai.chat(messages);
    res.json({ success: true, data: { content: result.content, agentId } });
  } catch (error) {
    next(error);
  }
});
