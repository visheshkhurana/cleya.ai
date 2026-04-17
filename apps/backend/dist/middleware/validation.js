"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.introductionStatusSchema = exports.matchProposeSchema = exports.matchFeedbackSchema = exports.matchResponseSchema = exports.setPasswordSchema = exports.changePasswordSchema = exports.strongPasswordSchema = exports.profileUpdateSchema = void 0;
exports.validate = validate;
const zod_1 = require("zod");
function validate(schema) {
    return (req, res, next) => {
        try {
            req.body = schema.parse(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    error: {
                        message: 'Validation failed',
                        code: 'VALIDATION_ERROR',
                        details: error.errors.map(e => ({
                            field: e.path.join('.'),
                            message: e.message,
                        })),
                    },
                });
                return;
            }
            next(error);
        }
    };
}
function stripHtml(str) {
    return str
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<object[\s\S]*?<\/object>/gi, '')
        .replace(/<embed[\s\S]*?\/?>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
        .replace(/javascript\s*:/gi, '')
        .replace(/vbscript\s*:/gi, '')
        .replace(/data\s*:\s*text\/html/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&#?[a-z0-9]+;/gi, ' ')
        .trim();
}
const sanitizedString = (maxLength) => zod_1.z.string().max(maxLength).transform(val => stripHtml(val));
const optionalSanitizedString = (maxLength) => zod_1.z.string().max(maxLength).transform(val => stripHtml(val)).optional().or(zod_1.z.literal('').transform(() => undefined));
const linkedinUrlSchema = zod_1.z.string()
    .refine(val => !val || /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+\/?$/i.test(val), { message: 'Invalid LinkedIn URL. Must be in format: https://linkedin.com/in/your-name' })
    .optional()
    .or(zod_1.z.literal(''));
const websiteUrlSchema = zod_1.z.string()
    .refine(val => !val || /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+([\/\w\-.~:?#[\]@!$&'()*+,;=]*)?$/i.test(val), { message: 'Invalid website URL. Must start with http:// or https://' })
    .optional()
    .or(zod_1.z.literal(''));
const phoneValidationRules = {
    '+91': 10, '+1': 10, '+44': 10, '+971': [7, 9], '+65': 8, '+61': 9,
    '+49': [7, 12], '+33': 9, '+81': [9, 10], '+82': [9, 10], '+86': 11,
    '+55': [10, 11], '+972': [7, 9], '+31': 9, '+46': [7, 9], '+41': 9,
    '+62': [9, 12], '+60': [9, 10], '+63': 10, '+66': 9, '+84': [9, 10],
    '+27': 9, '+234': [7, 8], '+254': 9, '+52': 10, '+54': 10, '+57': 10,
    '+56': 9, '+64': [8, 10], '+353': [7, 9], '+92': 10, '+880': 10,
    '+94': 9, '+977': 10,
};
function validatePhoneNumber(val) {
    if (!val)
        return true;
    const cleaned = val.replace(/[\s\-]/g, '');
    if (!cleaned.startsWith('+'))
        return false;
    const dialCodes = Object.keys(phoneValidationRules).sort((a, b) => b.length - a.length);
    const matched = dialCodes.find(code => cleaned.startsWith(code));
    if (!matched)
        return /^\+\d{7,15}$/.test(cleaned);
    const localDigits = cleaned.slice(matched.length).replace(/\D/g, '');
    const rule = phoneValidationRules[matched];
    if (typeof rule === 'number')
        return localDigits.length === rule;
    return localDigits.length >= rule[0] && localDigits.length <= rule[1];
}
const phoneSchema = zod_1.z.string()
    .refine(val => !val || validatePhoneNumber(val), { message: 'Invalid phone number. For India (+91), enter exactly 10 digits after the country code.' })
    .optional()
    .or(zod_1.z.literal(''));
const sanitizedArraySchema = (maxItems, maxItemLength) => zod_1.z.array(zod_1.z.string().max(maxItemLength).transform(val => stripHtml(val)))
    .max(maxItems)
    .optional();
const personaEnum = zod_1.z.enum([
    'FOUNDER', 'INVESTOR', 'OPERATOR', 'ADVISOR',
    'JOB_SEEKER', 'TALENT', 'DEAL_PARTNER', 'EVENT_PARTICIPANT',
]).optional();
const companyStageEnum = zod_1.z.enum([
    'PRE_SEED', 'SEED', 'SERIES_A', 'SERIES_B', 'SERIES_C_PLUS',
    'GROWTH', 'PUBLIC', 'BOOTSTRAPPED',
]).optional().nullable();
const priorityEnum = zod_1.z.enum([
    'FUNDRAISING', 'COFOUNDER', 'HIRING', 'MARKETING',
    'SALES', 'VP_HIRE', 'GENERAL',
]).optional().nullable();
const targetRoleEnum = zod_1.z.enum([
    'FOUNDING_ENGINEER', 'FOUNDING_GTM', 'CHIEF_OF_STAFF',
    'GROWTH_CONTENT', 'OPEN_APPLICATION', 'COFOUNDER',
]).optional().nullable();
const introPreferenceEnum = zod_1.z.enum([
    'WARM_ONLY', 'COLD_OK', 'OPEN_TO_BOTH',
]).optional().nullable();
const workStyleEnum = zod_1.z.enum([
    'REMOTE', 'IN_OFFICE', 'HYBRID',
]).optional().nullable();
const nullableString = (maxLength) => zod_1.z.union([
    zod_1.z.string().max(maxLength).transform(val => stripHtml(val)),
    zod_1.z.literal('').transform(() => undefined),
    zod_1.z.null().transform(() => undefined),
]).optional();
const nullableArraySchema = (maxItems, maxItemLength) => zod_1.z.union([
    zod_1.z.array(zod_1.z.string().max(maxItemLength).transform(val => stripHtml(val))).max(maxItems),
    zod_1.z.null().transform(() => undefined),
]).optional();
exports.profileUpdateSchema = zod_1.z.object({
    persona: personaEnum,
    headline: nullableString(150),
    bio: nullableString(1000),
    companyName: nullableString(100),
    companyStage: companyStageEnum,
    currentRole: nullableString(100),
    location: nullableString(100),
    linkedinUrl: zod_1.z.union([linkedinUrlSchema, zod_1.z.null().transform(() => undefined)]).optional(),
    websiteUrl: zod_1.z.union([websiteUrlSchema, zod_1.z.null().transform(() => undefined)]).optional(),
    phoneNumber: zod_1.z.union([phoneSchema, zod_1.z.null().transform(() => undefined)]).optional(),
    yearsExperience: zod_1.z.number().int().min(0).max(70).optional().nullable(),
    industries: nullableArraySchema(20, 100),
    skills: nullableArraySchema(30, 100),
    interests: nullableArraySchema(30, 100),
    lookingFor: nullableArraySchema(10, 100),
    priority: priorityEnum,
    raiseAmount: nullableString(50),
    roundCloseDate: nullableString(50),
    amountRaisedToDate: nullableString(50),
    businessDescription: nullableString(2000),
    keyTractionPoints: nullableString(500),
    investorType: nullableString(50),
    investmentAmount: nullableString(50),
    accreditedInvestor: zod_1.z.boolean().optional().nullable(),
    targetRole: targetRoleEnum,
    fundName: nullableString(100),
    fundSize: nullableString(50),
    investmentRange: nullableString(50),
    industryFocus: nullableArraySchema(20, 100),
    investmentThesis: nullableString(1000),
    cityBased: nullableString(100),
    exampleInvestment: nullableString(200),
    outreachMethod: nullableString(200),
    trackedCompanies: nullableString(500),
    founderAccessPitch: nullableString(500),
    channelSource: nullableString(50),
    channelType: nullableString(50),
    monthlyRevenue: nullableString(50),
    growthRate: nullableString(50),
    activeUsers: nullableString(50),
    burnRate: nullableString(50),
    portfolioCompanies: nullableArraySchema(100, 200),
    dealsPerYear: zod_1.z.number().int().min(0).max(500).optional().nullable(),
    leadsRounds: zod_1.z.boolean().optional().nullable(),
    introPreference: introPreferenceEnum,
    openToMeeting: zod_1.z.boolean().optional(),
    maxIntrosPerWeek: zod_1.z.number().int().min(1).max(20).optional().nullable(),
    equityExpectation: nullableString(50),
    preferredStage: companyStageEnum,
    workStyle: workStyleEnum,
    functionalArea: nullableString(100),
    preferredStageRange: nullableString(100),
    sectorFocus: nullableArraySchema(20, 100),
    checkSizeRange: nullableString(50),
}).passthrough();
exports.strongPasswordSchema = zod_1.z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');
exports.changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: exports.strongPasswordSchema,
});
exports.setPasswordSchema = zod_1.z.object({
    newPassword: exports.strongPasswordSchema,
});
exports.matchResponseSchema = zod_1.z.object({
    response: zod_1.z.enum(['ACCEPTED', 'REJECTED'], {
        errorMap: () => ({ message: 'Response must be ACCEPTED or REJECTED' }),
    }),
});
exports.matchFeedbackSchema = zod_1.z.object({
    rating: zod_1.z.number().int().min(1).max(5),
    feedback: sanitizedString(1000).optional().nullable(),
});
exports.matchProposeSchema = zod_1.z.object({
    userAId: zod_1.z.string().cuid(),
    userBId: zod_1.z.string().cuid(),
});
exports.introductionStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['VIEWED', 'RESPONDED', 'MEETING_SCHEDULED']),
    scheduledAt: zod_1.z.string().datetime().optional(),
    notes: sanitizedString(500).optional(),
});
//# sourceMappingURL=validation.js.map