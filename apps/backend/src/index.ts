import * as Sentry from '@sentry/node';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { env } from './config/env';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.2 : 1.0,
  });
}

import { errorHandler } from './middleware/errorHandler';
import { setupWebSocket } from './websocket/server';
import { seedDatabase } from './seed';
import { csrfTokenProvider, csrfProtection } from './middleware/csrf';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { conversationRouter } from './routes/conversation';
import { matchRouter } from './routes/match';
import { callRouter } from './routes/call';
import { adminRouter } from './routes/admin';
import { notificationRouter } from './routes/notification';
import { messagingRouter } from './routes/messaging';
import { twilioRouter } from './routes/twilio';
import { dealRouter } from './routes/deal';
import { eventRouter } from './routes/event';
import { aiChatRouter } from './routes/aiChat';
import { introductionRouter } from './routes/introduction';
import { generalLimiter } from './middleware/rateLimit';
import { inviteRouter } from './routes/invite';
import { activityRouter } from './routes/activity';

const app = express();
app.set('trust proxy', 1);

const server = createServer(app);

app.use(helmet());
const corsOrigin = env.CORS_ORIGIN || env.FRONTEND_URL;
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', generalLimiter);

const startTime = Date.now();
const healthHandler = (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    env: env.NODE_ENV,
  });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

app.get('/api/csrf-token', csrfTokenProvider);

app.get('/api/stats/public', async (_req: Request, res: Response) => {
  try {
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    const [memberCount, matchCount, introCount] = await Promise.all([
      p.user.count({ where: { isActive: true } }),
      p.match.count(),
      p.introductionRecord.count().catch(() => 0),
    ]);
    await p.$disconnect();
    res.json({
      success: true,
      data: {
        memberCount,
        matchCount,
        introductionCount: introCount,
      },
    });
  } catch {
    res.json({ success: true, data: { memberCount: 0, matchCount: 0, introductionCount: 0 } });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/users', csrfProtection, userRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/matches', csrfProtection, matchRouter);
app.use('/api/calls', callRouter);
app.use('/api/admin', csrfProtection, adminRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/messaging', messagingRouter);
app.use('/api/twilio', twilioRouter);
app.use('/api/deals', csrfProtection, dealRouter);
app.use('/api/events', csrfProtection, eventRouter);
app.use('/api/ai-chat', aiChatRouter);
app.use('/api/introductions', csrfProtection, introductionRouter);
app.use('/api/invites', csrfProtection, inviteRouter);
app.use('/api/activities', csrfProtection, activityRouter);

if (env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

setupWebSocket(server);

function logServiceStatus() {
  console.log('\n--- Service Status ---');
  console.log(`  CORS origin: ${corsOrigin}`);
  console.log(`  OpenAI: ${env.OPENAI_API_KEY ? '✅ configured' : '⚠️  not configured (AI chat will use fallback responses)'}`);
  console.log(`  Twilio: ${env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN ? '✅ configured' : '⚠️  not configured (calls/SMS disabled)'}`);
  console.log(`  SMTP: ${env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS ? '✅ configured' : '⚠️  not configured (emails logged only)'}`);
  console.log(`  Google OAuth: ${env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? '✅ configured' : '⚠️  not configured (Google login disabled)'}`);
  console.log(`  Sentry: ${env.SENTRY_DSN ? '✅ configured' : '⚠️  not configured (error tracking disabled)'}`);
  console.log(`  PostHog: ${env.POSTHOG_KEY ? '✅ configured' : '⚠️  not configured (analytics disabled)'}`);
  console.log('---------------------\n');
}

server.listen(env.PORT, async () => {
  console.log(`Cleo.ai Backend running on port ${env.PORT}`);
  console.log(`WebSocket ready`);
  console.log(`Environment: ${env.NODE_ENV}`);
  logServiceStatus();
  await seedDatabase();
});
