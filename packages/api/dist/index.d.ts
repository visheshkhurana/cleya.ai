export { generateEmbedding, generateAndStoreEmbedding, findMatches, findSimilarByVector, findSimilarByText, hybridMatch, getProfileForMatching, ensureEmbedding, userHasEmbedding, backfillEmbeddings, getEmbeddingStats, profileDataToText, } from './services/matching';
export type { ProfileData, EmbeddingResult, VectorSearchResult, HybridMatchResult, } from './services/matching';
