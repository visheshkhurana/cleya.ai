import { prisma } from '@cleya/db';

const DEFAULT_TEMPLATES = [
  {
    key: 'fundraising',
    category: 'FUNDRAISING',
    name: 'Fundraising Intro',
    description: 'Pitch a founder raising capital to an investor',
    body:
`Hi {{recipientFirstName}},

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
    body:
`Hi {{recipientFirstName}},

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
    body:
`Hi {{recipientFirstName}},

Connecting you with {{senderName}} from {{senderCompany}}. There's a natural overlap between what you're doing at {{recipientCompany}} and {{senderHeadline}}.

Worth a 20-min chat to explore how you might work together.

— Cleya`,
    variables: ['recipientFirstName', 'recipientCompany', 'senderName', 'senderCompany', 'senderHeadline'],
  },
];

export class IntroTemplateService {
  async ensureDefaultsSeeded() {
    for (const t of DEFAULT_TEMPLATES) {
      const existing = await prisma.introductionTemplate.findFirst({
        where: { ownerId: null, name: t.name, isDefault: true },
      });
      if (existing) continue;
      await prisma.introductionTemplate.create({
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

  async list(userId: string) {
    const [defaults, custom] = await Promise.all([
      prisma.introductionTemplate.findMany({
        where: { isDefault: true, ownerId: null },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.introductionTemplate.findMany({
        where: { ownerId: userId },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return { defaults, custom };
  }

  async createCustom(userId: string, data: { name: string; category: string; body: string; description?: string }) {
    return prisma.introductionTemplate.create({
      data: {
        ownerId: userId,
        category: data.category,
        name: data.name,
        description: data.description ?? null,
        body: data.body,
        isDefault: false,
        isPro: true,
        variables: extractVariables(data.body),
      },
    });
  }

  async deleteCustom(userId: string, id: string) {
    return prisma.introductionTemplate.deleteMany({
      where: { id, ownerId: userId, isDefault: false },
    });
  }

  fillTemplate(body: string, vars: Record<string, string | undefined>): string {
    return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
      const v = vars[key];
      return v && v.trim() ? v : `[${key}]`;
    });
  }

  async buildVariablesForMatch(matchId: string, senderUserId: string): Promise<Record<string, string>> {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        userA: { include: { profile: true } },
        userB: { include: { profile: true } },
      },
    });
    if (!match) return {};
    const sender = match.userAId === senderUserId ? match.userA : match.userB;
    const recipient = match.userAId === senderUserId ? match.userB : match.userA;
    const sP = sender.profile;
    const rP = recipient.profile;
    return {
      senderName: sender.name || sP?.currentRole || sender.email.split('@')[0],
      senderFirstName: (sender.name || '').split(' ')[0] || '',
      senderCompany: sP?.companyName || '',
      senderStage: sP?.companyStage || '',
      senderRaiseAmount: sP?.raiseAmount || '',
      senderSector: (sP?.industries || []).slice(0, 2).join(', '),
      senderTraction: sP?.keyTractionPoints || '',
      senderLookingFor: (sP?.lookingFor || []).slice(0, 2).join(', '),
      senderHeadline: sP?.headline || '',
      senderSkills: (sP?.skills || []).slice(0, 4).join(', '),
      recipientFirstName: (recipient.name || '').split(' ')[0] || recipient.email.split('@')[0],
      recipientName: recipient.name || rP?.currentRole || recipient.email.split('@')[0],
      recipientCompany: rP?.companyName || '',
      recipientHeadline: rP?.headline || '',
    };
  }
}

function extractVariables(body: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*(\w+)\s*\}\}/g;
  let m;
  while ((m = re.exec(body))) set.add(m[1]);
  return Array.from(set);
}

export const introTemplateService = new IntroTemplateService();
