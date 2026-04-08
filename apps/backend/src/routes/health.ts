import { Router, Request, Response } from 'express';
import { prisma } from '@cleya/db';
import { logger } from '../lib/logger';
import { recordEvent } from '../lib/alertRules';

export const healthRouter = Router();

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  latencyMs?: number;
}

async function checkDatabase(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (err: any) {
    recordEvent('database_errors');
    return { status: 'unhealthy', message: err.message, latencyMs: Date.now() - start };
  }
}

async function checkRedis(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const Redis = require('ioredis');
    const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      connectTimeout: 3000,
      lazyConnect: true,
    });
    await redis.connect();
    const pong = await redis.ping();
    await redis.quit();
    if (pong === 'PONG') {
      return { status: 'healthy', latencyMs: Date.now() - start };
    }
    return { status: 'degraded', message: 'Unexpected ping response', latencyMs: Date.now() - start };
  } catch (err: any) {
    return { status: 'degraded', message: 'Redis unavailable', latencyMs: Date.now() - start };
  }
}

function checkMemory(): HealthCheckResult {
  const usage = process.memoryUsage();
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024);
  const rssMB = Math.round(usage.rss / 1024 / 1024);
  const heapPercent = Math.round((usage.heapUsed / usage.heapTotal) * 100);

  if (heapPercent > 90) {
    return { status: 'unhealthy', message: `Heap usage at ${heapPercent}% (${heapUsedMB}MB / ${heapTotalMB}MB, RSS: ${rssMB}MB)` };
  }
  if (heapPercent > 75) {
    return { status: 'degraded', message: `Heap usage at ${heapPercent}% (${heapUsedMB}MB / ${heapTotalMB}MB, RSS: ${rssMB}MB)` };
  }
  return { status: 'healthy', message: `Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${heapPercent}%), RSS: ${rssMB}MB` };
}

async function checkAI(): Promise<HealthCheckResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { status: 'degraded', message: 'OpenAI API key not configured' };
  }
  return { status: 'healthy', message: 'AI provider configured' };
}

healthRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const [db, redis, memory, ai] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      Promise.resolve(checkMemory()),
      checkAI(),
    ]);

    const checks = { db, redis, memory, ai };
    const allHealthy = Object.values(checks).every(c => c.status === 'healthy');
    const anyUnhealthy = Object.values(checks).some(c => c.status === 'unhealthy');

    const overallStatus = anyUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded';
    const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;

    res.status(httpStatus).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: Math.round(process.uptime()),
      checks,
    });
  } catch (err: any) {
    logger.error('Health check failed', { error: err.message });
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

healthRouter.get('/db', async (_req: Request, res: Response) => {
  const result = await checkDatabase();
  res.status(result.status === 'unhealthy' ? 503 : 200).json(result);
});

healthRouter.get('/redis', async (_req: Request, res: Response) => {
  const result = await checkRedis();
  res.status(result.status === 'unhealthy' ? 503 : 200).json(result);
});

healthRouter.get('/ai', async (_req: Request, res: Response) => {
  const result = await checkAI();
  res.status(result.status === 'unhealthy' ? 503 : 200).json(result);
});
