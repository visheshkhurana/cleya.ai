import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { createAIService } from '@cleya/ai';
import { prisma } from '@cleya/db';

export const aiBioRouter = Router();

const PERSONA_LABEL: Record<string, string> = {
  FOUNDER: 'Founder',
  INVESTOR: 'Investor',
  TALENT: 'Talent',
  DEAL_PARTNER: 'Deal Partner',
  VENTURE_PARTNER: 'Venture Partner',
  ADVISOR: 'Advisor',
  OPERATOR: 'Operator',
  JOB_SEEKER: 'Job Seeker',
  RECRUITER: 'Recruiter',
  FREELANCER: 'Freelancer',
  OTHER: 'Other',
};

const SYSTEM_PROMPT = `You write professional bios for the Cleya.ai networking platform.

Rules:
- 2 to 3 sentences. Max ~280 characters.
- First sentence: who they are (role + company or persona).
- Second sentence: what they're working on or known for (sector, stage, traction, or skills).
- Third sentence (optional): what they're looking for now.
- Proper-case all names and proper nouns. No lowercase "i" or company names.
- Concrete and specific. Reference the actual industries/skills/stage given. Never invent companies, numbers, or credentials not in the input.
- No filler ("passionate", "driven", "rockstar", "ambitious", "go-getter", "super excited"). No emojis. No hashtags.
- Output only the bio text. No quotes, no preamble, no explanation.`;

const RATE_LIMIT_PER_DAY = 5;
const usageByUser: Map<string, { count: number; resetAt: number }> = new Map();

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const entry = usageByUser.get(userId);
  if (!entry || entry.resetAt < now) {
    usageByUser.set(userId, { count: 1, resetAt: now + dayMs });
    return { allowed: true, remaining: RATE_LIMIT_PER_DAY - 1 };
  }
  if (entry.count >= RATE_LIMIT_PER_DAY) {
    return { allowed: false, remaining: 0 };
  }
  entry.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_PER_DAY - entry.count };
}

aiBioRouter.post('/bio', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const limit = checkRateLimit(userId);
    if (!limit.allowed) {
      res.status(429).json({
        success: false,
        error: { message: `Daily limit reached (${RATE_LIMIT_PER_DAY}/day). Try again tomorrow.` },
      });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(503).json({
        success: false,
        error: { message: 'AI bio generation is unavailable right now. Please write your bio manually.' },
      });
      return;
    }

    const profile = await prisma.profile.findUnique({ where: { userId } });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    const persona = profile?.persona ? PERSONA_LABEL[profile.persona] || profile.persona : null;
    const role = (profile as any)?.currentRole || null;
    const company = (profile as any)?.companyName || null;
    const stage = (profile as any)?.companyStage || null;
    const location = (profile as any)?.location || null;
    const industries = Array.isArray((profile as any)?.industries) ? (profile as any).industries : [];
    const skills = Array.isArray((profile as any)?.skills) ? (profile as any).skills : [];
    const lookingFor = Array.isArray((profile as any)?.lookingFor) ? (profile as any).lookingFor : [];

    const inputLines: string[] = [];
    if (user?.name) inputLines.push(`Name: ${user.name}`);
    if (persona) inputLines.push(`Persona: ${persona}`);
    if (role) inputLines.push(`Role: ${role}`);
    if (company) inputLines.push(`Company: ${company}`);
    if (stage) inputLines.push(`Company stage: ${stage}`);
    if (location) inputLines.push(`Location: ${location}`);
    if (industries.length) inputLines.push(`Industries: ${industries.slice(0, 6).join(', ')}`);
    if (skills.length) inputLines.push(`Skills: ${skills.slice(0, 8).join(', ')}`);
    if (lookingFor.length) inputLines.push(`Looking for: ${lookingFor.slice(0, 4).join(', ')}`);

    if (inputLines.length === 0) {
      res.status(400).json({
        success: false,
        error: { message: 'Add a bit of profile info first (role, company, or industries) so I have something to work with.' },
      });
      return;
    }

    const userPrompt = `Write a 2-3 sentence professional bio using only this profile data. Do not invent details.\n\n${inputLines.join('\n')}`;

    const ai = createAIService({ provider: 'openai', model: 'gpt-4o-mini' });
    const response = await ai.chat([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    let bio = (response.content || '').trim();
    if (bio.startsWith('"') && bio.endsWith('"')) bio = bio.slice(1, -1).trim();
    if (bio.length > 1000) bio = bio.substring(0, 1000);

    if (!bio) {
      res.status(502).json({
        success: false,
        error: { message: 'Couldn\'t draft a bio right now. Please try again or write it manually.' },
      });
      return;
    }

    res.json({
      success: true,
      data: { bio, remaining: limit.remaining },
    });
  } catch (error) {
    next(error);
  }
});
