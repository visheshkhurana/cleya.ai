// JARVIS read/write integration for Cleya.ai.
//
// JARVIS (the operator OS at jarvis-web-pearl.vercel.app) calls these
// endpoints on:
//   • a schedule (hourly Multi-app metrics fetch)
//   • on-demand after operator HITL approval (actions)
//
// Contract — both endpoints HMAC-authed via x-jarvis-signature, see
// src/middleware/jarvisAuth.ts.
//
//   GET  /api/jarvis/metrics               → snapshot of growth + finance KPIs
//   POST /api/jarvis/actions/:id           → run an admin-style action
//
// Action catalog (extend as needed):
//   flag_user           { userId }                     suspend (isActive=false)
//   unflag_user         { userId }                     re-activate
//   set_tier            { userId, tier }               FREE | PRO | ENTERPRISE
//   pause_matching                                     dailyProposalCap = 0
//   resume_matching     { dailyProposalCap?: number }  restore caps
//   send_announcement   { title, body, audience? }     all users / paid only
//
// All actions return { ok, result } or { ok: false, error }. Errors
// are caught by the express error handler — JARVIS surfaces them in
// /view/audit + agent_events.

import { Router, Request, Response } from 'express';
import { PrismaClient, UserTier, NotificationChannel, NotificationEvent, SubscriptionStatus, MatchStatus } from '@prisma/client';
import { jarvisAuth } from '../middleware/jarvisAuth';

const prisma = new PrismaClient();
export const jarvisRouter = Router();

// All sub-routes below run jarvisAuth.
jarvisRouter.use(jarvisAuth);

// ── Metrics ────────────────────────────────────────────────────────
// Snapshot of growth + finance KPIs JARVIS surfaces on the
// /view/finance and /view/growth dashboards. All counts are point-in-
// time except *_24h / *_7d / *_30d which are window-bounded.
//
// Pricing assumptions (override via env if needed):
//   PRO_MONTHLY_INR (default 999)
//   ENTERPRISE_MONTHLY_INR (default 4999)
// MRR = active subs × tier price. Adjust when Razorpay plan IDs are
// canonicalized.

const PRO_PRICE = Number(process.env.PRO_MONTHLY_INR ?? 999);
const ENT_PRICE = Number(process.env.ENTERPRISE_MONTHLY_INR ?? 4999);

jarvisRouter.get('/metrics', async (_req: Request, res: Response) => {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const ago24h = new Date(now.getTime() - day);
  const ago7d  = new Date(now.getTime() - 7 * day);
  const ago30d = new Date(now.getTime() - 30 * day);

  try {
    const [
      usersTotal,
      usersActiveTotal,
      signups24h,
      signups7d,
      signups30d,
      paidUsers,
      proSubs,
      entSubs,
      activitiesByUser30d,
      matchesProposed30d,
      matchesAccepted30d,
      matchesRejected30d,
      introsTotal,
      intros30d,
      feedbacksPositive30d,
      feedbacksTotal30d,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { createdAt: { gte: ago24h } } }),
      prisma.user.count({ where: { createdAt: { gte: ago7d } } }),
      prisma.user.count({ where: { createdAt: { gte: ago30d } } }),
      prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE, user: { tier: UserTier.PRO } },
      }),
      prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE, user: { tier: UserTier.ENTERPRISE } },
      }),
      // Distinct users with any activity in the last 30 days.
      prisma.activity.findMany({
        where: { createdAt: { gte: ago30d } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      prisma.match.count({ where: { createdAt: { gte: ago30d } } }),
      prisma.match.count({
        where: { createdAt: { gte: ago30d }, status: MatchStatus.ACCEPTED },
      }),
      prisma.match.count({
        where: { createdAt: { gte: ago30d }, status: MatchStatus.REJECTED },
      }),
      prisma.introductionRecord.count(),
      prisma.introductionRecord.count({ where: { sentAt: { gte: ago30d } } }),
      prisma.matchFeedback.count({
        where: { createdAt: { gte: ago30d }, rating: { gte: 4 } },
      }),
      prisma.matchFeedback.count({ where: { createdAt: { gte: ago30d } } }),
    ]);

    const mrrInr = proSubs * PRO_PRICE + entSubs * ENT_PRICE;
    const arrInr = mrrInr * 12;
    const decidedMatches = matchesAccepted30d + matchesRejected30d;
    const acceptanceRatePct = decidedMatches > 0
      ? Math.round((matchesAccepted30d / decidedMatches) * 1000) / 10
      : 0;
    const churnPossible = paidUsers + 1; // avoid /0
    const conversionRatePct = usersTotal > 0
      ? Math.round((paidUsers / usersTotal) * 10000) / 100
      : 0;

    const metrics = [
      // Finance
      { name: 'mrr_inr',            value: mrrInr,                  unit: 'INR', period: 'snapshot' },
      { name: 'arr_inr',            value: arrInr,                  unit: 'INR', period: 'snapshot' },
      { name: 'paid_users',         value: paidUsers,               unit: 'count' },
      { name: 'pro_subs',           value: proSubs,                 unit: 'count' },
      { name: 'enterprise_subs',    value: entSubs,                 unit: 'count' },
      // Growth
      { name: 'users_total',        value: usersTotal,              unit: 'count' },
      { name: 'users_active',       value: usersActiveTotal,        unit: 'count' },
      { name: 'users_active_30d',   value: activitiesByUser30d.length, unit: 'count' },
      { name: 'signups_24h',        value: signups24h,              unit: 'count' },
      { name: 'signups_7d',         value: signups7d,               unit: 'count' },
      { name: 'signups_30d',        value: signups30d,              unit: 'count' },
      { name: 'conversion_rate_pct', value: conversionRatePct,       unit: 'pct' },
      // Product (matchmaking + intros — the core Cleya KPIs)
      { name: 'matches_proposed_30d', value: matchesProposed30d,    unit: 'count' },
      { name: 'matches_accepted_30d', value: matchesAccepted30d,    unit: 'count' },
      { name: 'match_acceptance_rate_pct', value: acceptanceRatePct, unit: 'pct' },
      { name: 'intros_total',       value: introsTotal,             unit: 'count' },
      { name: 'intros_30d',         value: intros30d,               unit: 'count' },
      { name: 'feedback_positive_30d', value: feedbacksPositive30d, unit: 'count' },
      { name: 'feedback_total_30d', value: feedbacksTotal30d,       unit: 'count' },
    ];

    res.json({ ok: true, as_of: now.toISOString(), metrics, churn_possible: churnPossible });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[jarvis/metrics] failed:', msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

// ── Actions ────────────────────────────────────────────────────────
// Discrete admin operations JARVIS executes after operator approval.
// Every body MUST be JSON. The HMAC signature is computed over the
// raw stringified body (see jarvisAuth middleware).

jarvisRouter.post('/actions/:id', async (req: Request, res: Response) => {
  const actionId = req.params.id;
  const params = (req.body?.params ?? {}) as Record<string, unknown>;

  try {
    switch (actionId) {
      case 'flag_user': {
        const userId = String(params.userId ?? '');
        if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });
        const u = await prisma.user.update({
          where: { id: userId },
          data: { isActive: false },
          select: { id: true, isActive: true },
        });
        return res.json({ ok: true, result: u });
      }

      case 'unflag_user': {
        const userId = String(params.userId ?? '');
        if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });
        const u = await prisma.user.update({
          where: { id: userId },
          data: { isActive: true },
          select: { id: true, isActive: true },
        });
        return res.json({ ok: true, result: u });
      }

      case 'set_tier': {
        const userId = String(params.userId ?? '');
        const tier = String(params.tier ?? '').toUpperCase();
        if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });
        if (!['FREE', 'PRO', 'ENTERPRISE'].includes(tier)) {
          return res.status(400).json({ ok: false, error: 'tier must be FREE|PRO|ENTERPRISE' });
        }
        const u = await prisma.user.update({
          where: { id: userId },
          data: { tier: tier as UserTier },
          select: { id: true, tier: true },
        });
        return res.json({ ok: true, result: u });
      }

      case 'pause_matching': {
        const cfg = await prisma.matchThrottleConfig.upsert({
          where: { id: 'default' },
          update: { dailyProposalCap: 0 },
          create: {
            id: 'default',
            dailyProposalCap: 0,
            proposalCooldownHours: 24,
            dailyNotificationCap: 0,
            quietHoursStart: 22,
            quietHoursEnd: 8,
          },
        });
        return res.json({ ok: true, result: { paused: true, cap: cfg.dailyProposalCap } });
      }

      case 'resume_matching': {
        const cap = Number(params.dailyProposalCap ?? 50);
        const cfg = await prisma.matchThrottleConfig.upsert({
          where: { id: 'default' },
          update: { dailyProposalCap: cap },
          create: {
            id: 'default',
            dailyProposalCap: cap,
            proposalCooldownHours: 24,
            dailyNotificationCap: 100,
            quietHoursStart: 22,
            quietHoursEnd: 8,
          },
        });
        return res.json({ ok: true, result: { paused: false, cap: cfg.dailyProposalCap } });
      }

      case 'send_announcement': {
        const title = String(params.title ?? '').slice(0, 200);
        const body  = String(params.body  ?? '').slice(0, 2000);
        const audience = String(params.audience ?? 'all'); // 'all' | 'paid'
        if (!title || !body) return res.status(400).json({ ok: false, error: 'title + body required' });

        const where = audience === 'paid'
          ? { isActive: true, subscription: { status: SubscriptionStatus.ACTIVE } }
          : { isActive: true };
        const recipients = await prisma.user.findMany({ where, select: { id: true }, take: 50_000 });
        if (recipients.length === 0) {
          return res.json({ ok: true, result: { sent: 0, audience } });
        }

        // Use SECRETARY_DIGEST event since the enum doesn't yet have an
        // ANNOUNCEMENT slot. createMany skips duplicates implicitly via
        // the (default) enabled state — there are no unique constraints
        // on Notification beyond id, so this is a straight insert.
        await prisma.notification.createMany({
          data: recipients.map((u) => ({
            userId: u.id,
            channel: NotificationChannel.IN_APP,
            event: NotificationEvent.SECRETARY_DIGEST,
            title,
            body,
            metadata: { source: 'jarvis_announcement' },
          })),
        });
        return res.json({ ok: true, result: { sent: recipients.length, audience } });
      }

      default:
        return res.status(400).json({ ok: false, error: `unknown action: ${actionId}` });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[jarvis/actions/${actionId}] failed:`, msg);
    res.status(500).json({ ok: false, error: msg });
  }
});

// Health probe for the integration itself — JARVIS hits this to render
// the green dot on the AppSwitcher card. Auth-required so secret
// rotation breaks loudly instead of silently.
jarvisRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'cleya', integration: 'jarvis', ts: Date.now() });
});
