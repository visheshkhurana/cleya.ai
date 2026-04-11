"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAdminAction = logAdminAction;
exports.getAuditLogs = getAuditLogs;
const db_1 = require("@cleya/db");
function extractRequestInfo(req) {
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
        req.ip ||
        'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return { ipAddress, userAgent };
}
async function logAdminAction(req, action, options = {}) {
    try {
        const { ipAddress, userAgent } = extractRequestInfo(req);
        await db_1.prisma.adminAuditLog.create({
            data: {
                actorId: req.user.userId,
                action,
                targetId: options.targetId ?? null,
                metadata: options.metadata ? options.metadata : undefined,
                ipAddress,
                userAgent,
            },
        });
    }
    catch (err) {
        console.error('[AuditLogger] Failed to write audit log:', err);
    }
}
async function getAuditLogs(options) {
    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;
    const where = {};
    if (options.action)
        where.action = options.action;
    if (options.actorId)
        where.actorId = options.actorId;
    if (options.targetId)
        where.targetId = options.targetId;
    const [logs, total] = await Promise.all([
        db_1.prisma.adminAuditLog.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            skip,
            take: limit,
            include: {
                actor: { select: { id: true, email: true, name: true, role: true } },
                target: { select: { id: true, email: true, name: true, role: true } },
            },
        }),
        db_1.prisma.adminAuditLog.count({ where }),
    ]);
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
}
//# sourceMappingURL=auditLogger.js.map