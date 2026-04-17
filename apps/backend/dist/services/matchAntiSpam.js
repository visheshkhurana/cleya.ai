"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ANTI_SPAM = exports.ANTI_SPAM_DEFAULTS = void 0;
exports.getThrottleConfig = getThrottleConfig;
exports.invalidateThrottleConfigCache = invalidateThrottleConfigCache;
exports.updateThrottleConfig = updateThrottleConfig;
exports.checkProposalGuardrails = checkProposalGuardrails;
exports.evaluateNotificationPolicy = evaluateNotificationPolicy;
exports.recordMatchNotification = recordMatchNotification;
const db_1 = require("@cleya/db");
const num = (v, d) => {
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : d;
};
exports.ANTI_SPAM_DEFAULTS = {
    dailyProposalCap: num(process.env.MATCH_DAILY_PROPOSAL_CAP, 3),
    proposalCooldownHours: num(process.env.MATCH_PROPOSAL_COOLDOWN_MS_HOURS, 4),
    dailyNotificationCap: num(process.env.MATCH_DAILY_NOTIFICATION_CAP, 5),
    quietHoursStart: num(process.env.MATCH_QUIET_HOURS_START, 22),
    quietHoursEnd: num(process.env.MATCH_QUIET_HOURS_END, 8),
};
exports.ANTI_SPAM = {
    ...exports.ANTI_SPAM_DEFAULTS,
    proposalCooldownMs: exports.ANTI_SPAM_DEFAULTS.proposalCooldownHours * 60 * 60 * 1000,
    defaultTimezone: process.env.MATCH_DEFAULT_TIMEZONE || 'Asia/Kolkata',
};
const CACHE_TTL_MS = 30 * 1000;
let cached = null;
function fromDefaults() {
    return {
        dailyProposalCap: exports.ANTI_SPAM_DEFAULTS.dailyProposalCap,
        proposalCooldownHours: exports.ANTI_SPAM_DEFAULTS.proposalCooldownHours,
        proposalCooldownMs: exports.ANTI_SPAM_DEFAULTS.proposalCooldownHours * 60 * 60 * 1000,
        dailyNotificationCap: exports.ANTI_SPAM_DEFAULTS.dailyNotificationCap,
        quietHoursStart: exports.ANTI_SPAM_DEFAULTS.quietHoursStart,
        quietHoursEnd: exports.ANTI_SPAM_DEFAULTS.quietHoursEnd,
        defaultTimezone: exports.ANTI_SPAM.defaultTimezone,
        updatedAt: null,
        updatedBy: null,
    };
}
async function getThrottleConfig(force = false) {
    if (!force && cached && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
        return cached.value;
    }
    try {
        const row = await db_1.prisma.matchThrottleConfig.findUnique({ where: { id: 'default' } });
        const value = row
            ? {
                dailyProposalCap: row.dailyProposalCap,
                proposalCooldownHours: row.proposalCooldownHours,
                proposalCooldownMs: row.proposalCooldownHours * 60 * 60 * 1000,
                dailyNotificationCap: row.dailyNotificationCap,
                quietHoursStart: row.quietHoursStart,
                quietHoursEnd: row.quietHoursEnd,
                defaultTimezone: exports.ANTI_SPAM.defaultTimezone,
                updatedAt: row.updatedAt,
                updatedBy: row.updatedBy,
            }
            : fromDefaults();
        cached = { value, loadedAt: Date.now() };
        return value;
    }
    catch (e) {
        console.log('[MatchAntiSpam] getThrottleConfig failed, using defaults:', e.message);
        const value = fromDefaults();
        cached = { value, loadedAt: Date.now() };
        return value;
    }
}
function invalidateThrottleConfigCache() {
    cached = null;
}
async function updateThrottleConfig(patch, actorId) {
    const current = await getThrottleConfig(true);
    const next = {
        dailyProposalCap: patch.dailyProposalCap ?? current.dailyProposalCap,
        proposalCooldownHours: patch.proposalCooldownHours ?? current.proposalCooldownHours,
        dailyNotificationCap: patch.dailyNotificationCap ?? current.dailyNotificationCap,
        quietHoursStart: patch.quietHoursStart ?? current.quietHoursStart,
        quietHoursEnd: patch.quietHoursEnd ?? current.quietHoursEnd,
    };
    await db_1.prisma.matchThrottleConfig.upsert({
        where: { id: 'default' },
        create: { id: 'default', ...next, updatedBy: actorId ?? null },
        update: { ...next, updatedBy: actorId ?? null },
    });
    invalidateThrottleConfigCache();
    return getThrottleConfig(true);
}
function startOfLocalDayMs(timezone) {
    try {
        const fmt = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
        const parts = fmt.formatToParts(new Date());
        const get = (t) => parts.find(p => p.type === t)?.value ?? '00';
        const localMs = Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')), 0, 0, 0, 0);
        const observedUtc = Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')), Number(get('hour') === '24' ? '0' : get('hour')), Number(get('minute')), Number(get('second')));
        const offsetMs = observedUtc - Date.now();
        return localMs - offsetMs;
    }
    catch {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }
}
const serverStartOfDayMs = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
};
async function userProposalStats(userId) {
    const since = new Date(serverStartOfDayMs());
    const [todayCount, lastMatch] = await Promise.all([
        db_1.prisma.match.count({
            where: {
                OR: [{ userAId: userId }, { userBId: userId }],
                createdAt: { gte: since },
            },
        }),
        db_1.prisma.match.findFirst({
            where: { OR: [{ userAId: userId }, { userBId: userId }] },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
        }),
    ]);
    return { todayCount, lastMatchAt: lastMatch?.createdAt ?? null };
}
async function checkProposalGuardrails(userAId, userBId) {
    const cfg = await getThrottleConfig();
    for (const userId of [userAId, userBId]) {
        const { todayCount, lastMatchAt } = await userProposalStats(userId);
        if (todayCount >= cfg.dailyProposalCap) {
            return { allowed: false, reason: 'DAILY_CAP', blockingUserId: userId };
        }
        if (lastMatchAt &&
            Date.now() - lastMatchAt.getTime() < cfg.proposalCooldownMs) {
            return { allowed: false, reason: 'COOLDOWN', blockingUserId: userId };
        }
    }
    return { allowed: true, reason: 'OK' };
}
function getUserHourInTz(timezone) {
    try {
        const fmt = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            hour12: false,
            timeZone: timezone,
        });
        const parts = fmt.formatToParts(new Date());
        const h = parts.find(p => p.type === 'hour')?.value ?? '0';
        const n = Number(h);
        return Number.isFinite(n) ? (n === 24 ? 0 : n) : new Date().getUTCHours();
    }
    catch {
        return new Date().getUTCHours();
    }
}
function parseHour(v, fallback) {
    if (!v)
        return fallback;
    const m = v.match(/^(\d{1,2})/);
    if (!m)
        return fallback;
    const h = Number(m[1]);
    return Number.isFinite(h) && h >= 0 && h < 24 ? h : fallback;
}
async function evaluateNotificationPolicy(userId) {
    const cfg = await getThrottleConfig();
    const pref = await db_1.prisma.communicationPreference.findUnique({
        where: { userId },
    });
    const timezone = pref?.timezone || cfg.defaultTimezone;
    const startH = parseHour(pref?.quietHoursStart, cfg.quietHoursStart);
    const endH = parseHour(pref?.quietHoursEnd, cfg.quietHoursEnd);
    const hour = getUserHourInTz(timezone);
    const inQuiet = startH === endH
        ? false
        : startH < endH
            ? hour >= startH && hour < endH
            : hour >= startH || hour < endH;
    const since = new Date(startOfLocalDayMs(timezone));
    const sentToday = await db_1.prisma.notification.count({
        where: {
            userId,
            event: 'MATCH_FOUND',
            sentAt: { gte: since },
        },
    });
    const overCap = sentToday >= cfg.dailyNotificationCap;
    return {
        inQuietHours: inQuiet,
        overDailyCap: overCap,
        shouldSend: !inQuiet && !overCap,
        reason: inQuiet ? 'QUIET_HOURS' : overCap ? 'DAILY_CAP' : undefined,
        hour,
        timezone,
    };
}
async function recordMatchNotification(userId, channel, matchId, body) {
    try {
        await db_1.prisma.notification.create({
            data: {
                userId,
                channel,
                event: 'MATCH_FOUND',
                title: 'New match',
                body,
                sentAt: new Date(),
                metadata: { matchId },
            },
        });
    }
    catch (e) {
        console.log('[MatchAntiSpam] Failed to log notification:', e.message);
    }
}
//# sourceMappingURL=matchAntiSpam.js.map