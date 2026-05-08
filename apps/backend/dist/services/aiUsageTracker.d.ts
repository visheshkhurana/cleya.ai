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
declare class AIUsageTracker {
    private upsertBucket;
    recordSuccess(provider: string, model: string, usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    }): void;
    recordError(provider: string, model: string): void;
}
export declare const aiUsageTracker: AIUsageTracker;
/**
 * Bind the tracker to the @cleya/ai package's pluggable usage callback.
 * We do this here (in the backend) rather than inside the AI package to
 * avoid a circular dep — the AI package can't import `@cleya/db`. Call
 * once at boot from `apps/backend/src/index.ts`.
 */
export declare function installAIUsageTracking(): void;
export {};
//# sourceMappingURL=aiUsageTracker.d.ts.map