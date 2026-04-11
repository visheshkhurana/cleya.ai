"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAIInteraction = logAIInteraction;
exports.trackUsageAndAlert = trackUsageAndAlert;
const db_1 = require("@cleya/db");
const DAILY_REQUEST_THRESHOLD = 5000;
const DAILY_TOKEN_THRESHOLD = 2_000_000;
async function logAIInteraction(entry) {
    try {
        await db_1.prisma.aIAuditLog.create({
            data: {
                userId: entry.userId,
                endpoint: entry.endpoint,
                provider: entry.provider || 'openai',
                model: entry.model || 'gpt-4o-mini',
                inputLength: entry.inputLength,
                outputLength: entry.outputLength,
                promptTokens: entry.promptTokens,
                completionTokens: entry.completionTokens,
                totalTokens: entry.totalTokens,
                latencyMs: entry.latencyMs,
                promptInjectionDetected: entry.promptInjectionDetected || false,
                piiRedacted: entry.piiRedacted || false,
                redactionDetails: entry.redactionDetails || [],
                outputTruncated: entry.outputTruncated || false,
                agentId: entry.agentId,
                userTier: entry.userTier || 'FREE',
                success: entry.success !== false,
                errorMessage: entry.errorMessage,
                inputContent: entry.inputContent ? entry.inputContent.substring(0, 10000) : undefined,
                outputContent: entry.outputContent ? entry.outputContent.substring(0, 10000) : undefined,
            },
        });
    }
    catch (err) {
        console.error('[AI_AUDIT] Failed to log AI interaction:', err);
    }
}
async function trackUsageAndAlert(provider, model, tokens, isError = false) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const usage = await db_1.prisma.aIUsageDaily.upsert({
            where: {
                date_provider_model: {
                    date: today,
                    provider,
                    model,
                },
            },
            create: {
                date: today,
                provider,
                model,
                requestCount: 1,
                totalTokens: tokens.totalTokens || 0,
                promptTokens: tokens.promptTokens || 0,
                completionTokens: tokens.completionTokens || 0,
                errorCount: isError ? 1 : 0,
            },
            update: {
                requestCount: { increment: 1 },
                totalTokens: { increment: tokens.totalTokens || 0 },
                promptTokens: { increment: tokens.promptTokens || 0 },
                completionTokens: { increment: tokens.completionTokens || 0 },
                errorCount: isError ? { increment: 1 } : undefined,
            },
        });
        if (!usage.alertSent && (usage.requestCount >= DAILY_REQUEST_THRESHOLD || usage.totalTokens >= DAILY_TOKEN_THRESHOLD)) {
            console.warn(`[AI_USAGE_ALERT] High usage detected for ${provider}/${model}: ${usage.requestCount} requests, ${usage.totalTokens} tokens`);
            await db_1.prisma.aIUsageDaily.update({
                where: { id: usage.id },
                data: { alertSent: true },
            });
            try {
                const adminUsers = await db_1.prisma.user.findMany({
                    where: { role: 'ADMIN' },
                    select: { id: true },
                });
                for (const admin of adminUsers) {
                    await db_1.prisma.notification.create({
                        data: {
                            userId: admin.id,
                            channel: 'IN_APP',
                            event: 'MATCH_FOUND',
                            title: 'AI Usage Alert',
                            body: `High AI usage detected: ${provider}/${model} — ${usage.requestCount} requests, ${usage.totalTokens} tokens today. Please review.`,
                            metadata: {
                                type: 'ai_usage_alert',
                                provider,
                                model,
                                requestCount: usage.requestCount,
                                totalTokens: usage.totalTokens,
                            },
                        },
                    });
                }
            }
            catch (notifErr) {
                console.error('[AI_USAGE_ALERT] Failed to send notification:', notifErr);
            }
        }
    }
    catch (err) {
        console.error('[AI_USAGE] Failed to track usage:', err);
    }
}
//# sourceMappingURL=aiAuditService.js.map