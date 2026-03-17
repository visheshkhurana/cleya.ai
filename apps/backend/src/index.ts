import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer } from 'http';
import { env } from './config/env';
import { setupWebSocket } from './websocket/server';
import { authRouter } from './routes/auth';
import { userRouter } from './routes/user';
import { conversationRouter } from './routes/conversation';
import { matchRouter } from './routes/match';
import { callRouter } from './routes/call';
import { adminRouter } from './routes/admin';
import { notificationRouter } from './routes/notification';
import { errorHandler } from './middleware/errorHandler';

const app = express();
const server = createServer(app);

// --- Middleware ---
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));

// --- Health check ---
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API Routes ---
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/conversations', conversationRouter);
app.use('/api/matches', matchRouter);
app.use('/api/calls', callRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notificationRouter);

// --- Error handler ---
app.use(errorHandler);

// --- WebSocket ---
setupWebSocket(server);

// --- Start ---
server.listen(env.PORT, () => {
  console.log(`🚀 Boardy AI Backend running on port ${env.PORT}`);
  console.log(`🔌 WebSocket ready`);
  console.log(`📡 Environment: ${env.NODE_ENV}`);
});

export default app;
