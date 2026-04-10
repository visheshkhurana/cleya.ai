import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { getAnalyticsSummary, getTopPages, getTrafficSources, analyticsOAuthService } from '../services/analyticsService';

const prisma = new PrismaClient();
export const analyticsRouter = Router();

// ---------- GA4 OAuth flow ----------

const GA4_OAUTH_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const GA4_REDIRECT_URI = process.env.FRONTEND_URL
  ? `${process.env.FRONTEND_URL}/api/analytics/ga4/callback`
  : (process.env.BACKEND_URL
    ? `${process.env.BACKEND_URL}/api/analytics/ga4/callback`
    : 'http://localhost:5000/api/analytics/ga4/callback');
const CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';

analyticsRouter.get('/ga4/auth', (_req: Request, res: Response) => {
  if (!CLIENT_ID) {
    res.status(500).json({ success: false, error: 'Google OAuth client ID not configured. Set GOOGLE_CLIENT_ID or GOOGLE_ADS_CLIENT_ID.' });
    return;
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: GA4_REDIRECT_URI,
    response_type: 'code',
    scope: GA4_OAUTH_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(authUrl);
});

analyticsRouter.get('/ga4/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query;

  if (error || !code) {
    res.status(400).json({ success: false, error: error || 'No authorization code received' });
    return;
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code as string,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: GA4_REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData: any = await tokenRes.json();

    if (!tokenRes.ok) {
      res.status(400).json({ success: false, error: 'Token exchange failed', details: tokenData });
      return;
    }

    console.log('[GA4 OAuth] Successfully obtained tokens');
    console.log('[GA4 OAuth] Refresh token — add this as GOOGLE_ANALYTICS_REFRESH_TOKEN:');
    console.log(tokenData.refresh_token);

    res.json({
      success: true,
      message: 'GA4 OAuth complete. Refresh token has been logged to the server console. Add it as GOOGLE_ANALYTICS_REFRESH_TOKEN in your environment.',
      hasRefreshToken: !!tokenData.refresh_token,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------- GA4 data endpoints (for direct API access) ----------

analyticsRouter.get('/ga4/summary', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await getAnalyticsSummary();
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/ga4/top-pages', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = (req.query.startDate as string) || '7daysAgo';
    const endDate = (req.query.endDate as string) || 'today';
    const limit = parseInt(req.query.limit as string) || 10;
    const pages = await getTopPages(startDate, endDate, limit);
    res.json({ success: true, data: pages });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/ga4/traffic-sources', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = (req.query.startDate as string) || '7daysAgo';
    const endDate = (req.query.endDate as string) || 'today';
    const sources = await getTrafficSources(startDate, endDate);
    res.json({ success: true, data: sources });
  } catch (err) {
    next(err);
  }
});

analyticsRouter.get('/overview', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const [
      totalMatches,
      acceptedMatches,
      pendingMatches,
      totalIntros,
      totalConversations,
      profile,
    ] = await Promise.all([
      prisma.match.count({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
      }),
      prisma.match.count({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: 'ACCEPTED',
        },
      }),
      prisma.match.count({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          status: 'PROPOSED',
        },
      }),
      prisma.introductionRecord.count({
        where: { OR: [{ userAId: userId }, { userBId: userId }] },
      }).catch(() => 0),
      prisma.conversation.count({ where: { userId } }),
      prisma.profile.findUnique({
        where: { userId },
        select: { completenessScore: true, isComplete: true, persona: true },
      }),
    ]);

    const recentMatches = await prisma.match.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        status: true,
        score: true,
        reason: true,
        createdAt: true,
        userA: { select: { id: true, name: true } },
        userB: { select: { id: true, name: true } },
      },
    });

    res.json({
      success: true,
      data: {
        profile: {
          completenessScore: profile?.completenessScore || 0,
          isComplete: profile?.isComplete || false,
          persona: profile?.persona,
        },
        matches: {
          total: totalMatches,
          accepted: acceptedMatches,
          pending: pendingMatches,
          acceptRate: totalMatches > 0 ? Math.round((acceptedMatches / totalMatches) * 100) : 0,
        },
        introductions: totalIntros,
        conversations: totalConversations,
        recentMatches: recentMatches.map(m => ({
          id: m.id,
          status: m.status,
          score: m.score,
          reason: m.reason,
          createdAt: m.createdAt,
          otherUser: m.userA.id === userId ? m.userB : m.userA,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});
