import { findMatches, findSimilarByVector, findSimilarByText, hybridMatch, getProfileForMatching, ensureEmbedding, backfillEmbeddings, getEmbeddingStats, type VectorSearchResult, type HybridMatchResult, type ProfileData } from '@cleya/api';
export declare class VectorMatchingService {
    findMatches: typeof findMatches;
    findSimilarByVector: typeof findSimilarByVector;
    findSimilarByText: typeof findSimilarByText;
    hybridMatch: typeof hybridMatch;
    getProfileForMatching: typeof getProfileForMatching;
    ensureEmbedding: typeof ensureEmbedding;
    backfillEmbeddings: typeof backfillEmbeddings;
    getEmbeddingStats: typeof getEmbeddingStats;
    generateAndStoreEmbedding(userId: string, profileData: ProfileData): Promise<import("@cleya/api").EmbeddingResult>;
}
export declare const vectorMatchingService: VectorMatchingService;
export type { VectorSearchResult, HybridMatchResult, ProfileData };
//# sourceMappingURL=vectorMatchingService.d.ts.map