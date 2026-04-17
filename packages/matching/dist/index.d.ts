import { MatchScore } from '@cleya/types';
export interface ProfileForMatching {
    userId: string;
    persona: string;
    companyStage?: string;
    industries: string[];
    interests: string[];
    lookingFor: string[];
    location?: string;
    skills: string[];
    headline?: string;
    bio?: string;
    embedding?: number[];
    priority?: string;
    targetRole?: string;
    investorType?: string;
    investmentAmount?: string;
    raiseAmount?: string;
    trackedCompanies?: string;
    industryFocus?: string[];
    investmentThesis?: string;
    fundName?: string;
    companyName?: string;
    businessDescription?: string;
    investmentRange?: string;
    portfolioCompanies?: PortfolioCompany[];
    openToMeeting?: boolean;
    weeklyIntroCap?: number;
    weeklyIntrosUsed?: number;
    equityPreference?: string;
    workStyle?: string;
    functionalArea?: string;
    tractionMetrics?: TractionMetrics;
    enrichedData?: EnrichedProfileData;
    keyTractionPoints?: string;
    expertiseTags?: string[];
    matchingGoal?: string;
    matchingExpertiseNeeded?: string[];
}
export interface PortfolioCompany {
    name: string;
    sector: string;
    stage?: string;
}
export interface TractionMetrics {
    revenue?: number;
    mrr?: number;
    userCount?: number;
    growthRate?: number;
    runway?: number;
}
export interface EnrichedProfileData {
    careerHistory?: string[];
    domainExpertise?: string[];
    notableCompanies?: string[];
    exits?: string[];
    enrichedAt?: string;
}
export interface FeedbackSignal {
    userId: string;
    avgRating: number;
    totalFeedbacks: number;
    acceptRate: number;
    declineRate: number;
    positiveOutcomeRate: number;
}
export interface CompatibilitySignals {
    sectorOverlapPct: number;
    stageFit: boolean;
    checkSizeAligned: boolean;
    skillComplementarity: number;
    tractionHighlights: string[];
    conflictFlags: string[];
}
export declare const PERSONA_COMPATIBILITY: Record<string, Record<string, number>>;
export declare const EXPERTISE_TAGS: Record<string, string[]>;
export declare function normalizeToExpertiseTags(inputs: string[]): string[];
export declare class MatchingEngine {
    private ruleWeight;
    private intentWeight;
    private semanticWeight;
    private sectorFamilyCache;
    private getSectorFamily;
    private scoreSectorSimilarity;
    score(profileA: ProfileForMatching, profileB: ProfileForMatching): MatchScore;
    computeCompatibilitySignals(profileA: ProfileForMatching, profileB: ProfileForMatching): CompatibilitySignals;
    passesIntentFilter(user: ProfileForMatching, candidate: ProfileForMatching): boolean;
    findMatches(user: ProfileForMatching, candidates: ProfileForMatching[], options?: {
        limit?: number;
        minScore?: number;
    }): Array<{
        profile: ProfileForMatching;
        score: MatchScore;
    }>;
    private scoreRoleMatch;
    private scoreFounderContextMatch;
    private scoreIntentAlignment;
    private scoreSkillRelevance;
    private scoreTractionStageAlignment;
    detectPortfolioConflict(a: ProfileForMatching, b: ProfileForMatching): number;
    private scoreTalentPreferences;
    private scoreStageMatch;
    private parseMoneyValue;
    private scoreArrayOverlap;
    private scoreLocation;
    private cosineSimilarity;
}
export declare const matchingEngine: MatchingEngine;
//# sourceMappingURL=index.d.ts.map