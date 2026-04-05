import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
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
};

const AGENT_LIST = [
  { id: 'cleya-marketing', name: 'Mira', emoji: '🎯', role: 'Marketing', description: 'Content, SEO, social media, viral campaigns, email marketing', color: 'indigo' },
  { id: 'cleya-growth', name: 'Vega', emoji: '🚀', role: 'Growth', description: 'User acquisition, referral loops, retention, partnerships', color: 'emerald' },
  { id: 'cleya-finance', name: 'Arjun', emoji: '📊', role: 'Finance', description: 'Metrics, revenue modeling, burn rate, fundraising prep', color: 'amber' },
  { id: 'cleya-sales', name: 'Kavi', emoji: '🤝', role: 'Sales', description: 'Lead gen, outreach, investor relations, partnerships', color: 'rose' },
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

/** Chat with a specific agent */
agentChatRouter.post('/chat', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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

    // Check admin role
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.role !== 'ADMIN') {
      res.status(403).json({ success: false, error: { message: 'Admin access required' } });
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
