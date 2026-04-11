"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityLogger = void 0;
exports.checkRepeatedAuthFailures = checkRepeatedAuthFailures;
exports.startLogRetentionJob = startLogRetentionJob;
const db_1 = require("@cleya/db");
const node_cron_1 = __importDefault(require("node-cron"));
const slackService_1 = require("./slackService");
function extractRequestInfo(req) {
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.ip ||
        'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return { ipAddress, userAgent };
}
async function writeLog(entry) {
    try {
        await db_1.prisma.securityLog.create({
            data: {
                userId: entry.userId ?? null,
                action: entry.action,
                result: entry.result,
                severity: entry.severity ?? 'INFO',
                ipAddress: entry.ipAddress ?? null,
                userAgent: entry.userAgent ?? null,
                metadata: entry.metadata ?? undefined,
            },
        });
    }
    catch (err) {
        console.error('[SecurityLogger] Failed to write audit log:', err);
    }
}
function toJsonValue(obj) {
    if (!obj)
        return undefined;
    return obj;
}
exports.securityLogger = {
    authEvent(req, action, result, userId, metadata) {
        const { ipAddress, userAgent } = extractRequestInfo(req);
        const severity = result === 'FAILURE' ? 'WARNING' : 'INFO';
        writeLog({ userId, action, result, severity, ipAddress, userAgent, metadata: toJsonValue(metadata) });
    },
    accessEvent(req, action, userId, metadata) {
        const { ipAddress, userAgent } = extractRequestInfo(req);
        writeLog({ userId, action, result: 'SUCCESS', severity: 'INFO', ipAddress, userAgent, metadata: toJsonValue(metadata) });
    },
    configEvent(req, action, userId, metadata) {
        const { ipAddress, userAgent } = extractRequestInfo(req);
        writeLog({ userId, action, result: 'SUCCESS', severity: 'WARNING', ipAddress, userAgent, metadata: toJsonValue(metadata) });
    },
    suspiciousEvent(req, action, metadata) {
        const { ipAddress, userAgent } = extractRequestInfo(req);
        const userId = req.user?.userId ?? null;
        const severity = action === 'REPEATED_AUTH_FAILURE' ? 'CRITICAL' : 'WARNING';
        writeLog({ userId, action, result: 'BLOCKED', severity, ipAddress, userAgent, metadata: toJsonValue(metadata) });
    },
};
const FAILED_LOGIN_THRESHOLD = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;
async function checkRepeatedAuthFailures(req, ipAddress) {
    try {
        const windowStart = new Date(Date.now() - FAILED_LOGIN_WINDOW_MS);
        const failedCount = await db_1.prisma.securityLog.count({
            where: {
                action: 'LOGIN_FAILURE',
                ipAddress,
                timestamp: { gte: windowStart },
            },
        });
        if (failedCount >= FAILED_LOGIN_THRESHOLD) {
            exports.securityLogger.suspiciousEvent(req, 'REPEATED_AUTH_FAILURE', {
                failedAttempts: failedCount,
                windowMinutes: FAILED_LOGIN_WINDOW_MS / 60000,
                ipAddress,
            });
            slackService_1.slackService.notifySecurityAlert('Repeated Authentication Failures', `>*IP:* ${ipAddress}\n>*Failed attempts:* ${failedCount} in the last 15 minutes`).catch((err) => {
                console.error('[SecurityLogger] Failed to send Slack alert:', err);
            });
        }
    }
    catch (err) {
        console.error('[SecurityLogger] Failed to check repeated auth failures:', err);
    }
}
function startLogRetentionJob() {
    node_cron_1.default.schedule('0 3 * * *', async () => {
        try {
            const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
            const deleted = await db_1.prisma.securityLog.deleteMany({
                where: { timestamp: { lt: cutoff } },
            });
            console.log(`[SecurityLogger] Retention cleanup: removed ${deleted.count} logs older than 90 days`);
        }
        catch (err) {
            console.error('[SecurityLogger] Retention cleanup failed:', err);
        }
    });
    console.log('[SecurityLogger] Log retention job scheduled (daily at 03:00)');
}
//# sourceMappingURL=securityLogger.js.map