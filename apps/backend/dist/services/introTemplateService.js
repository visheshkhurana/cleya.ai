"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.introTemplateService = exports.IntroTemplateService = void 0;
const db_1 = require("@cleya/db");
const displayName_1 = require("../utils/displayName");
const DEFAULT_TEMPLATES = [
    {
        key: 'fundraising',
        category: 'FUNDRAISING',
        name: 'Fundraising Intro',
        description: 'Pitch a founder raising capital to an investor',
        body: `Hi {{recipientFirstName}},

I'd like to introduce {{senderName}}, founder of {{senderCompany}} ({{senderStage}}). They're raising {{senderRaiseAmount}} to {{senderTraction}}.

Why I think you'd want to talk:
- Sector: {{senderSector}}
- Traction: {{senderTraction}}
- Looking for: {{senderLookingFor}}

I'll let you take it from here.

— Cleya`,
        variables: ['recipientFirstName', 'senderName', 'senderCompany', 'senderStage', 'senderRaiseAmount', 'senderSector', 'senderTraction', 'senderLookingFor'],
    },
    {
        key: 'hiring',
        category: 'HIRING',
        name: 'Hiring Intro',
        description: 'Connect a founder with a candidate or operator',
        body: `Hi {{recipientFirstName}},

Want to put {{senderName}} on your radar — {{senderHeadline}}, with experience in {{senderSkills}}.

They're open to {{senderLookingFor}} and would be a fit for what you're building at {{recipientCompany}}.

— Cleya`,
        variables: ['recipientFirstName', 'recipientCompany', 'senderName', 'senderHeadline', 'senderSkills', 'senderLookingFor'],
    },
    {
        key: 'partnership',
        category: 'PARTNERSHIP',
        name: 'Partnership Intro',
        description: 'Suggest a strategic / business development conversation',
        body: `Hi {{recipientFirstName}},

Connecting you with {{senderName}} from {{senderCompany}}. There's a natural overlap between what you're doing at {{recipientCompany}} and {{senderHeadline}}.

Worth a 20-min chat to explore how you might work together.

— Cleya`,
        variables: ['recipientFirstName', 'recipientCompany', 'senderName', 'senderCompany', 'senderHeadline'],
    },
];
const MAX_NAME = 80;
const MIN_BODY = 10;
const MAX_BODY = 4000;
const MAX_PER_USER = 25;
class IntroTemplateService {
    async ensureDefaultsSeeded() {
        for (const t of DEFAULT_TEMPLATES) {
            const existing = await db_1.prisma.introductionTemplate.findFirst({
                where: { ownerId: null, name: t.name, isDefault: true },
            });
            if (existing)
                continue;
            await db_1.prisma.introductionTemplate.create({
                data: {
                    ownerId: null,
                    category: t.category,
                    name: t.name,
                    description: t.description,
                    body: t.body,
                    isDefault: true,
                    isPro: false,
                    variables: t.variables,
                },
            });
        }
    }
    async list(userId) {
        const [defaults, custom] = await Promise.all([
            db_1.prisma.introductionTemplate.findMany({
                where: { isDefault: true, ownerId: null },
                orderBy: { createdAt: 'asc' },
            }),
            db_1.prisma.introductionTemplate.findMany({
                where: { ownerId: userId },
                orderBy: { updatedAt: 'desc' },
            }),
        ]);
        return { defaults, custom };
    }
    async createCustom(userId, data) {
        const cleanName = (data.name || '').trim();
        const cleanBody = (data.body || '').trim();
        const cleanCategory = (data.category || 'OTHER').trim();
        if (!cleanName)
            throw new Error('Template name is required');
        if (cleanName.length > MAX_NAME)
            throw new Error(`Name must be ${MAX_NAME} characters or fewer`);
        if (cleanBody.length < MIN_BODY)
            throw new Error(`Template body must be at least ${MIN_BODY} characters`);
        if (cleanBody.length > MAX_BODY)
            throw new Error(`Template body must be ${MAX_BODY} characters or fewer`);
        const count = await db_1.prisma.introductionTemplate.count({ where: { ownerId: userId } });
        if (count >= MAX_PER_USER) {
            throw new Error(`You can save at most ${MAX_PER_USER} templates. Delete one first.`);
        }
        return db_1.prisma.introductionTemplate.create({
            data: {
                ownerId: userId,
                category: cleanCategory,
                name: cleanName,
                description: data.description ?? null,
                body: cleanBody,
                isDefault: false,
                isPro: true,
                variables: extractVariables(cleanBody),
            },
        });
    }
    async updateCustom(userId, id, data) {
        const existing = await db_1.prisma.introductionTemplate.findFirst({
            where: { id, ownerId: userId, isDefault: false },
        });
        if (!existing)
            throw new Error('Template not found');
        const update = {};
        if (data.name !== undefined) {
            const cleanName = data.name.trim();
            if (!cleanName)
                throw new Error('Template name is required');
            if (cleanName.length > MAX_NAME)
                throw new Error(`Name must be ${MAX_NAME} characters or fewer`);
            update.name = cleanName;
        }
        if (data.body !== undefined) {
            const cleanBody = data.body.trim();
            if (cleanBody.length < MIN_BODY)
                throw new Error(`Template body must be at least ${MIN_BODY} characters`);
            if (cleanBody.length > MAX_BODY)
                throw new Error(`Template body must be ${MAX_BODY} characters or fewer`);
            update.body = cleanBody;
            update.variables = extractVariables(cleanBody);
        }
        if (data.description !== undefined) {
            update.description = data.description ? data.description.trim() : null;
        }
        if (data.category !== undefined) {
            update.category = data.category.trim();
        }
        if (Object.keys(update).length === 0)
            return existing;
        return db_1.prisma.introductionTemplate.update({ where: { id }, data: update });
    }
    async deleteCustom(userId, id) {
        return db_1.prisma.introductionTemplate.deleteMany({
            where: { id, ownerId: userId, isDefault: false },
        });
    }
    fillTemplate(body, vars) {
        return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
            const v = vars[key];
            return v && v.trim() ? v : `[${key}]`;
        });
    }
    async buildVariablesForMatch(matchId, senderUserId) {
        const match = await db_1.prisma.match.findUnique({
            where: { id: matchId },
            include: {
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
        });
        if (!match)
            return {};
        const sender = match.userAId === senderUserId ? match.userA : match.userB;
        const recipient = match.userAId === senderUserId ? match.userB : match.userA;
        const sP = sender.profile;
        const rP = recipient.profile;
        return {
            senderName: (0, displayName_1.safeDisplayName)(sender),
            senderFirstName: (0, displayName_1.safeFirstName)(sender),
            senderCompany: sP?.companyName || '',
            senderStage: sP?.companyStage || '',
            senderRaiseAmount: sP?.raiseAmount || '',
            senderSector: (sP?.industries || []).slice(0, 2).join(', '),
            senderTraction: sP?.keyTractionPoints || '',
            senderLookingFor: (sP?.lookingFor || []).slice(0, 2).join(', '),
            senderHeadline: sP?.headline || '',
            senderSkills: (sP?.skills || []).slice(0, 4).join(', '),
            recipientFirstName: (0, displayName_1.safeFirstName)(recipient),
            recipientName: (0, displayName_1.safeDisplayName)(recipient),
            recipientCompany: rP?.companyName || '',
            recipientHeadline: rP?.headline || '',
        };
    }
}
exports.IntroTemplateService = IntroTemplateService;
function extractVariables(body) {
    const set = new Set();
    const re = /\{\{\s*(\w+)\s*\}\}/g;
    let m;
    while ((m = re.exec(body)))
        set.add(m[1]);
    return Array.from(set);
}
exports.introTemplateService = new IntroTemplateService();
//# sourceMappingURL=introTemplateService.js.map