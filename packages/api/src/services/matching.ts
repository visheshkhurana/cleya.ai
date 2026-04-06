import { prisma } from '@cleya/db';
import { createAIService } from '@cleya/ai';
import { matchingEngine, ProfileForMatching, normalizeToExpertiseTags } from '@cleya/matching';

const ai = createAIService();

export interface ProfileData {
  persona?: string;
  headline?: string;
  bio?: string;
  companyName?: string;
  currentRole?: string;
  companyStage?: string;
  businessDescription?: string;
  keyTractionPoints?: string;
  industries?: string[];
  skills?: string[];
  interests?: string[];
  lookingFor?: string[];
  location?: string;
  investorType?: string;
  investmentAmount?: string;
  investmentThesis?: string;
  targetRole?: string;
  priority?: string;
  raiseAmount?: string;
  fundName?: string;
  fundSize?: string;
  extraData?: Record<string, any>;
  portfolioCompanies?: Array<{ name: string; sector: string; stage?: string }>;
  openToMeeting?: boolean;
  weeklyIntroCap?: number;
  equityPreference?: string;
  workStyle?: string;
  functionalArea?: string;
  tractionMetrics?: { revenue?: number; mrr?: number; userCount?: number; growthRate?: number; runway?: number };
}

export interface EmbeddingResult {
  vector: number[];
  text: string;
  model: string;
}

export interface VectorSearchResult {
  userId: string;
  similarity: number;
}

export interface HybridMatchResult {
  userId: string;
  vectorSimilarity: number;
  ruleScore: number;
  hybridScore: number;
  breakdown: Record<string, number>;
  profile: ProfileForMatching;
}

export function profileDataToText(data: ProfileData): string {
  const parts = [
    data.persona && `Role: ${data.persona}`,
    data.headline && `Headline: ${data.headline}`,
    data.bio && `Bio: ${data.bio}`,
    data.companyName && `Company: ${data.companyName}`,
    data.currentRole && `Title: ${data.currentRole}`,
    data.businessDescription && `Business: ${data.businessDescription}`,
    data.keyTractionPoints && `Traction: ${data.keyTractionPoints}`,
    data.investmentThesis && `Investment Thesis: ${data.investmentThesis}`,
    data.fundName && `Fund: ${data.fundName}`,
    data.fundSize && `Fund Size: ${data.fundSize}`,
    data.industries?.length && `Industries: ${data.industries.join(', ')}`,
    data.skills?.length && `Skills: ${data.skills.join(', ')}`,
    data.interests?.length && `Interests: ${data.interests.join(', ')}`,
    data.lookingFor?.length && `Looking for: ${data.lookingFor.join(', ')}`,
    data.location && `Location: ${data.location}`,
    data.investorType && `Investor Type: ${data.investorType}`,
    data.investmentAmount && `Check Size: ${data.investmentAmount}`,
    data.targetRole && `Target Role: ${data.targetRole}`,
    data.priority && `Priority: ${data.priority}`,
    data.raiseAmount && `Raise Amount: ${data.raiseAmount}`,
    data.tractionMetrics?.revenue && `Revenue: ${data.tractionMetrics.revenue}`,
    data.tractionMetrics?.mrr && `MRR: ${data.tractionMetrics.mrr}`,
    data.tractionMetrics?.userCount && `Users: ${data.tractionMetrics.userCount}`,
    data.tractionMetrics?.growthRate && `Growth Rate: ${data.tractionMetrics.growthRate}% MoM`,
    data.portfolioCompanies?.length && `Portfolio: ${data.portfolioCompanies.map(p => `${p.name} (${p.sector})`).join(', ')}`,
    data.equityPreference && `Equity Preference: ${data.equityPreference}`,
    data.workStyle && `Work Style: ${data.workStyle}`,
    data.functionalArea && `Functional Area: ${data.functionalArea}`,
  ];

  const extra = data.extraData;
  if (extra) {
    const enriched = extra.enrichedData;
    if (enriched) {
      if (enriched.domainExpertise?.length) parts.push(`Domain Expertise: ${enriched.domainExpertise.join(', ')}`);
      if (enriched.notableCompanies?.length) parts.push(`Notable Companies: ${enriched.notableCompanies.join(', ')}`);
      if (enriched.exits?.length) parts.push(`Exits: ${enriched.exits.join(', ')}`);
      if (enriched.careerHistory?.length) parts.push(`Career: ${enriched.careerHistory.join(', ')}`);
    }
    if (extra.portfolioCompanies?.length && !data.portfolioCompanies?.length) {
      parts.push(`Portfolio: ${extra.portfolioCompanies.map((p: any) => `${p.name} (${p.sector})`).join(', ')}`);
    }
    if (extra.tractionMetrics && !data.tractionMetrics) {
      const tm = extra.tractionMetrics;
      if (tm.revenue) parts.push(`Revenue: ${tm.revenue}`);
      if (tm.mrr) parts.push(`MRR: ${tm.mrr}`);
      if (tm.userCount) parts.push(`Users: ${tm.userCount}`);
      if (tm.growthRate) parts.push(`Growth Rate: ${tm.growthRate}% MoM`);
    }
    if (extra.equityPreference && !data.equityPreference) parts.push(`Equity Preference: ${extra.equityPreference}`);
    if (extra.workStyle && !data.workStyle) parts.push(`Work Style: ${extra.workStyle}`);
    if (extra.functionalArea && !data.functionalArea) parts.push(`Functional Area: ${extra.functionalArea}`);
  }

  return parts.filter(Boolean).join('. ');
}

export async function generateEmbedding(profileData: ProfileData): Promise<EmbeddingResult> {
  const text = profileDataToText(profileData);
  if (!text) {
    throw new Error('Profile data produced empty text — cannot generate embedding');
  }

  const result = await ai.embed(text);

  return {
    vector: result.vector,
    text,
    model: result.model,
  };
}

export async function generateAndStoreEmbedding(
  userId: string,
  profileData: ProfileData
): Promise<EmbeddingResult> {
  const embedding = await generateEmbedding(profileData);

  await prisma.$executeRawUnsafe(
    `INSERT INTO user_embeddings (id, "userId", vector, source, content, "createdAt", "updatedAt")
     VALUES (gen_random_uuid(), $1, $2::vector, 'PROFILE', $3, NOW(), NOW())
     ON CONFLICT ("userId", source)
     DO UPDATE SET vector = $2::vector, content = $3, "updatedAt" = NOW()`,
    userId,
    `[${embedding.vector.join(',')}]`,
    embedding.text
  );

  return embedding;
}

export async function findSimilarByVector(
  userId: string,
  options: { limit?: number; minSimilarity?: number; excludeUserIds?: string[] } = {}
): Promise<VectorSearchResult[]> {
  const { limit: rawLimit = 20, minSimilarity = 0.3, excludeUserIds = [] } = options;
  const limit = Math.min(Math.max(Math.floor(Number(rawLimit) || 20), 1), 100);

  const allExcluded = [userId, ...excludeUserIds];
  const placeholders = allExcluded.map((_, i) => `$${i + 3}`).join(', ');

  const results = await prisma.$queryRawUnsafe<VectorSearchResult[]>(
    `SELECT ue2."userId",
            1 - (ue1.vector <=> ue2.vector) AS similarity
     FROM user_embeddings ue1
     JOIN user_embeddings ue2 ON ue1."userId" != ue2."userId"
     WHERE ue1."userId" = $1
       AND ue1.source = 'PROFILE'
       AND ue2.source = 'PROFILE'
       AND ue2."userId" NOT IN (${placeholders})
       AND 1 - (ue1.vector <=> ue2.vector) >= $2
     ORDER BY ue1.vector <=> ue2.vector
     LIMIT $${allExcluded.length + 3}`,
    userId,
    minSimilarity,
    ...allExcluded,
    limit
  );

  return results.map((r) => ({
    userId: r.userId,
    similarity: parseFloat(String(r.similarity)),
  }));
}

export async function findSimilarByText(
  queryText: string,
  options: { limit?: number; minSimilarity?: number; excludeUserIds?: string[] } = {}
): Promise<VectorSearchResult[]> {
  const { limit: rawLimit = 20, minSimilarity = 0.2, excludeUserIds = [] } = options;
  const limit = Math.min(Math.max(Math.floor(Number(rawLimit) || 20), 1), 100);

  const embeddingResult = await ai.embed(queryText);
  const vectorStr = `[${embeddingResult.vector.join(',')}]`;

  let query = `
    SELECT ue."userId",
           1 - (ue.vector <=> $1::vector) AS similarity
    FROM user_embeddings ue
    WHERE ue.source = 'PROFILE'
      AND 1 - (ue.vector <=> $1::vector) >= $2
  `;

  const params: any[] = [vectorStr, minSimilarity];

  if (excludeUserIds.length > 0) {
    const placeholders = excludeUserIds.map((_, i) => `$${i + 3}`).join(', ');
    query += ` AND ue."userId" NOT IN (${placeholders})`;
    params.push(...excludeUserIds);
  }

  const limitParamIndex = params.length + 1;
  query += ` ORDER BY ue.vector <=> $1::vector LIMIT $${limitParamIndex}`;
  params.push(limit);

  const results = await prisma.$queryRawUnsafe<VectorSearchResult[]>(query, ...params);

  return results.map((r) => ({
    userId: r.userId,
    similarity: parseFloat(String(r.similarity)),
  }));
}

export async function getProfileForMatching(userId: string): Promise<ProfileForMatching | null> {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return null;

  let embedding: number[] | undefined;
  try {
    const embRow = await prisma.$queryRawUnsafe<any[]>(
      `SELECT vector::text FROM user_embeddings WHERE "userId" = $1 AND source = 'PROFILE' LIMIT 1`,
      userId
    );
    if (embRow.length > 0) {
      embedding = JSON.parse(embRow[0].vector);
    }
  } catch {}

  const extraData = (profile as any).extraData as Record<string, any> | null;
  const p = profile as any;

  let weeklyIntrosUsed = 0;
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const introCount = await prisma.introductionRecord.count({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
        createdAt: { gte: weekAgo },
      },
    });
    weeklyIntrosUsed = introCount;
  } catch {}

  const portfolioStrings: string[] = p.portfolioCompanies || [];
  const portfolioCompanies = portfolioStrings.length > 0
    ? portfolioStrings.map((s: string) => {
        const match = s.match(/^(.+?)\s*\((.+?)\)$/);
        if (match) return { name: match[1].trim(), sector: match[2].trim() };
        return { name: s, sector: s };
      })
    : (extraData?.portfolioCompanies || undefined);

  const tractionMetrics = buildTractionMetrics(p, extraData);

  const expertiseInputs = [
    ...profile.skills,
    ...(extraData?.enrichedData?.domainExpertise || []),
  ];
  if (profile.headline) expertiseInputs.push(profile.headline);
  if (p.functionalArea) expertiseInputs.push(p.functionalArea);
  const expertiseTags = normalizeToExpertiseTags(expertiseInputs);

  const matchingGoal = extraData?.matchingGoal || undefined;
  const matchingExpertiseNeeded = extraData?.matchingExpertiseNeeded || undefined;

  return {
    userId,
    persona: p.persona || 'OTHER',
    companyStage: p.companyStage || undefined,
    industries: profile.industries,
    interests: profile.interests,
    lookingFor: profile.lookingFor,
    location: profile.location || undefined,
    skills: profile.skills,
    headline: profile.headline || undefined,
    bio: profile.bio || undefined,
    embedding,
    priority: p.priority || undefined,
    targetRole: p.targetRole || undefined,
    investorType: p.investorType || undefined,
    investmentAmount: p.investmentAmount || undefined,
    raiseAmount: p.raiseAmount || undefined,
    trackedCompanies: p.trackedCompanies || undefined,
    industryFocus: p.industryFocus || [],
    investmentThesis: p.investmentThesis || undefined,
    fundName: p.fundName || undefined,
    keyTractionPoints: p.keyTractionPoints || undefined,
    companyName: p.companyName || undefined,
    businessDescription: p.businessDescription || undefined,
    portfolioCompanies,
    openToMeeting: p.openToMeeting ?? true,
    weeklyIntroCap: p.maxIntrosPerWeek || undefined,
    weeklyIntrosUsed,
    equityPreference: p.equityExpectation || extraData?.equityPreference || undefined,
    workStyle: p.workStyle || extraData?.workStyle || undefined,
    functionalArea: p.functionalArea || extraData?.functionalArea || undefined,
    tractionMetrics,
    enrichedData: extraData?.enrichedData || undefined,
    expertiseTags,
    matchingGoal,
    matchingExpertiseNeeded,
  };
}

function buildTractionMetrics(p: any, extraData: Record<string, any> | null) {
  const monthlyRevStr = p.monthlyRevenue as string | null;
  const growthRateStr = p.growthRate as string | null;
  const activeUsersStr = p.activeUsers as string | null;
  const burnRateStr = p.burnRate as string | null;

  if (!monthlyRevStr && !growthRateStr && !activeUsersStr && !burnRateStr) {
    return extraData?.tractionMetrics || undefined;
  }

  const parseNum = (s: string | null): number | undefined => {
    if (!s) return undefined;
    const num = parseFloat(s.replace(/[^0-9.]/g, ''));
    return isNaN(num) ? undefined : num;
  };

  const fallback = (extraData?.tractionMetrics as any) || {};
  const mrr = parseNum(monthlyRevStr);
  const growth = parseNum(growthRateStr);
  const users = parseNum(activeUsersStr);
  const runway = parseNum(burnRateStr);

  return {
    ...fallback,
    ...(mrr !== undefined ? { mrr } : {}),
    ...(growth !== undefined ? { growthRate: growth } : {}),
    ...(users !== undefined ? { userCount: users } : {}),
    ...(runway !== undefined ? { runway } : {}),
  };
}

export async function userHasEmbedding(userId: string): Promise<boolean> {
  const result = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS(SELECT 1 FROM user_embeddings WHERE "userId" = $1 AND source = 'PROFILE') as exists`,
    userId
  );
  return result[0]?.exists || false;
}

export async function ensureEmbedding(userId: string): Promise<boolean> {
  const hasEmb = await userHasEmbedding(userId);
  if (hasEmb) return true;

  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return false;

  try {
    await generateAndStoreEmbedding(userId, profile as any);
    return true;
  } catch (error) {
    console.error(`[MatchingAPI] Failed to generate embedding for ${userId}:`, error);
    return false;
  }
}

export async function findMatches(
  userId: string,
  limit = 10
): Promise<HybridMatchResult[]> {
  await ensureEmbedding(userId);

  const existingMatches = await prisma.match.findMany({
    where: {
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: { userAId: true, userBId: true },
  });

  const alreadyMatchedIds = Array.from(
    new Set(existingMatches.flatMap((m) => [m.userAId, m.userBId]))
  );

  return hybridMatch(userId, {
    limit,
    vectorCandidatePool: Math.max(limit * 5, 50),
    minScore: 0.35,
    excludeUserIds: alreadyMatchedIds,
  });
}

export async function hybridMatch(
  userId: string,
  options: { limit?: number; vectorCandidatePool?: number; minScore?: number; excludeUserIds?: string[] } = {}
): Promise<HybridMatchResult[]> {
  const { limit = 10, vectorCandidatePool = 50, minScore = 0.35, excludeUserIds = [] } = options;

  const userProfile = await getProfileForMatching(userId);
  if (!userProfile) {
    throw new Error('Profile not found for user');
  }

  const hasEmb = await userHasEmbedding(userId);

  let candidateIds: Set<string>;

  if (hasEmb) {
    const vectorResults = await findSimilarByVector(userId, {
      limit: vectorCandidatePool,
      minSimilarity: 0.15,
      excludeUserIds,
    });
    candidateIds = new Set(vectorResults.map((r) => r.userId));

    const ruleBasedCandidates = await getRuleBasedCandidates(userProfile, excludeUserIds, 20);
    for (const c of ruleBasedCandidates) {
      candidateIds.add(c.userId);
    }
  } else {
    const allCandidates = await getAllCompletedProfiles(userId, excludeUserIds);
    candidateIds = new Set(allCandidates.map((c) => c.userId));
  }

  const candidateProfiles = await Promise.all(
    Array.from(candidateIds).map((id) => getProfileForMatching(id))
  );

  const validCandidates = candidateProfiles.filter(Boolean) as ProfileForMatching[];

  const getMatchablePersonas = (persona: string): string[] => {
    switch (persona) {
      case 'FOUNDER': return ['INVESTOR', 'TALENT', 'ADVISOR', 'VENTURE_PARTNER', 'OPERATOR'];
      case 'INVESTOR': return ['FOUNDER'];
      case 'TALENT': return ['FOUNDER'];
      default: return ['FOUNDER', 'INVESTOR', 'TALENT'];
    }
  };
  const allowedPersonas = getMatchablePersonas(userProfile.persona);
  const crossPersonaCandidates = validCandidates.filter(c => allowedPersonas.includes(c.persona));

  const hasExplicitIntent = !!(userProfile.matchingGoal || (userProfile.matchingExpertiseNeeded && userProfile.matchingExpertiseNeeded.length > 0) || userProfile.lookingFor.length > 0 || userProfile.priority);
  const intentFiltered = crossPersonaCandidates.filter(c => matchingEngine.passesIntentFilter(userProfile, c));

  let candidates: ProfileForMatching[];
  if (hasExplicitIntent) {
    candidates = intentFiltered;
  } else if (intentFiltered.length >= Math.min(5, crossPersonaCandidates.length)) {
    candidates = intentFiltered;
  } else {
    candidates = crossPersonaCandidates;
  }

  const [pastOutcomes, dynamicIntent] = await Promise.all([
    getUserPastMatchOutcomes(userId),
    computeDynamicIntent(userId),
  ]);

  const scored: HybridMatchResult[] = candidates.map((candidate) => {
    const matchScore = matchingEngine.score(userProfile, candidate);

    let adjustedScore = matchScore.total;

    const feedbackMult = computeFeedbackMultiplier(pastOutcomes, candidate);
    if (feedbackMult !== 1.0) {
      adjustedScore *= feedbackMult;
    }

    if (dynamicIntent && dynamicIntent.inferredIntent) {
      const candidatePersona = candidate.persona;
      let shouldApply = false;

      if (dynamicIntent.inferredIntent === 'NOT_FUNDRAISING' &&
          ['INVESTOR', 'VENTURE_PARTNER', 'DEAL_PARTNER'].includes(candidatePersona)) {
        shouldApply = true;
      } else if (dynamicIntent.inferredIntent === 'NOT_HIRING' &&
                 ['TALENT', 'JOB_SEEKER', 'RECRUITER'].includes(candidatePersona)) {
        shouldApply = true;
      } else if (dynamicIntent.inferredIntent === 'HIGHLY_ENGAGED' ||
                 dynamicIntent.inferredIntent === 'DISENGAGED') {
        shouldApply = true;
      }

      if (shouldApply) {
        adjustedScore *= dynamicIntent.multiplier;
      }
    }

    return {
      userId: candidate.userId,
      vectorSimilarity: matchScore.breakdown.semanticSimilarity || 0,
      ruleScore: matchScore.ruleScore,
      hybridScore: Math.round(adjustedScore * 100) / 100,
      breakdown: {
        ...matchScore.breakdown,
        feedbackAdjustment: Math.round(feedbackMult * 100) / 100,
        dynamicIntentMultiplier: dynamicIntent?.multiplier ?? 1,
      },
      profile: candidate,
    };
  });

  return scored
    .filter((r) => r.hybridScore >= minScore)
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, limit);
}

interface PastMatchOutcome {
  otherPersona: string;
  otherIndustries: string[];
  otherStage: string | null;
  rating: number | null;
  response: string | null;
  introOutcome: string | null;
}

async function getUserPastMatchOutcomes(userId: string): Promise<PastMatchOutcome[]> {
  try {
    const matches = await prisma.match.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
      },
      include: {
        userA: { include: { profile: { select: { persona: true, industries: true, companyStage: true } } } },
        userB: { include: { profile: { select: { persona: true, industries: true, companyStage: true } } } },
        feedbacks: { where: { userId }, select: { rating: true } },
        introduction: { select: { outcome: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return matches.map(m => {
      const isA = m.userAId === userId;
      const other = isA ? m.userB : m.userA;
      const response = isA ? m.userAResponse : m.userBResponse;
      return {
        otherPersona: other?.profile?.persona || 'OTHER',
        otherIndustries: other?.profile?.industries || [],
        otherStage: other?.profile?.companyStage || null,
        rating: m.feedbacks?.[0]?.rating || null,
        response: response || null,
        introOutcome: m.introduction?.outcome || null,
      };
    });
  } catch (err) {
    console.error('[Matching] Failed to fetch past match outcomes:', err);
    return [];
  }
}

function computeFeedbackMultiplier(
  pastOutcomes: PastMatchOutcome[],
  candidate: ProfileForMatching
): number {
  if (pastOutcomes.length === 0) return 1.0;

  const candidatePersona = candidate.persona;
  const candidateIndustries = new Set(candidate.industries.map(i => i.toLowerCase()));

  let similarMatchScores: number[] = [];

  for (const outcome of pastOutcomes) {
    let similarity = 0;

    if (outcome.otherPersona === candidatePersona) similarity += 0.5;

    const otherInds = new Set(outcome.otherIndustries.map(i => i.toLowerCase()));
    const overlap = [...candidateIndustries].filter(i => otherInds.has(i)).length;
    if (overlap > 0) similarity += 0.3 * Math.min(overlap / Math.max(candidateIndustries.size, 1), 1);

    if (outcome.otherStage === candidate.companyStage && candidate.companyStage) similarity += 0.2;

    if (similarity < 0.3) continue;

    let outcomeScore = 0;
    if (outcome.rating !== null) {
      outcomeScore = (outcome.rating - 3) / 2;
    }
    if (outcome.introOutcome === 'GREAT_MEETING') outcomeScore = Math.max(outcomeScore, 1.0);
    else if (outcome.introOutcome === 'GOOD_CHAT') outcomeScore = Math.max(outcomeScore, 0.5);
    else if (outcome.introOutcome === 'NOT_A_FIT') outcomeScore = Math.min(outcomeScore, -0.5);
    else if (outcome.introOutcome === 'DIDNT_MEET') outcomeScore = Math.min(outcomeScore, -0.3);

    if (outcome.response === 'ACCEPTED' && outcomeScore === 0) outcomeScore = 0.2;
    else if (outcome.response === 'REJECTED' && outcomeScore === 0) outcomeScore = -0.2;

    similarMatchScores.push(outcomeScore * similarity);
  }

  if (similarMatchScores.length < 3) return 1.0;

  const avgScore = similarMatchScores.reduce((a, b) => a + b, 0) / similarMatchScores.length;

  return Math.max(0.5, Math.min(1.3, 1.0 + avgScore * 0.3));
}

interface DynamicIntentResult {
  multiplier: number;
  inferredIntent: string | null;
}

async function computeDynamicIntent(userId: string): Promise<DynamicIntentResult | null> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [recentMatches, profileViewActivities] = await Promise.all([
      prisma.match.findMany({
        where: {
          OR: [{ userAId: userId }, { userBId: userId }],
          createdAt: { gte: thirtyDaysAgo },
        },
        select: {
          userAId: true,
          userBId: true,
          userAResponse: true,
          userBResponse: true,
          userB: { select: { profile: { select: { persona: true } } } },
          userA: { select: { profile: { select: { persona: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.activity.findMany({
        where: {
          userId,
          type: { in: ['PROFILE_VIEW', 'MATCH_PROFILE_VIEW', 'VIEW_PROFILE'] },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { metadata: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    if (recentMatches.length < 3 && profileViewActivities.length < 3) return null;

    const personaAccepts: Record<string, number> = {};
    const personaDeclines: Record<string, number> = {};

    for (const m of recentMatches) {
      const isA = m.userAId === userId;
      const response = isA ? m.userAResponse : m.userBResponse;
      const otherPersona = isA
        ? m.userB?.profile?.persona
        : m.userA?.profile?.persona;

      if (!otherPersona || !response) continue;

      if (response === 'ACCEPTED') {
        personaAccepts[otherPersona] = (personaAccepts[otherPersona] || 0) + 1;
      } else if (response === 'REJECTED') {
        personaDeclines[otherPersona] = (personaDeclines[otherPersona] || 0) + 1;
      }
    }

    const viewedPersonas: Record<string, number> = {};
    for (const activity of profileViewActivities) {
      const meta = activity.metadata as Record<string, any> | null;
      if (meta?.viewedPersona) {
        const persona = meta.viewedPersona as string;
        viewedPersonas[persona] = (viewedPersonas[persona] || 0) + 1;
      }
    }

    let inferredIntent: string | null = null;
    let multiplier = 1.0;

    const investorDeclines = (personaDeclines['INVESTOR'] || 0) + (personaDeclines['VENTURE_PARTNER'] || 0);
    const investorAccepts = (personaAccepts['INVESTOR'] || 0) + (personaAccepts['VENTURE_PARTNER'] || 0);
    const investorViews = (viewedPersonas['INVESTOR'] || 0) + (viewedPersonas['VENTURE_PARTNER'] || 0);

    if (investorDeclines >= 3 && investorDeclines > investorAccepts * 2 && investorViews < 3) {
      inferredIntent = 'NOT_FUNDRAISING';
      multiplier = 0.85;
    }

    const talentDeclines = (personaDeclines['TALENT'] || 0) + (personaDeclines['JOB_SEEKER'] || 0);
    const talentAccepts = (personaAccepts['TALENT'] || 0) + (personaAccepts['JOB_SEEKER'] || 0);
    const talentViews = (viewedPersonas['TALENT'] || 0) + (viewedPersonas['JOB_SEEKER'] || 0);

    if (talentDeclines >= 3 && talentDeclines > talentAccepts * 2 && talentViews < 3) {
      inferredIntent = 'NOT_HIRING';
      multiplier = 0.85;
    }

    const totalAccepts = Object.values(personaAccepts).reduce((a, b) => a + b, 0);
    const totalDeclines = Object.values(personaDeclines).reduce((a, b) => a + b, 0);
    const totalResponses = totalAccepts + totalDeclines;
    const totalViews = Object.values(viewedPersonas).reduce((a, b) => a + b, 0);

    if (totalResponses >= 5 && totalAccepts / totalResponses >= 0.8) {
      multiplier = 1.1;
      inferredIntent = 'HIGHLY_ENGAGED';
    } else if (totalViews >= 10 && totalResponses >= 3 && totalAccepts / totalResponses >= 0.7) {
      multiplier = 1.1;
      inferredIntent = 'HIGHLY_ENGAGED';
    } else if (totalResponses >= 5 && totalAccepts / totalResponses <= 0.2 && totalViews <= 2) {
      multiplier = 0.7;
      inferredIntent = 'DISENGAGED';
    }

    return { multiplier, inferredIntent };
  } catch (err) {
    console.error('[Matching] Failed to compute dynamic intent:', err);
    return null;
  }
}

export async function backfillEmbeddings(
  batchSize = 10
): Promise<{ total: number; success: number; failed: number }> {
  const safeSize = Math.min(Math.max(Math.floor(Number(batchSize) || 10), 1), 50);

  const profilesWithoutEmbeddings = await prisma.$queryRawUnsafe<{ userId: string }[]>(
    `SELECT p."userId"
     FROM profiles p
     LEFT JOIN user_embeddings ue ON p."userId" = ue."userId" AND ue.source = 'PROFILE'
     WHERE p."isComplete" = true AND ue.id IS NULL
     LIMIT $1`,
    safeSize
  );

  let success = 0;
  let failed = 0;

  for (const { userId } of profilesWithoutEmbeddings) {
    const generated = await ensureEmbedding(userId);
    if (generated) success++;
    else failed++;
  }

  console.log(`[MatchingAPI] Backfill: ${success} success, ${failed} failed out of ${profilesWithoutEmbeddings.length}`);

  return { total: profilesWithoutEmbeddings.length, success, failed };
}

export async function getEmbeddingStats(): Promise<{
  totalProfiles: number;
  withEmbeddings: number;
  withoutEmbeddings: number;
  coveragePercent: number;
}> {
  const [profileCount, embeddingCount] = await Promise.all([
    prisma.profile.count({ where: { isComplete: true } }),
    prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(DISTINCT "userId") as count FROM user_embeddings WHERE source = 'PROFILE'`
    ),
  ]);

  const withEmbeddings = parseInt(embeddingCount[0]?.count || '0');
  const withoutEmbeddings = profileCount - withEmbeddings;

  return {
    totalProfiles: profileCount,
    withEmbeddings,
    withoutEmbeddings,
    coveragePercent: profileCount > 0 ? Math.round((withEmbeddings / profileCount) * 100) : 0,
  };
}

async function getRuleBasedCandidates(
  userProfile: ProfileForMatching,
  excludeUserIds: string[],
  limit: number
): Promise<ProfileForMatching[]> {
  const allExcluded = [userProfile.userId, ...excludeUserIds];

  const profiles = await prisma.profile.findMany({
    where: {
      userId: { notIn: allExcluded },
      isComplete: true,
      ...(userProfile.industries.length > 0
        ? { industries: { hasSome: userProfile.industries } }
        : {}),
    },
    take: limit,
  });

  return profiles.map((p: any) => mapProfileToMatching(p));
}

async function getAllCompletedProfiles(
  excludeUserId: string,
  additionalExcludes: string[] = []
): Promise<ProfileForMatching[]> {
  const allExcluded = [excludeUserId, ...additionalExcludes];

  const profiles = await prisma.profile.findMany({
    where: {
      userId: { notIn: allExcluded },
      isComplete: true,
    },
  });

  return profiles.map((p: any) => mapProfileToMatching(p));
}

function mapProfileToMatching(p: any): ProfileForMatching {
  const extraData = p.extraData as Record<string, any> | null;

  const portfolioStrings: string[] = p.portfolioCompanies || [];
  const portfolioCompanies = portfolioStrings.length > 0
    ? portfolioStrings.map((s: string) => {
        const match = s.match(/^(.+?)\s*\((.+?)\)$/);
        if (match) return { name: match[1].trim(), sector: match[2].trim() };
        return { name: s, sector: s };
      })
    : (extraData?.portfolioCompanies || undefined);

  const mapExpertiseInputs = [
    ...(p.skills || []),
    ...(extraData?.enrichedData?.domainExpertise || []),
  ];
  if (p.headline) mapExpertiseInputs.push(p.headline);
  if (p.functionalArea) mapExpertiseInputs.push(p.functionalArea);
  const expertiseTags = normalizeToExpertiseTags(mapExpertiseInputs);

  return {
    userId: p.userId,
    persona: p.persona || 'OTHER',
    companyStage: p.companyStage || undefined,
    industries: p.industries || [],
    interests: p.interests || [],
    lookingFor: p.lookingFor || [],
    location: p.location || undefined,
    skills: p.skills || [],
    headline: p.headline || undefined,
    bio: p.bio || undefined,
    priority: p.priority || undefined,
    targetRole: p.targetRole || undefined,
    investorType: p.investorType || undefined,
    investmentAmount: p.investmentAmount || undefined,
    raiseAmount: p.raiseAmount || undefined,
    trackedCompanies: p.trackedCompanies || undefined,
    industryFocus: p.industryFocus || [],
    investmentThesis: p.investmentThesis || undefined,
    fundName: p.fundName || undefined,
    businessDescription: p.businessDescription || undefined,
    investmentRange: p.investmentRange || undefined,
    keyTractionPoints: p.keyTractionPoints || undefined,
    companyName: p.companyName || undefined,
    portfolioCompanies,
    openToMeeting: p.openToMeeting ?? true,
    weeklyIntroCap: p.maxIntrosPerWeek || undefined,
    equityPreference: p.equityExpectation || extraData?.equityPreference || undefined,
    workStyle: p.workStyle || extraData?.workStyle || undefined,
    functionalArea: p.functionalArea || extraData?.functionalArea || undefined,
    tractionMetrics: buildTractionMetrics(p, extraData),
    enrichedData: extraData?.enrichedData || undefined,
    expertiseTags,
    matchingGoal: extraData?.matchingGoal || undefined,
    matchingExpertiseNeeded: extraData?.matchingExpertiseNeeded || undefined,
  };
}
