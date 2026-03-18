import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { env } from './config/env';
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

const app = express();
app.set('trust proxy', 1);
const server = createServer(app);

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api', generalLimiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: env.NODE_ENV });
});

app.get('/api/csrf-token', csrfTokenProvider);

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

app.use(errorHandler);

setupWebSocket(server);

server.listen(env.PORT, async () => {
  console.log(`Cleo.ai Backend running on port ${env.PORT}`);
  console.log(`WebSocket ready`);
  console.log(`Environment: ${env.NODE_ENV}`);
  await seedDatabase();
});
