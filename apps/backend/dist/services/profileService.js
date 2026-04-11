"use strict";
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
        const profile = await db_1.prisma.profile.upsert({
            where: { userId },
            update: {
                ...this.sanitizeProfileData(data),
                completenessScore: this.calculateCompleteness(data),
                updatedAt: new Date(),
            },
            create: {
                userId,
                ...this.sanitizeProfileData(data),
                completenessScore: this.calculateCompleteness(data),
            },
        });
        if (data.headline || data.bio || data.skills || data.interests) {
            await this.generateEmbedding(userId, profile);
        }
        if (data.linkedinUrl && profile.isComplete) {
            linkedinEnrichmentService_1.linkedinEnrichmentService.onNewUserSignup(userId);
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
        sanitized.isComplete = this.calculateCompleteness(data) >= 0.75;
        return sanitized;
    }
}
exports.ProfileService = ProfileService;
exports.profileService = new ProfileService();
//# sourceMappingURL=profileService.js.map