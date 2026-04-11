"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const db_1 = require("@cleya/db");
const logger_1 = require("../lib/logger");
const alertRules_1 = require("../lib/alertRules");
exports.healthRouter = (0, express_1.Router)();
async function checkDatabase() {
    const start = Date.now();
    try {
        await db_1.prisma.$queryRaw `SELECT 1`;
        return { status: 'healthy', latencyMs: Date.now() - start };
    }
    catch (err) {
        (0, alertRules_1.recordEvent)('database_errors');
        return { status: 'unhealthy', message: err.message, latencyMs: Date.now() - start };
    }
}
async function checkRedis() {
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
    }
    catch (err) {
        return { status: 'degraded', message: 'Redis unavailable', latencyMs: Date.now() - start };
    }
}
function checkMemory() {
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
async function checkAI() {
    if (!process.env.OPENAI_API_KEY) {
        return { status: 'degraded', message: 'OpenAI API key not configured' };
    }
    return { status: 'healthy', message: 'AI provider configured' };
}
exports.healthRouter.get('/', async (_req, res) => {
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
    }
    catch (err) {
        logger_1.logger.error('Health check failed', { error: err.message });
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed',
        });
    }
});
exports.healthRouter.get('/db', async (_req, res) => {
    const result = await checkDatabase();
    res.status(result.status === 'unhealthy' ? 503 : 200).json(result);
});
exports.healthRouter.get('/redis', async (_req, res) => {
    const result = await checkRedis();
    res.status(result.status === 'unhealthy' ? 503 : 200).json(result);
});
exports.healthRouter.get('/ai', async (_req, res) => {
    const result = await checkAI();
    res.status(result.status === 'unhealthy' ? 503 : 200).json(result);
});
//# sourceMappingURL=health.js.map