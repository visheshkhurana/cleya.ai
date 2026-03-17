import { prisma } from '@boardy/db';
import { createAIService } from '@boardy/ai';
import { matchingEngine, ProfileForMatching } from '@boardy/matching';
import { profileService } from './profileService';

export interface VectorSearchResult {
  userId: string;
  similarity: number;
}

export interface HybridMatchResult {
  userId: string;
  vectorSimilarity: number;
  ruleScore: number;
  intentScore: number;
  hybridScore: number;
  breakdown: Record<string, number>;
  profile: ProfileForMatching;
}

export class VectorMatchingService {
  private ai = createAIService();

  async findSimilarByVector(
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
       LIMIT ${limit}`,
      userId,
      minSimilarity,
      ...allExcluded
    );

    return results.map((r) => ({
      userId: r.userId,
      similarity: parseFloat(String(r.similarity)),
    }));
  }

  async findSimilarByText(
    queryText: string,
    options: { limit?: number; minSimilarity?: number; excludeUserIds?: string[] } = {}
  ): Promise<VectorSearchResult[]> {
    const { limit = 20, minSimilarity = 0.2, excludeUserIds = [] } = options;

    const embeddingResult = await this.ai.embed(queryText);
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

    query += ` ORDER BY ue.vector <=> $1::vector LIMIT ${limit}`;

    const results = await prisma.$queryRawUnsafe<VectorSearchResult[]>(query, ...params);

    return results.map((r) => ({
      userId: r.userId,
      similarity: parseFloat(String(r.similarity)),
    }));
  }

  async hybridMatch(
    userId: string,
    options: { limit?: number; vectorCandidatePool?: number; minScore?: number; excludeUserIds?: string[] } = {}
  ): Promise<HybridMatchResult[]> {
    const { limit = 10, vectorCandidatePool = 50, minScore = 0.30, excludeUserIds = [] } = options;

    const userProfile = await this.getProfileForMatching(userId);
    if (!userProfile) {
      throw new Error('Profile not found for user');
    }

    const hasEmbedding = await this.userHasEmbedding(userId);

    let candidateIds: Set<string>;

    if (hasEmbedding) {
      const vectorResults = await this.findSimilarByVector(userId, {
        limit: vectorCandidatePool,
        minSimilarity: 0.15,
        excludeUserIds,
      });
      candidateIds = new Set(vectorResults.map((r) => r.userId));

      const ruleBasedCandidates = await this.getRuleBasedCandidates(userProfile, excludeUserIds, 20);
      for (const c of ruleBasedCandidates) {
        candidateIds.add(c.userId);
      }
    } else {
      const allCandidates = await this.getAllCompletedProfiles(userId, excludeUserIds);
      candidateIds = new Set(allCandidates.map((c) => c.userId));
    }

    const candidateProfiles = await Promise.all(
      Array.from(candidateIds).map((id) => this.getProfileForMatching(id))
    );

    const validCandidates = candidateProfiles.filter(Boolean) as ProfileForMatching[];

    const scored: HybridMatchResult[] = validCandidates.map((candidate) => {
      const matchScore = matchingEngine.score(userProfile, candidate);

      let vectorSimilarity = matchScore.breakdown.semanticSimilarity || 0;

      const hybridScore = matchScore.total;

      return {
        userId: candidate.userId,
        vectorSimilarity,
        ruleScore: matchScore.ruleScore,
        intentScore: matchScore.breakdown.intentScore || 0,
        hybridScore,
        breakdown: matchScore.breakdown,
        profile: candidate,
      };
    });

    return scored
      .filter((r) => r.hybridScore >= minScore)
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, limit);
  }

  async ensureEmbedding(userId: string): Promise<boolean> {
    const hasEmb = await this.userHasEmbedding(userId);
    if (hasEmb) return true;

    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) return false;

    try {
      await profileService.generateEmbedding(userId, profile);
      return true;
    } catch (error) {
      console.error(`[VectorMatching] Failed to generate embedding for ${userId}:`, error);
      return false;
    }
  }

  async backfillEmbeddings(batchSize = 10): Promise<{ total: number; success: number; failed: number }> {
    const profilesWithoutEmbeddings = await prisma.$queryRawUnsafe<{ userId: string }[]>(
      `SELECT p."userId"
       FROM profiles p
       LEFT JOIN user_embeddings ue ON p."userId" = ue."userId" AND ue.source = 'PROFILE'
       WHERE p."isComplete" = true AND ue.id IS NULL
       LIMIT $1`,
      batchSize
    );

    let success = 0;
    let failed = 0;

    for (const { userId } of profilesWithoutEmbeddings) {
      const generated = await this.ensureEmbedding(userId);
      if (generated) success++;
      else failed++;
    }

    console.log(`[VectorMatching] Backfill: ${success} success, ${failed} failed out of ${profilesWithoutEmbeddings.length}`);

    return { total: profilesWithoutEmbeddings.length, success, failed };
  }

  async getEmbeddingStats(): Promise<{
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

  private async userHasEmbedding(userId: string): Promise<boolean> {
    const result = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
      `SELECT EXISTS(SELECT 1 FROM user_embeddings WHERE "userId" = $1 AND source = 'PROFILE') as exists`,
      userId
    );
    return result[0]?.exists || false;
  }

  private async getRuleBasedCandidates(
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

    return profiles.map((p: any) => ({
      userId: p.userId,
      persona: p.persona || 'OTHER',
      companyStage: p.companyStage || undefined,
      industries: p.industries,
      interests: p.interests,
      lookingFor: p.lookingFor,
      location: p.location || undefined,
      skills: p.skills,
      headline: p.headline || undefined,
      bio: p.bio || undefined,
      priority: p.priority || undefined,
      targetRole: p.targetRole || undefined,
      investorType: p.investorType || undefined,
      investmentAmount: p.investmentAmount || undefined,
      raiseAmount: p.raiseAmount || undefined,
    }));
  }

  private async getAllCompletedProfiles(
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

    return profiles.map((p: any) => ({
      userId: p.userId,
      persona: p.persona || 'OTHER',
      companyStage: p.companyStage || undefined,
      industries: p.industries,
      interests: p.interests,
      lookingFor: p.lookingFor,
      location: p.location || undefined,
      skills: p.skills,
      headline: p.headline || undefined,
      bio: p.bio || undefined,
      priority: p.priority || undefined,
      targetRole: p.targetRole || undefined,
      investorType: p.investorType || undefined,
      investmentAmount: p.investmentAmount || undefined,
      raiseAmount: p.raiseAmount || undefined,
    }));
  }

  async getProfileForMatching(userId: string): Promise<ProfileForMatching | null> {
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
    };
  }
}

export const vectorMatchingService = new VectorMatchingService();
