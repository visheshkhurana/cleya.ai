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
        notes: string | null;
        founderId: string;
        dealPartnerId: string;
        industry: string | null;
        stage: import(".prisma/client").$Enums.CompanyStage | null;
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
    private formatCompatibilitySignals;
}
export declare const matchingService: MatchingService;
//# sourceMappingURL=matchingService.d.ts.map