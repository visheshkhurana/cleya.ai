import {
  findSimilarByVector,
  findSimilarByText,
  hybridMatch,
  getProfileForMatching,
  ensureEmbedding,
  backfillEmbeddings,
  getEmbeddingStats,
  generateAndStoreEmbedding,
  type VectorSearchResult,
  type HybridMatchResult,
  type ProfileData,
} from '@boardy/api';

export class VectorMatchingService {
  findSimilarByVector = findSimilarByVector;
  findSimilarByText = findSimilarByText;
  hybridMatch = hybridMatch;
  getProfileForMatching = getProfileForMatching;
  ensureEmbedding = ensureEmbedding;
  backfillEmbeddings = backfillEmbeddings;
  getEmbeddingStats = getEmbeddingStats;

  async generateAndStoreEmbedding(userId: string, profileData: ProfileData) {
    return generateAndStoreEmbedding(userId, profileData);
  }
}

export const vectorMatchingService = new VectorMatchingService();

export type { VectorSearchResult, HybridMatchResult, ProfileData };
