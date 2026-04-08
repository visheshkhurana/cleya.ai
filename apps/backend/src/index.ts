import { initSentry } from './lib/sentry';
initSentry();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import * as Sentry from '@sentry/node';
import { env } from './config/env';
import { prisma } from '@cleya/db';
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
import { agentChatRouter } from './routes/agent-chat';
import { twilioRouter } from './routes/twilio';
import { whatsappRouter } from './routes/whatsapp';
import { gupshupRouter } from './routes/gupshup';
import { calendarRouter } from './routes/calendar';
import { matchScheduler } from './services/matchScheduler';
import { closeAllWebSocketConnections } from './websocket/server';
import { healthRouter } from './routes/health';
import { metricsMiddleware } from './middleware/metricsMiddleware';
import { logger } from './lib/logger';

const app = express();

app.set('trust proxy', 1);

const allowedOrigins = new Set(
  [env.FRONTEND_URL, env.CORS_ORIGIN].filter(Boolean)
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
  xContentTypeOptions: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xXssProtection: true,
  hsts: {
    maxAge: 63072000,
    includeSubDomains: true,
    preload: true,
  },
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));

app.use((_req, res, next) => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (_req.path.startsWith('/api/')) {
    res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  }
  next();
});

app.use(compression());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(metricsMiddleware);

app.use('/api/health', healthRouter);
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
app.use('/api/agents', agentChatRouter);
app.use('/api/twilio', twilioRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/gupshup', gupshupRouter);
app.use('/api/calendar', calendarRouter);

if (env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}
app.use(errorHandler);

const PORT = env.PORT;
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Cleya.ai backend running on port ${PORT}`, {
    port: PORT,
    environment: env.NODE_ENV,
  });
  matchScheduler.start();
});

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  matchScheduler.stop();
  logger.info('Cron jobs stopped');

  const forceExitTimer = setTimeout(() => {
    logger.error('Forced exit after timeout');
    process.exit(1);
  }, 10000);
  forceExitTimer.unref();

  try {
    await closeAllWebSocketConnections();
    logger.info('WebSocket connections drained');
  } catch {
    logger.error('Error draining WebSocket connections');
  }

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    logger.info('HTTP server closed');
  } catch {
    logger.error('Error closing HTTP server');
  }

  try {
    await prisma.$disconnect();
    logger.info('Database connections closed');
  } catch {
    logger.error('Error disconnecting database');
  }

  logger.info('Cleanup complete, exiting');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
