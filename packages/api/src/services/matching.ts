import { prisma } from '@cleya/db';
import { createAIService } from '@cleya/ai';
import { matchingEngine, ProfileForMatching } from '@cleya/matching';

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
  ];
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

  return {
    userId,
    persona: (profile as any).persona || 'OTHER',
    companyStage: (profile as any).companyStage || undefined,
    industries: profile.industries,
    interests: profile.interests,
    lookingFor: profile.lookingFor,
    location: profile.location || undefined,
    skills: profile.skills,
    headline: profile.headline || undefined,
    bio: profile.bio || undefined,
    embedding,
    priority: (profile as any).priority || undefined,
    targetRole: (profile as any).targetRole || undefined,
    investorType: (profile as any).investorType || undefined,
    investmentAmount: (profile as any).investmentAmount || undefined,
    raiseAmount: (profile as any).raiseAmount || undefined,
    trackedCompanies: (profile as any).trackedCompanies || undefined,
    industryFocus: (profile as any).industryFocus || [],
    investmentThesis: (profile as any).investmentThesis || undefined,
    fundName: (profile as any).fundName || undefined,
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
    minScore: 0.30,
    excludeUserIds: alreadyMatchedIds,
  });
}

export async function hybridMatch(
  userId: string,
  options: { limit?: number; vectorCandidatePool?: number; minScore?: number; excludeUserIds?: string[] } = {}
): Promise<HybridMatchResult[]> {
  const { limit = 10, vectorCandidatePool = 50, minScore = 0.30, excludeUserIds = [] } = options;

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

  const scored: HybridMatchResult[] = crossPersonaCandidates.map((candidate) => {
    const matchScore = matchingEngine.score(userProfile, candidate);

    return {
      userId: candidate.userId,
      vectorSimilarity: matchScore.breakdown.semanticSimilarity || 0,
      ruleScore: matchScore.ruleScore,
      hybridScore: matchScore.total,
      breakdown: matchScore.breakdown,
      profile: candidate,
    };
  });

  return scored
    .filter((r) => r.hybridScore >= minScore)
    .sort((a, b) => b.hybridScore - a.hybridScore)
    .slice(0, limit);
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
  };
}
