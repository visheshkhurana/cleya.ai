"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkedinEnrichmentService = void 0;
const db_1 = require("@cleya/db");
const ai_1 = require("@cleya/ai");
const api_1 = require("@cleya/api");
const ai = (0, ai_1.createAIService)();
class LinkedinEnrichmentService {
    async enrichProfile(userId) {
        try {
            const profile = await db_1.prisma.profile.findUnique({
                where: { userId },
                select: {
                    linkedinUrl: true,
                    headline: true,
                    bio: true,
                    currentRole: true,
                    companyName: true,
                    industries: true,
                    skills: true,
                    persona: true,
                    extraData: true,
                },
            });
            if (!profile || !profile.linkedinUrl)
                return false;
            const existingExtra = profile.extraData || {};
            if (existingExtra.enrichedData?.enrichedAt) {
                const enrichedAt = new Date(existingExtra.enrichedData.enrichedAt);
                const daysSince = (Date.now() - enrichedAt.getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince < 30)
                    return false;
            }
            const enrichedData = await this.extractSignals(profile);
            if (!enrichedData)
                return false;
            const updatedExtra = {
                ...existingExtra,
                enrichedData: enrichedData,
            };
            await db_1.prisma.profile.update({
                where: { userId },
                data: { extraData: updatedExtra },
            });
            try {
                const fullProfile = await db_1.prisma.profile.findUnique({ where: { userId } });
                if (fullProfile) {
                    await (0, api_1.generateAndStoreEmbedding)(userId, fullProfile);
                    console.log(`[LinkedinEnrichment] Regenerated embedding for ${userId}`);
                }
            }
            catch (embErr) {
                console.error(`[LinkedinEnrichment] Embedding regeneration failed for ${userId}:`, embErr);
            }
            console.log(`[LinkedinEnrichment] Enriched profile for ${userId}`);
            return true;
        }
        catch (err) {
            console.error(`[LinkedinEnrichment] Failed to enrich ${userId}:`, err);
            return false;
        }
    }
    async extractSignals(profile) {
        try {
            const profileContext = [
                profile.headline && `Headline: ${profile.headline}`,
                profile.bio && `Bio: ${profile.bio}`,
                profile.currentRole && `Current Role: ${profile.currentRole}`,
                profile.companyName && `Company: ${profile.companyName}`,
                profile.industries.length > 0 && `Industries: ${profile.industries.join(', ')}`,
                profile.skills.length > 0 && `Skills: ${profile.skills.join(', ')}`,
                profile.persona && `Persona: ${profile.persona}`,
                profile.linkedinUrl && `LinkedIn: ${profile.linkedinUrl}`,
            ].filter(Boolean).join('\n');
            const response = await ai.chat([
                {
                    role: 'system',
                    content: `You are an expert at extracting structured professional signals from profile data. Given a professional's profile information (including their LinkedIn URL for context about their identity), extract structured career signals.

Return ONLY a valid JSON object with these fields:
- careerHistory: array of strings, each a brief career milestone (e.g., "VP Engineering at Flipkart (2018-2021)")
- domainExpertise: array of strings, specific domain expertise areas (e.g., "B2B SaaS GTM", "Seed-stage fintech investing")
- notableCompanies: array of strings, well-known companies they've been associated with
- exits: array of strings, any exits or liquidity events (e.g., "Acquired by Razorpay, 2022")

If information is not available for a field, use an empty array. Be conservative — only include what can be reasonably inferred from the provided data. Do not fabricate specific details.`,
                },
                {
                    role: 'user',
                    content: profileContext,
                },
            ]);
            const parsed = JSON.parse(response.content);
            return {
                careerHistory: Array.isArray(parsed.careerHistory) ? parsed.careerHistory : [],
                domainExpertise: Array.isArray(parsed.domainExpertise) ? parsed.domainExpertise : [],
                notableCompanies: Array.isArray(parsed.notableCompanies) ? parsed.notableCompanies : [],
                exits: Array.isArray(parsed.exits) ? parsed.exits : [],
                enrichedAt: new Date().toISOString(),
            };
        }
        catch (err) {
            console.error('[LinkedinEnrichment] Signal extraction failed:', err);
            return null;
        }
    }
    async enrichBatch(batchSize = 10) {
        const profiles = await db_1.prisma.profile.findMany({
            where: {
                isComplete: true,
                linkedinUrl: { not: null },
            },
            select: { userId: true, extraData: true, updatedAt: true },
            orderBy: { updatedAt: 'asc' },
            take: batchSize * 3,
        });
        const needsEnrichment = profiles.filter(p => {
            const extra = p.extraData;
            if (!extra?.enrichedData?.enrichedAt)
                return true;
            const daysSince = (Date.now() - new Date(extra.enrichedData.enrichedAt).getTime()) / (1000 * 60 * 60 * 24);
            return daysSince >= 30;
        }).slice(0, batchSize);
        let enriched = 0;
        let errors = 0;
        const skipped = profiles.length - needsEnrichment.length;
        for (const profile of needsEnrichment) {
            const success = await this.enrichProfile(profile.userId);
            if (success)
                enriched++;
            else
                errors++;
        }
        console.log(`[LinkedinEnrichment] Batch: ${enriched} enriched, ${skipped} skipped, ${errors} errors`);
        return { total: needsEnrichment.length, enriched, skipped, errors };
    }
    async onNewUserSignup(userId) {
        setTimeout(async () => {
            try {
                await this.enrichProfile(userId);
            }
            catch (err) {
                console.error(`[LinkedinEnrichment] Signup enrichment failed for ${userId}:`, err);
            }
        }, 5000);
    }
}
exports.linkedinEnrichmentService = new LinkedinEnrichmentService();
//# sourceMappingURL=linkedinEnrichmentService.js.map