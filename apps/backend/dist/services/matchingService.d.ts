import { ProfileForMatching } from '@cleya/matching';
export declare class MatchingService {
    private ai;
    findMatchesForUser(userId: string, limit?: number): Promise<{
        profile: ProfileForMatching;
        score: {
            total: number;
            ruleScore: number;
            semanticScore: number;
            breakdown: Record<string, number>;
        };
    }[]>;
    findAndAutoPropose(userId: string, limit?: number): Promise<{
        matchId: string;
        userId: string;
        score: number;
        reason: string | null;
    }[]>;
    proposeMatch(userAId: string, userBId: string, eventId?: string): Promise<{
        status: import(".prisma/client").$Enums.MatchStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        reason: string | null;
        userBId: string;
        userAId: string;
        userAResponse: import(".prisma/client").$Enums.MatchResponse | null;
        userBResponse: import(".prisma/client").$Enums.MatchResponse | null;
        score: number;
        scoreBreakdown: import("@prisma/client/runtime/library").JsonValue | null;
        userARespondedAt: Date | null;
        userBRespondedAt: Date | null;
        expiresAt: Date | null;
        eventId: string | null;
        userAViewedAt: Date | null;
        userBViewedAt: Date | null;
    }>;
    respondToMatch(matchId: string, userId: string, response: 'ACCEPTED' | 'REJECTED'): Promise<{
        status: import(".prisma/client").$Enums.MatchStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        reason: string | null;
        userBId: string;
        userAId: string;
        userAResponse: import(".prisma/client").$Enums.MatchResponse | null;
        userBResponse: import(".prisma/client").$Enums.MatchResponse | null;
        score: number;
        scoreBreakdown: import("@prisma/client/runtime/library").JsonValue | null;
        userARespondedAt: Date | null;
        userBRespondedAt: Date | null;
        expiresAt: Date | null;
        eventId: string | null;
        userAViewedAt: Date | null;
        userBViewedAt: Date | null;
    }>;
    private revealContacts;
    getMatchesForUser(userId: string): Promise<({
        userA: {
            id: string;
            name: string | null;
            email: string;
            profile: {
                persona: import(".prisma/client").$Enums.PersonaType | null;
                headline: string | null;
                bio: string | null;
                companyName: string | null;
                companyStage: import(".prisma/client").$Enums.CompanyStage | null;
                currentRole: string | null;
                location: string | null;
                linkedinUrl: string | null;
                yearsExperience: number | null;
                industries: string[];
                skills: string[];
                businessDescription: string | null;
                fundName: string | null;
                investmentRange: string | null;
                investmentThesis: string | null;
                keyTractionPoints: string | null;
                raiseAmount: string | null;
                verificationScore: number;
                avatarUrl: string | null;
            } | null;
        };
        userB: {
            id: string;
            name: string | null;
            email: string;
            profile: {
                persona: import(".prisma/client").$Enums.PersonaType | null;
                headline: string | null;
                bio: string | null;
                companyName: string | null;
                companyStage: import(".prisma/client").$Enums.CompanyStage | null;
                currentRole: string | null;
                location: string | null;
                linkedinUrl: string | null;
                yearsExperience: number | null;
                industries: string[];
                skills: string[];
                businessDescription: string | null;
                fundName: string | null;
                investmentRange: string | null;
                investmentThesis: string | null;
                keyTractionPoints: string | null;
                raiseAmount: string | null;
                verificationScore: number;
                avatarUrl: string | null;
            } | null;
        };
    } & {
        status: import(".prisma/client").$Enums.MatchStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        reason: string | null;
        userBId: string;
        userAId: string;
        userAResponse: import(".prisma/client").$Enums.MatchResponse | null;
        userBResponse: import(".prisma/client").$Enums.MatchResponse | null;
        score: number;
        scoreBreakdown: import("@prisma/client/runtime/library").JsonValue | null;
        userARespondedAt: Date | null;
        userBRespondedAt: Date | null;
        expiresAt: Date | null;
        eventId: string | null;
        userAViewedAt: Date | null;
        userBViewedAt: Date | null;
    })[]>;
    markMatchViewed(matchId: string, userId: string): Promise<{
        status: import(".prisma/client").$Enums.MatchStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        reason: string | null;
        userBId: string;
        userAId: string;
        userAResponse: import(".prisma/client").$Enums.MatchResponse | null;
        userBResponse: import(".prisma/client").$Enums.MatchResponse | null;
        score: number;
        scoreBreakdown: import("@prisma/client/runtime/library").JsonValue | null;
        userARespondedAt: Date | null;
        userBRespondedAt: Date | null;
        expiresAt: Date | null;
        eventId: string | null;
        userAViewedAt: Date | null;
        userBViewedAt: Date | null;
    }>;
    getMatchStats(userId: string): Promise<{
        total: number;
        pending: number;
        accepted: number;
    }>;
    private scheduleFeedbackPrompt;
    private progressDealOnAcceptance;
    autoScoutFounders(dealPartnerId: string, limit?: number): Promise<({
        founder: {
            id: string;
            email: string;
            profile: {
                persona: import(".prisma/client").$Enums.PersonaType | null;
                headline: string | null;
                companyName: string | null;
            } | null;
        };
    } & {
        status: import(".prisma/client").$Enums.DealStatus;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        stage: import(".prisma/client").$Enums.CompanyStage | null;
        notes: string | null;
        dealPartnerId: string;
        founderId: string;
        industry: string | null;
        introSent: boolean;
        introSentAt: Date | null;
        responseStatus: import(".prisma/client").$Enums.DealResponse | null;
        carryPercentage: number | null;
        closeDate: Date | null;
        dealValue: number | null;
        introDate: Date | null;
    })[]>;
    findEventMatches(eventId: string, userId: string, limit?: number): Promise<{
        profile: ProfileForMatching;
        score: {
            total: number;
            ruleScore: number;
            semanticScore: number;
            breakdown: Record<string, number>;
        };
    }[]>;
    matchEventParticipants(eventId: string, limit?: number): Promise<{
        userId: string;
        matchesProposed: number;
    }[]>;
    private generateMatchReason;
    private static SAFE_CAPITALIZED_TOKENS;
    private matchReasonNamesAreSafe;
    private formatCompatibilitySignals;
}
export declare const matchingService: MatchingService;
/**
 * Build 2-3 anonymized teaser strings to embed in profile-nudge emails.
 * The goal is to show the new user that real, relevant people are already
 * here without leaking PII before both sides have opted into the intro.
 *
 * Strategy:
 *   1. Read the user's persona (default OTHER if missing)
 *   2. Pull the persona row from PERSONA_COMPATIBILITY and pick the
 *      personas they'd most plausibly meet (compat >= 0.6)
 *   3. Sample up to 6 verified, complete profiles in those personas
 *   4. Compose anonymized headlines like
 *      "Series-A SaaS founder, Bangalore" — never any name, email or
 *      company
 */
export declare function getProfileNudgeTeasers(userId: string, count?: number): Promise<string[]>;
//# sourceMappingURL=matchingService.d.ts.map