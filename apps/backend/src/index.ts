import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';

import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { conversationRouter } from './routes/conversation';
import { matchRouter } from './routes/match';
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
import { verificationRouter } from './routes/verification';
import { directMessageRouter } from './routes/directMessage';
import { inviteRouter } from './routes/invite';
import { activityRouter } from './routes/activity';
import { secretaryRouter } from './routes/secretary';
import { zoomRouter } from './routes/zoom';
import { dealRouter } from './routes/deal';
import { aiChatRouter } from './routes/aiChat';
import { twilioRouter } from './routes/twilio';
import { whatsappRouter } from './routes/whatsapp';
import { gupshupRouter } from './routes/gupshup';
import { calendarRouter } from './routes/calendar';
import { matchScheduler } from './services/matchScheduler';
import { cleanupExpiredStates } from './services/calendarService';

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = new Set(
  [
    env.FRONTEND_URL,
    env.CORS_ORIGIN,
    'https://boardy-ai-platform.replit.app',
  ].filter(Boolean) as string[]
);

const REPLIT_DEV_DOMAIN = process.env.REPLIT_DEV_DOMAIN;
if (REPLIT_DEV_DOMAIN) {
  allowedOrigins.add(`https://${REPLIT_DEV_DOMAIN}`);
}

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
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/matches', matchRouter);
app.use('/api/calls', callRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/search', searchRouter);
app.use('/api/admin', adminRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/events', eventRouter);
app.use('/api/introductions', introductionRouter);
app.use('/api/meetings', meetingRouter);
app.use('/api/messaging', messagingRouter);
app.use('/api/referrals', referralRouter);
app.use('/api/verification', verificationRouter);
app.use('/api/direct-messages', directMessageRouter);
app.use('/api/invites', inviteRouter);
app.use('/api/activity', activityRouter);
app.use('/api/secretary', secretaryRouter);
app.use('/api/zoom', zoomRouter);
app.use('/api/deals', dealRouter);
app.use('/api/ai-chat', aiChatRouter);
app.use('/api/twilio', twilioRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/gupshup', gupshupRouter);
app.use('/api/calendar', calendarRouter);

if (env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(errorHandler);

if (!env.ZOOM_CLIENT_ID || !env.ZOOM_CLIENT_SECRET) {
  console.warn('⚠️  Zoom integration is not configured. Set ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET to enable Zoom meetings.');
  console.warn('   To set up: Create a General App in the Zoom Marketplace (https://marketplace.zoom.us/)');
  console.warn('   Required scopes: meeting:write:meeting');
  console.warn('   Redirect URL: <BACKEND_URL>/api/zoom/callback');
}

if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
  console.warn('⚠️  Google Calendar integration is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.');
} else {
  const expectedRedirectUri = `${env.BACKEND_URL}/api/calendar/callback`;
  if (env.GOOGLE_REDIRECT_URI !== expectedRedirectUri) {
    console.warn(`⚠️  GOOGLE_REDIRECT_URI mismatch: configured as "${env.GOOGLE_REDIRECT_URI}" but expected "${expectedRedirectUri}". OAuth callbacks may fail if these don't match.`);
  }
}

cleanupExpiredStates().catch(err => console.error('Failed to clean up expired OAuth states:', err));
setInterval(() => {
  cleanupExpiredStates().catch(err => console.error('Failed to clean up expired OAuth states:', err));
}, 60 * 60 * 1000);

const PORT = env.PORT;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Cleya.ai backend running on port ${PORT}`);
  console.log(`   Environment: ${env.NODE_ENV}`);
  matchScheduler.start();
});

export default app;
