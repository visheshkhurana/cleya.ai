import { ProfileForMatching } from '@cleya/matching';
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
    portfolioCompanies?: Array<{
        name: string;
        sector: string;
        stage?: string;
    }>;
    openToMeeting?: boolean;
    weeklyIntroCap?: number;
    equityPreference?: string;
    workStyle?: string;
    functionalArea?: string;
    tractionMetrics?: {
        revenue?: number;
        mrr?: number;
        userCount?: number;
        growthRate?: number;
        runway?: number;
    };
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
export declare function profileDataToText(data: ProfileData): string;
export declare function generateEmbedding(profileData: ProfileData): Promise<EmbeddingResult>;
export declare function generateAndStoreEmbedding(userId: string, profileData: ProfileData): Promise<EmbeddingResult>;
/**
 * Hard exclusion list for the matching candidate pool. Two rules:
 *   1. The candidate user MUST have a real `name` (non-null, non-empty).
 *      Without this guard, downstream notification code falls back to
 *      synthesizing a "name" from role/company/email — which surfaces
 *      the same person under different labels and breaks user trust.
 *   2. Test/seed domains never appear as live matches.
 *
 * Kept in one place so vector + rule-based + fallback paths agree.
 */
export declare const TEST_EMAIL_DOMAINS: string[];
export declare function findSimilarByVector(userId: string, options?: {
    limit?: number;
    minSimilarity?: number;
    excludeUserIds?: string[];
}): Promise<VectorSearchResult[]>;
export declare function findSimilarByText(queryText: string, options?: {
    limit?: number;
    minSimilarity?: number;
    excludeUserIds?: string[];
}): Promise<VectorSearchResult[]>;
export declare function getProfileForMatching(userId: string): Promise<ProfileForMatching | null>;
export declare function userHasEmbedding(userId: string): Promise<boolean>;
export declare function ensureEmbedding(userId: string): Promise<boolean>;
export declare function findMatches(userId: string, limit?: number): Promise<HybridMatchResult[]>;
export declare function hybridMatch(userId: string, options?: {
    limit?: number;
    vectorCandidatePool?: number;
    minScore?: number;
    excludeUserIds?: string[];
}): Promise<HybridMatchResult[]>;
export declare function backfillEmbeddings(batchSize?: number): Promise<{
    total: number;
    success: number;
    failed: number;
}>;
export declare function getEmbeddingStats(): Promise<{
    totalProfiles: number;
    withEmbeddings: number;
    withoutEmbeddings: number;
    coveragePercent: number;
}>;
