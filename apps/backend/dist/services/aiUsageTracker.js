"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiUsageTracker = void 0;
exports.installAIUsageTracking = installAIUsageTracking;
const db_1 = require("@cleya/db");
/**
 * Daily-bucket aggregator for LLM usage. The engagement audit found the
 * `ai_usage_daily` table empty over a 30-day window — this service is the
 * single writer the rest of the backend should call after every LLM
 * response (and on every LLM error).
 *
 * Aggregation strategy: one row per (date, provider, model) day-bucket,
 * upserted atomically with `prisma.aIUsageDaily.upsert`. We rely on the
 * `@@unique([date, provider, model])` index in the Prisma schema to keep
 * concurrent writers race-safe — the increment is performed by Postgres,
 * not by reading the row in JS first.
 *
 * All public methods are fire-and-forget: errors are caught and logged so
 * a tracker failure can never break a primary AI request.
 */
class AIUsageTracker {
    async upsertBucket(provider, model, increments) {
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0); // day-bucket key in UTC
        try {
            await db_1.prisma.aIUsageDaily.upsert({
                where: { date_provider_model: { date: today, provider, model } },
                update: {
                    requestCount: { increment: increments.requests },
                    promptTokens: { increment: increments.promptTokens },
                    completionTokens: { increment: increments.completionTokens },
                    totalTokens: { increment: increments.totalTokens },
                    errorCount: { increment: increments.errors },
                },
                create: {
                    date: today,
                    provider,
                    model,
                    requestCount: increments.requests,
                    promptTokens: increments.promptTokens,
                    completionTokens: increments.completionTokens,
                    totalTokens: increments.totalTokens,
                    errorCount: increments.errors,
                },
            });
        }
        catch (e) {
            console.log('[AIUsageTracker] upsert failed:', e.message);
        }
    }
    recordSuccess(provider, model, usage) {
        this.upsertBucket(provider, model, {
            requests: 1,
            promptTokens: usage?.promptTokens ?? 0,
            completionTokens: usage?.completionTokens ?? 0,
            totalTokens: usage?.totalTokens ?? 0,
            errors: 0,
        }).catch(() => { });
    }
    recordError(provider, model) {
        this.upsertBucket(provider, model, {
            requests: 1,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            errors: 1,
        }).catch(() => { });
    }
}
exports.aiUsageTracker = new AIUsageTracker();
/**
 * Bind the tracker to the @cleya/ai package's pluggable usage callback.
 * We do this here (in the backend) rather than inside the AI package to
 * avoid a circular dep — the AI package can't import `@cleya/db`. Call
 * once at boot from `apps/backend/src/index.ts`.
 */
function installAIUsageTracking() {
    // Defer the require so a circular import never blows up boot order.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ai = require('@cleya/ai');
    if (typeof ai.setUsageReporter === 'function') {
        ai.setUsageReporter({
            onSuccess: (provider, model, usage) => exports.aiUsageTracker.recordSuccess(provider, model, usage),
            onError: (provider, model) => exports.aiUsageTracker.recordError(provider, model),
        });
        console.log('[AIUsageTracker] Bound to @cleya/ai — daily usage will be persisted to ai_usage_daily');
    }
    else {
        console.log('[AIUsageTracker] @cleya/ai does not expose setUsageReporter — usage tracking disabled');
    }
}
//# sourceMappingURL=aiUsageTracker.js.map