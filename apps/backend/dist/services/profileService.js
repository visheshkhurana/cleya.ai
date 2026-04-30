"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.profileService = exports.ProfileService = void 0;
const db_1 = require("@cleya/db");
const ai_1 = require("@cleya/ai");
const api_1 = require("@cleya/api");
const errorHandler_1 = require("../middleware/errorHandler");
const linkedinEnrichmentService_1 = require("./linkedinEnrichmentService");
function stripHtml(str) {
    return str.replace(/<[^>]*>/g, '').replace(/&[a-z]+;/gi, ' ').trim();
}
function parseSingleMoneyToken(token) {
    const t = token.toLowerCase().trim();
    if (!t)
        return 0;
    const croreMatch = t.match(/([\d.]+)\s*(?:cr|crore|crores)/);
    if (croreMatch) {
        const num = parseFloat(croreMatch[1]);
        return isNaN(num) ? 0 : num * 10_000_000;
    }
    const lakhMatch = t.match(/([\d.]+)\s*(?:lakh|lakhs|lac|lacs|l)\b/);
    if (lakhMatch) {
        const num = parseFloat(lakhMatch[1]);
        return isNaN(num) ? 0 : num * 100_000;
    }
    const stripped = t.replace(/,/g, '');
    const suffixMatch = stripped.match(/([\d.]+)\s*([kmb])?/);
    if (!suffixMatch)
        return 0;
    let num = parseFloat(suffixMatch[1]);
    if (isNaN(num))
        return 0;
    const suffix = suffixMatch[2];
    if (suffix === 'b')
        num *= 1_000_000_000;
    else if (suffix === 'm')
        num *= 1_000_000;
    else if (suffix === 'k')
        num *= 1_000;
    return num;
}
function normalizeMoneyValue(value) {
    if (!value || !value.trim())
        return undefined;
    const lower = value.toLowerCase().trim();
    const isRange = /[-–—]/.test(lower) && lower.split(/[-–—]/).filter(p => /\d/.test(p)).length === 2;
    if (isRange) {
        return value.trim();
    }
    const num = parseSingleMoneyToken(lower);
    return num > 0 ? String(num) : value;
}
function validateLinkedinUrl(url) {
    if (!url)
        return true;
    return /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i.test(url);
}
/**
 * Generic HTTP/HTTPS URL validator for user-supplied profile links.
 *
 * Rejects any non-http(s) scheme — most importantly `javascript:` and
 * `data:`, which would otherwise persist to the DB and become an XSS sink
 * if rendered as a clickable href elsewhere in the product. We use
 * `new URL()` so malformed inputs throw, then enforce the protocol.
 * Empty / undefined inputs pass — required-ness is enforced separately.
 */
function validateHttpUrl(url) {
    if (!url)
        return true;
    try {
        const u = new URL(url);
        return u.protocol === 'http:' || u.protocol === 'https:';
    }
    catch {
        return false;
    }
}
/**
 * Optional host-allowlist check. We don't require a specific host (users
 * may legitimately self-host), but we lightly normalize known hosts —
 * rejecting trivially obvious typos for the most common platforms.
 */
function validateOptionalHost(url, allowedHosts) {
    if (!url)
        return true;
    if (allowedHosts.length === 0)
        return true;
    try {
        const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
        return allowedHosts.some((h) => host === h || host.endsWith(`.${h}`));
    }
    catch {
        return false;
    }
}
class ProfileService {
    ai = (0, ai_1.createAIService)();
    async getProfile(userId) {
        const profile = await db_1.prisma.profile.findUnique({
            where: { userId },
        });
        if (!profile)
            throw new errorHandler_1.AppError(404, 'Profile not found', 'PROFILE_NOT_FOUND');
        return profile;
    }
    async updateProfile(userId, data) {
        // Profile saves come in as PATCHes (only changed fields). Completeness
        // must be evaluated against the *merged* profile state — otherwise a
        // user who fills every field one-at-a-time never flips isComplete to
        // true, because each save only sees a single field.
        const existing = await db_1.prisma.profile.findUnique({ where: { userId } });
        const merged = { ...(existing || {}), ...data };
        const sanitized = this.sanitizeProfileData(data);
        const sanitizedCreate = this.sanitizeProfileData(data);
        sanitized.isComplete = this.calculateCompleteness(merged) >= 0.75;
        sanitizedCreate.isComplete = sanitized.isComplete;
        const profile = await db_1.prisma.profile.upsert({
            where: { userId },
            update: {
                ...sanitized,
                completenessScore: this.calculateCompleteness(merged),
                updatedAt: new Date(),
            },
            create: {
                userId,
                ...sanitizedCreate,
                completenessScore: this.calculateCompleteness(merged),
            },
        });
        if (data.headline || data.bio || data.skills || data.interests) {
            await this.generateEmbedding(userId, profile);
        }
        try {
            const { profileStrengthService } = await Promise.resolve().then(() => __importStar(require('./profileStrengthService')));
            await profileStrengthService.recompute(userId);
        }
        catch (e) {
            console.log('[ProfileService] Strength recompute failed:', e.message);
        }
        // A6: Trigger LinkedIn enrichment when the user supplies a LinkedIn URL
        // and either (a) the profile is now complete OR (b) the company field is
        // still blank — typically the case we want auto-filled. Single guarded
        // call avoids duplicate delayed jobs and embedding work.
        if (data.linkedinUrl && (profile.isComplete || !profile.companyName)) {
            linkedinEnrichmentService_1.linkedinEnrichmentService.onNewUserSignup(userId);
        }
        if (profile.isComplete) {
            const matchTriggerFields = [
                'persona', 'industries', 'skills', 'lookingFor', 'companyStage',
                'priority', 'targetRole', 'investorType', 'sectorFocus',
                'raiseAmount', 'investmentRange', 'investmentThesis', 'investmentAmount',
            ];
            const significant = matchTriggerFields.some((f) => data[f] !== undefined);
            if (significant) {
                try {
                    const { matchScheduler } = await Promise.resolve().then(() => __importStar(require('./matchScheduler')));
                    matchScheduler.enqueueUserCheck(userId);
                    matchScheduler.enqueueRecheckPeers(userId).catch(() => null);
                }
                catch (e) {
                    console.log('[ProfileService] Match enqueue failed:', e.message);
                }
            }
        }
        return profile;
    }
    async updateFromConversation(userId, context) {
        const persona = context['persona_select_choice'];
        const founderPriority = context['founder_priority_choice'];
        const talentRole = context['talent_target_role_choice'];
        const channelSource = context['attribution_choice'];
        const companyStage = context.companyStage || context['founder_stage_choice'] || context['event_stage_choice'] || context['investor_stage_choice'];
        const investorType = context.investorType || context['investor_type_choice'];
        const preferredStage = context.preferredStage || context['talent_stage_pref_choice'];
        const workStyle = context.workStyle || context['talent_work_style_choice'];
        const profileData = {
            persona,
            companyName: context.companyName,
            companyStage,
            currentRole: context.currentRole,
            headline: context.headline,
            bio: context.bio,
            location: context.location,
            linkedinUrl: context.linkedinUrl,
            phoneNumber: context.phoneNumber,
            industries: context.industries || [],
            skills: context.skills || [],
            interests: context.interests || [],
            yearsExperience: context.yearsExperience ? Number(context.yearsExperience) : undefined,
        };
        if (persona === 'FOUNDER') {
            profileData.priority = founderPriority;
            profileData.businessDescription = context.businessDescription;
            profileData.keyTractionPoints = context.keyTractionPoints;
            profileData.raiseAmount = normalizeMoneyValue(context.raiseAmount) || context.raiseAmount;
            profileData.amountRaisedToDate = normalizeMoneyValue(context.amountRaisedToDate) || context.amountRaisedToDate;
            profileData.roundCloseDate = context.roundCloseDate;
            profileData.lookingFor = founderPriority ? [founderPriority] : [];
            profileData.monthlyRevenue = context.monthlyRevenue;
            profileData.growthRate = context.growthRate;
            profileData.activeUsers = context.activeUsers;
            profileData.burnRate = context.burnRate;
        }
        if (persona === 'TALENT') {
            profileData.targetRole = talentRole;
            profileData.lookingFor = talentRole ? [talentRole] : [];
            profileData.equityExpectation = context.equityExpectation;
            profileData.preferredStage = preferredStage;
            profileData.workStyle = workStyle;
            profileData.functionalArea = context.functionalArea;
        }
        if (persona === 'INVESTOR') {
            profileData.investorType = investorType;
            profileData.investmentAmount = normalizeMoneyValue(context.investmentAmount) || context.investmentAmount;
            profileData.portfolioCompanies = context.portfolioCompanies
                ? (typeof context.portfolioCompanies === 'string'
                    ? context.portfolioCompanies.split(',').map((s) => s.trim()).filter(Boolean)
                    : context.portfolioCompanies)
                : [];
            profileData.dealsPerYear = context.dealsPerYear !== undefined && context.dealsPerYear !== null && context.dealsPerYear !== '' ? Number(context.dealsPerYear) : undefined;
            profileData.leadsRounds = context.leadsRounds === 'true' ? true : context.leadsRounds === 'false' ? false : undefined;
        }
        if (persona === 'DEAL_PARTNER') {
            profileData.cityBased = context.cityBased;
            profileData.exampleInvestment = context.exampleInvestment;
            profileData.outreachMethod = context.outreachMethod;
            profileData.trackedCompanies = context.trackedCompanies;
            profileData.founderAccessPitch = context.founderAccessPitch;
            profileData.preferredStageRange = context.preferredStageRange;
            profileData.sectorFocus = context.sectorFocus
                ? (typeof context.sectorFocus === 'string'
                    ? context.sectorFocus.split(',').map((s) => s.trim()).filter(Boolean)
                    : context.sectorFocus)
                : [];
            profileData.checkSizeRange = context.checkSizeRange;
        }
        if (persona === 'EVENT_PARTICIPANT') {
            profileData.businessDescription = context.businessDescription;
        }
        if (context.matchingGoal || context.matchingExpertiseNeeded) {
            const existingExtra = profileData.extraData || {};
            profileData.extraData = {
                ...existingExtra,
                ...(context.matchingGoal ? { matchingGoal: context.matchingGoal } : {}),
                ...(context.matchingExpertiseNeeded ? {
                    matchingExpertiseNeeded: typeof context.matchingExpertiseNeeded === 'string'
                        ? context.matchingExpertiseNeeded.split(',').map((s) => s.trim()).filter(Boolean)
                        : context.matchingExpertiseNeeded
                } : {}),
            };
        }
        if (channelSource) {
            profileData.channelSource = channelSource;
        }
        if (context.introPreference) {
            profileData.introPreference = context.introPreference;
        }
        if (context.openToMeeting !== undefined) {
            profileData.openToMeeting = context.openToMeeting === 'true' ? true : context.openToMeeting === 'false' ? false : context.openToMeeting;
        }
        if (context.maxIntrosPerWeek) {
            profileData.maxIntrosPerWeek = Number(context.maxIntrosPerWeek);
        }
        Object.keys(profileData).forEach((key) => {
            if (profileData[key] === undefined)
                delete profileData[key];
        });
        return this.updateProfile(userId, profileData);
    }
    async generateEmbedding(userId, profile) {
        try {
            await (0, api_1.generateAndStoreEmbedding)(userId, profile);
            console.log(`Embedding generated for user ${userId}`);
        }
        catch (error) {
            console.error('Failed to generate embedding:', error);
        }
    }
    calculateCompleteness(data) {
        const fields = [
            'persona',
            'headline',
            'bio',
            'companyName',
            'currentRole',
            'location',
            'industries',
            'linkedinUrl',
        ];
        const filled = fields.filter((f) => {
            const val = data[f];
            if (Array.isArray(val))
                return val.length > 0;
            return val !== undefined && val !== null && val !== '';
        });
        return Math.round((filled.length / fields.length) * 100) / 100;
    }
    sanitizeProfileData(data) {
        const allowed = [
            'persona', 'headline', 'bio', 'companyName', 'companyStage',
            'currentRole', 'location', 'linkedinUrl', 'websiteUrl', 'phoneNumber',
            'yearsExperience', 'industries', 'skills', 'interests', 'lookingFor',
            'priority', 'raiseAmount', 'roundCloseDate', 'amountRaisedToDate',
            'businessDescription', 'keyTractionPoints',
            'investorType', 'investmentAmount', 'accreditedInvestor',
            'targetRole',
            'fundName', 'fundSize', 'investmentRange', 'industryFocus', 'investmentThesis',
            'cityBased', 'exampleInvestment', 'outreachMethod', 'trackedCompanies', 'founderAccessPitch',
            'channelSource', 'channelType',
            'monthlyRevenue', 'growthRate', 'activeUsers', 'burnRate',
            'portfolioCompanies', 'dealsPerYear', 'leadsRounds',
            'introPreference', 'openToMeeting', 'maxIntrosPerWeek',
            'equityExpectation', 'preferredStage', 'workStyle', 'functionalArea',
            'preferredStageRange', 'sectorFocus', 'checkSizeRange',
            'githubUrl', 'twitterUrl', 'portfolioUrl', 'availabilityStatus',
            'extraData',
        ];
        const sanitized = {};
        for (const key of allowed) {
            if (data[key] !== undefined) {
                sanitized[key] = data[key];
            }
        }
        const textFields = [
            'headline', 'bio', 'companyName', 'currentRole', 'location',
            'businessDescription', 'keyTractionPoints', 'raiseAmount',
            'amountRaisedToDate', 'fundName', 'fundSize', 'investmentRange',
            'industryFocus', 'investmentThesis', 'cityBased', 'exampleInvestment',
            'outreachMethod', 'founderAccessPitch', 'investmentAmount',
            'monthlyRevenue', 'growthRate', 'activeUsers', 'burnRate',
            'equityExpectation', 'functionalArea',
            'preferredStageRange', 'checkSizeRange',
        ];
        for (const key of textFields) {
            if (typeof sanitized[key] === 'string') {
                sanitized[key] = stripHtml(sanitized[key]);
            }
        }
        const moneyFields = ['raiseAmount', 'amountRaisedToDate', 'investmentAmount', 'fundSize'];
        for (const key of moneyFields) {
            if (typeof sanitized[key] === 'string') {
                sanitized[key] = normalizeMoneyValue(sanitized[key]) || sanitized[key];
            }
        }
        if (typeof sanitized.headline === 'string' && sanitized.headline.length > 150) {
            sanitized.headline = sanitized.headline.substring(0, 150);
        }
        if (typeof sanitized.bio === 'string' && sanitized.bio.length > 1000) {
            sanitized.bio = sanitized.bio.substring(0, 1000);
        }
        if (typeof sanitized.businessDescription === 'string' && sanitized.businessDescription.length > 2000) {
            sanitized.businessDescription = sanitized.businessDescription.substring(0, 2000);
        }
        if (sanitized.linkedinUrl && !validateLinkedinUrl(sanitized.linkedinUrl)) {
            throw new errorHandler_1.AppError(400, 'Invalid LinkedIn URL. Must be in format: https://linkedin.com/in/your-name', 'INVALID_LINKEDIN_URL');
        }
        // B4-7: New profile URL fields. Reject anything that isn't http(s) so we
        // don't persist `javascript:` / `data:` payloads. Also light-host-check
        // the social fields so people don't paste arbitrary tracking links.
        const urlFields = [
            { key: 'websiteUrl', label: 'website URL', hosts: [], max: 500 },
            { key: 'githubUrl', label: 'GitHub URL', hosts: ['github.com'], max: 200 },
            { key: 'twitterUrl', label: 'Twitter / X URL', hosts: ['twitter.com', 'x.com'], max: 200 },
            { key: 'portfolioUrl', label: 'portfolio URL', hosts: [], max: 500 },
        ];
        for (const f of urlFields) {
            const raw = sanitized[f.key];
            if (raw == null || raw === '')
                continue;
            if (typeof raw !== 'string') {
                throw new errorHandler_1.AppError(400, `Invalid ${f.label}.`, 'INVALID_URL');
            }
            const trimmed = stripHtml(raw).trim().substring(0, f.max);
            if (!validateHttpUrl(trimmed)) {
                throw new errorHandler_1.AppError(400, `Invalid ${f.label}. Must start with http:// or https://`, 'INVALID_URL');
            }
            if (!validateOptionalHost(trimmed, f.hosts)) {
                throw new errorHandler_1.AppError(400, `Invalid ${f.label}. Expected a ${f.hosts.join(' or ')} link.`, 'INVALID_URL');
            }
            sanitized[f.key] = trimmed;
        }
        if (Array.isArray(sanitized.skills)) {
            sanitized.skills = sanitized.skills.map((s) => typeof s === 'string' ? stripHtml(s).substring(0, 100) : s);
        }
        if (Array.isArray(sanitized.interests)) {
            sanitized.interests = sanitized.interests.map((s) => typeof s === 'string' ? stripHtml(s).substring(0, 100) : s);
        }
        if (Array.isArray(sanitized.industries)) {
            sanitized.industries = sanitized.industries.map((s) => typeof s === 'string' ? stripHtml(s).substring(0, 100) : s);
        }
        if (Array.isArray(sanitized.portfolioCompanies)) {
            sanitized.portfolioCompanies = sanitized.portfolioCompanies.map((s) => typeof s === 'string' ? stripHtml(s).substring(0, 200) : s);
        }
        if (Array.isArray(sanitized.sectorFocus)) {
            sanitized.sectorFocus = sanitized.sectorFocus.map((s) => typeof s === 'string' ? stripHtml(s).substring(0, 100) : s);
        }
        const extraKeys = Object.keys(data).filter((k) => !allowed.includes(k));
        if (extraKeys.length > 0) {
            sanitized.extraData = {};
            for (const key of extraKeys.slice(0, 20)) {
                const val = data[key];
                if (typeof val === 'string') {
                    sanitized.extraData[key.substring(0, 100)] = stripHtml(val).substring(0, 500);
                }
                else if (typeof val === 'number' || typeof val === 'boolean') {
                    sanitized.extraData[key.substring(0, 100)] = val;
                }
                else if (Array.isArray(val)) {
                    sanitized.extraData[key.substring(0, 100)] = val.slice(0, 50).map((v) => typeof v === 'string' ? stripHtml(v).substring(0, 200) : v);
                }
            }
        }
        // Note: isComplete is intentionally NOT set here; updateProfile()
        // computes it against the merged profile state instead. Setting it
        // here from `data` alone would always read partial PATCHes as
        // incomplete and never flip the flag true.
        return sanitized;
    }
}
exports.ProfileService = ProfileService;
exports.profileService = new ProfileService();
//# sourceMappingURL=profileService.js.map