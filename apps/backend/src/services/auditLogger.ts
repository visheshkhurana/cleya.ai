import { Request } from 'express';
import { prisma } from '@cleya/db';

function extractRequestInfo(req: Request): { ipAddress: string; userAgent: string } {
  const ipAddress =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown';
  const userAgent = (req.headers['user-agent'] as string) || 'unknown';
  return { ipAddress, userAgent };
}

export async function logAdminAction(
  req: Request,
  action: string,
  options: {
    targetId?: string;
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  try {
    const { ipAddress, userAgent } = extractRequestInfo(req);
    await prisma.adminAuditLog.create({
      data: {
        actorId: req.user!.userId,
        action,
        targetId: options.targetId ?? null,
        metadata: options.metadata ? (options.metadata as any) : undefined,
        ipAddress,
        userAgent,
      },
    });
  } catch (err) {
    console.error('[AuditLogger] Failed to write audit log:', err);
  }
}

export async function getAuditLogs(options: {
  page?: number;
  limit?: number;
  action?: string;
  actorId?: string;
  targetId?: string;
}) {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (options.action) where.action = options.action;
  if (options.actorId) where.actorId = options.actorId;
  if (options.targetId) where.targetId = options.targetId;

  const [logs, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
      include: {
        actor: { select: { id: true, email: true, name: true, role: true } },
        target: { select: { id: true, email: true, name: true, role: true } },
      },
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}
