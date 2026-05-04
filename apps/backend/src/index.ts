import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { setupWebSocket } from './websocket/server';

import { authRouter } from './routes/auth';
import { contactRouter } from './routes/contact';
import { userRouter } from './routes/user';
import { conversationRouter } from './routes/conversation';
import { matchRouter } from './routes/match';
import { matchActionRouter } from './routes/matchAction';
import { inboundEmailRouter } from './routes/inboundEmail';
import { callRouter } from './routes/call';
import { notificationRouter } from './routes/notification';
import { searchRouter } from './routes/search';
import { adminRouter } from './routes/admin';
import { analyticsRouter } from './routes/analytics';
import { eventRouter } from './routes/event';
import { introductionRouter } from './routes/introduction';
import { meetingRouter } from './routes/meeting';
import { messagingRouter } from './routes/messaging';
import { referralRouter } from './routes/referral';
import { affiliateReferralRouter } from './routes/affiliateReferral';
import { verificationRouter } from './routes/verification';
import { directMessageRouter } from './routes/directMessage';
import { reportRouter } from './routes/report';
import { blockRouter } from './routes/block';
import { cookieConsentRouter } from './routes/cookieConsent';
import { inviteRouter } from './routes/invite';
import { activityRouter } from './routes/activity';
import { secretaryRouter } from './routes/secretary';
import { zoomRouter } from './routes/zoom';
import { dealRouter } from './routes/deal';
import { aiChatRouter } from './routes/aiChat';
import { aiBioRouter } from './routes/aiBio';
import { twilioRouter } from './routes/twilio';
import { whatsappRouter } from './routes/whatsapp';
import { gupshupRouter } from './routes/gupshup';
import { calendarRouter } from './routes/calendar';
import { agentChatRouter } from './routes/agent-chat';
import { healthRouter } from './routes/health';
import { subscriptionRouter } from './routes/subscription';
import { webhookRouter } from './routes/resendWebhook';
import { introTemplateRouter } from './routes/introTemplate';
import { investorRouter } from './routes/investor';
import { introTemplateService } from './services/introTemplateService';
import { matchScheduler } from './services/matchScheduler';
import { agentScheduler } from './services/agentScheduler';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

const app = express();
app.set('trust proxy', 1);

app.use((req, res, next) => {
  const host = (req.headers.host || '').toLowerCase();
  const isLegacyHost = host.includes('boardy-ai-platform') || host.endsWith('.replit.app');
  const isHealthCheck = req.path === '/api/health' || req.path === '/health';
  if (isLegacyHost && !isHealthCheck) {
    const target = `https://cleya.ai${req.originalUrl}`;
    return res.redirect(301, target);
  }
  next();
});

const ALLOWED_HOSTS = [
  env.FRONTEND_URL,
  env.CORS_ORIGIN,
  'https://cleya.ai',
  'https://www.cleya.ai',
].filter(Boolean) as string[];

const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN;
const REPLIT_DOMAINS = process.env.REPLIT_DOMAINS;
const BACKEND_URL = process.env.BACKEND_URL;

if (REPLIT_DEV_DOMAIN) ALLOWED_HOSTS.push(`https://${REPLIT_DEV_DOMAIN}`);
if (BACKEND_URL) ALLOWED_HOSTS.push(BACKEND_URL);
if (REPLIT_DOMAINS) {
  REPLIT_DOMAINS.split(',').forEach(d => {
    const trimmed = d.trim();
    if (trimmed) ALLOWED_HOSTS.push(`https://${trimmed}`);
  });
}

const allowedOrigins = new Set(ALLOWED_HOSTS);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    // Preserve raw body for webhook signature verification.
    // Routes that use HMAC over the exact request bytes:
    //   - /api/subscription/webhook        Razorpay
    //   - /api/webhooks/resend             Resend (svix)
    //   - /api/gupshup/meta-webhook        Meta WhatsApp Cloud API
    const url = req.originalUrl || '';
    if (
      url.startsWith('/api/subscription/webhook') ||
      url.startsWith('/api/webhooks/resend') ||
      url.startsWith('/api/gupshup/meta-webhook') ||
      url.startsWith('/api/inbound/email')
    ) {
      req.rawBody = buf.toString();
    }
  },
}));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api/auth', authRouter);
app.use('/api/contact', contactRouter);
app.use('/api/users', userRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/matches', matchRouter);
app.use('/api/match', matchActionRouter);
app.use('/api/inbound', inboundEmailRouter);
app.use('/api/calls', callRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/search', searchRouter);
app.use('/api/admin', adminRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/events', eventRouter);
app.use('/api/introductions/templates', introTemplateRouter);
app.use('/api/introductions', introductionRouter);
app.use('/api/meetings', meetingRouter);
app.use('/api/messaging', messagingRouter);
app.use('/api/referrals', referralRouter);
app.use('/api/referral', affiliateReferralRouter);
app.use('/api/verification', verificationRouter);
app.use('/api/direct-messages', directMessageRouter);
app.use('/api/dm', directMessageRouter);
app.use('/api/reports', reportRouter);
app.use('/api/blocks', blockRouter);
app.use('/api/cookie-consent', cookieConsentRouter);
app.use('/api/invites', inviteRouter);
app.use('/api/activity', activityRouter);
app.use('/api/secretary', secretaryRouter);
app.use('/api/zoom', zoomRouter);
app.use('/api/deals', dealRouter);
app.use('/api/ai-chat', aiChatRouter);
app.use('/api/ai', aiBioRouter);
app.use('/api/twilio', twilioRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/gupshup', gupshupRouter);
app.use('/api/calendar', calendarRouter);
app.use('/api/agent-chat', agentChatRouter);
app.use('/api/health', healthRouter);
app.use('/api/subscription', subscriptionRouter);
app.use('/api/webhooks', webhookRouter);
app.use('/api/investors', investorRouter);

if (env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(errorHandler);

const PORT = env.PORT;
const server = createServer(app);
setupWebSocket(server);

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Cleya.ai backend running on port ${PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  matchScheduler.start();
  introTemplateService.ensureDefaultsSeeded().catch(err =>
    console.error('[IntroTemplate] Seeding failed:', err)
  );
  agentScheduler.start().catch(err =>
    console.error('[AgentScheduler] Failed to start:', err)
  );

  // Drip sequence processor — runs every hour
  const cron = await import('node-cron');
  const { processDripSequences } = await import('./services/dripSequenceProcessor');
  cron.default.schedule('0 * * * *', async () => {
    console.log('[Drip] Processing follow-up sequences...');
    await processDripSequences().catch(err =>
      console.error('[Drip] Processing failed:', err)
    );
  }, { timezone: 'Asia/Kolkata' });
  console.log('[Drip] Hourly drip sequence processor registered');
});

export default app;
