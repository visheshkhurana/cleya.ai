"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiRateLimiter = aiRateLimiter;
exports.attachUserTier = attachUserTier;
const aiAuditService_1 = require("../services/aiAuditService");
const TIER_LIMITS = {
    FREE: { perMinute: 10, perHour: 100, perDay: 1000 },
    PRO: { perMinute: 60, perHour: 1000, perDay: 10000 },
    ENTERPRISE: { perMinute: 120, perHour: 5000, perDay: 50000 },
};
const userBuckets = new Map();
const CLEANUP_INTERVAL = 10 * 60 * 1000;
setInterval(() => {
    const now = Date.now();
    for (const [key, buckets] of userBuckets.entries()) {
        if (buckets.day.resetAt < now) {
            userBuckets.delete(key);
        }
    }
}, CLEANUP_INTERVAL);
function getBuckets(userId) {
    const now = Date.now();
    let buckets = userBuckets.get(userId);
    if (!buckets) {
        buckets = {
            minute: { count: 0, resetAt: now + 60_000 },
            hour: { count: 0, resetAt: now + 3_600_000 },
            day: { count: 0, resetAt: now + 86_400_000 },
        };
        userBuckets.set(userId, buckets);
        return buckets;
    }
    if (now >= buckets.minute.resetAt) {
        buckets.minute = { count: 0, resetAt: now + 60_000 };
    }
    if (now >= buckets.hour.resetAt) {
        buckets.hour = { count: 0, resetAt: now + 3_600_000 };
    }
    if (now >= buckets.day.resetAt) {
        buckets.day = { count: 0, resetAt: now + 86_400_000 };
    }
    return buckets;
}
function aiRateLimiter(req, res, next) {
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).json({
            success: false,
            error: { message: 'Authentication required', code: 'UNAUTHORIZED' },
        });
        return;
    }
    const tier = req.userTier || 'FREE';
    const limits = TIER_LIMITS[tier];
    const buckets = getBuckets(userId);
    buckets.minute.count++;
    buckets.hour.count++;
    buckets.day.count++;
    const rateLimitResponse = (message, retryAfter) => {
        (0, aiAuditService_1.logAIInteraction)({
            userId,
            endpoint: req.originalUrl,
            inputLength: req.body?.message?.length || 0,
            outputLength: 0,
            latencyMs: 0,
            success: false,
            errorMessage: `Rate limited: ${message}`,
            userTier: tier,
        }).catch(() => { });
        res.set('Retry-After', String(retryAfter));
        res.status(429).json({
            success: false,
            error: { message, code: 'AI_RATE_LIMITED', retryAfter },
        });
    };
    if (buckets.minute.count > limits.perMinute) {
        const retryAfter = Math.ceil((buckets.minute.resetAt - Date.now()) / 1000);
        rateLimitResponse(`AI rate limit exceeded. Max ${limits.perMinute} requests per minute for ${tier} tier.`, retryAfter);
        return;
    }
    if (buckets.hour.count > limits.perHour) {
        const retryAfter = Math.ceil((buckets.hour.resetAt - Date.now()) / 1000);
        rateLimitResponse(`AI rate limit exceeded. Max ${limits.perHour} requests per hour for ${tier} tier.`, retryAfter);
        return;
    }
    if (buckets.day.count > limits.perDay) {
        const retryAfter = Math.ceil((buckets.day.resetAt - Date.now()) / 1000);
        rateLimitResponse(`AI rate limit exceeded. Max ${limits.perDay} requests per day for ${tier} tier.`, retryAfter);
        return;
    }
    next();
}
function attachUserTier(req, _res, next) {
    req.userTier = req.userTier || 'FREE';
    next();
}
//# sourceMappingURL=aiRateLimit.js.map