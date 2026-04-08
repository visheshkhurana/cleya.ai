import { Request } from 'express';
import { prisma } from '@cleya/db';
import type { SecurityAction, SecurityResult, SecuritySeverity, Prisma } from '@cleya/db';
import cron from 'node-cron';
import { slackService } from './slackService';

interface SecurityLogEntry {
  userId?: string | null;
  action: SecurityAction;
  result: SecurityResult;
  severity?: SecuritySeverity;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
}

function extractRequestInfo(req: Request): { ipAddress: string; userAgent: string } {
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown';
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';
  return { ipAddress, userAgent };
}

async function writeLog(entry: SecurityLogEntry): Promise<void> {
  try {
    await prisma.securityLog.create({
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
  } catch (err) {
    console.error('[SecurityLogger] Failed to write audit log:', err);
  }
}

function toJsonValue(obj?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!obj) return undefined;
  return obj as Prisma.InputJsonValue;
}

export const securityLogger = {
  authEvent(
    req: Request,
    action: SecurityAction,
    result: SecurityResult,
    userId?: string | null,
    metadata?: Record<string, unknown>
  ) {
    const { ipAddress, userAgent } = extractRequestInfo(req);
    const severity: SecuritySeverity =
      result === 'FAILURE' ? 'WARNING' : 'INFO';
    writeLog({ userId, action, result, severity, ipAddress, userAgent, metadata: toJsonValue(metadata) });
  },

  accessEvent(
    req: Request,
    action: SecurityAction,
    userId: string,
    metadata?: Record<string, unknown>
  ) {
    const { ipAddress, userAgent } = extractRequestInfo(req);
    writeLog({ userId, action, result: 'SUCCESS', severity: 'INFO', ipAddress, userAgent, metadata: toJsonValue(metadata) });
  },

  configEvent(
    req: Request,
    action: SecurityAction,
    userId: string,
    metadata?: Record<string, unknown>
  ) {
    const { ipAddress, userAgent } = extractRequestInfo(req);
    writeLog({ userId, action, result: 'SUCCESS', severity: 'WARNING', ipAddress, userAgent, metadata: toJsonValue(metadata) });
  },

  suspiciousEvent(
    req: Request,
    action: SecurityAction,
    metadata?: Record<string, unknown>
  ) {
    const { ipAddress, userAgent } = extractRequestInfo(req);
    const userId = req.user?.userId ?? null;
    const severity: SecuritySeverity =
      action === 'REPEATED_AUTH_FAILURE' ? 'CRITICAL' : 'WARNING';
    writeLog({ userId, action, result: 'BLOCKED', severity, ipAddress, userAgent, metadata: toJsonValue(metadata) });
  },
};

const FAILED_LOGIN_THRESHOLD = 5;
const FAILED_LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function checkRepeatedAuthFailures(
  req: Request,
  ipAddress: string
): Promise<void> {
  try {
    const windowStart = new Date(Date.now() - FAILED_LOGIN_WINDOW_MS);
    const failedCount = await prisma.securityLog.count({
      where: {
        action: 'LOGIN_FAILURE',
        ipAddress,
        timestamp: { gte: windowStart },
      },
    });
    if (failedCount >= FAILED_LOGIN_THRESHOLD) {
      securityLogger.suspiciousEvent(req, 'REPEATED_AUTH_FAILURE', {
        failedAttempts: failedCount,
        windowMinutes: FAILED_LOGIN_WINDOW_MS / 60000,
        ipAddress,
      });
      slackService.notifySecurityAlert(
        'Repeated Authentication Failures',
        `>*IP:* ${ipAddress}\n>*Failed attempts:* ${failedCount} in the last 15 minutes`
      ).catch((err) => {
        console.error('[SecurityLogger] Failed to send Slack alert:', err);
      });
    }
  } catch (err) {
    console.error('[SecurityLogger] Failed to check repeated auth failures:', err);
  }
}

export function startLogRetentionJob(): void {
  cron.schedule('0 3 * * *', async () => {
    try {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const deleted = await prisma.securityLog.deleteMany({
        where: { timestamp: { lt: cutoff } },
      });
      console.log(`[SecurityLogger] Retention cleanup: removed ${deleted.count} logs older than 90 days`);
    } catch (err) {
      console.error('[SecurityLogger] Retention cleanup failed:', err);
    }
  });
  console.log('[SecurityLogger] Log retention job scheduled (daily at 03:00)');
}
