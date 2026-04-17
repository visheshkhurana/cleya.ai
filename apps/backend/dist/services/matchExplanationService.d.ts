export interface ExplanationFactor {
    key: string;
    label: string;
    value: number;
    weight: number;
}
export interface MatchExplanation {
    matchId: string;
    overallScore: number;
    factors: ExplanationFactor[];
    rationale: string;
    summary: string;
    mutualConnections: number;
    recentActivity: string | null;
}
export declare class MatchExplanationService {
    getForUser(matchId: string, userId: string): Promise<MatchExplanation | null>;
    private buildSummary;
    private formatActivity;
}
export declare const matchExplanationService: MatchExplanationService;
//# sourceMappingURL=matchExplanationService.d.ts.map