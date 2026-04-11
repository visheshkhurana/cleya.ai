export interface VerificationResult {
    score: number;
    factors: {
        emailVerified: boolean;
        linkedinVerified: boolean;
        profileComplete: boolean;
        hasHeadline: boolean;
        hasCompany: boolean;
        hasIndustries: boolean;
        hasSkills: boolean;
        hasLocation: boolean;
    };
    tier: 'unverified' | 'basic' | 'verified' | 'trusted';
}
export declare function calculateVerificationScore(userId: string): Promise<VerificationResult>;
export declare function getVerificationBadge(score: number): {
    label: string;
    color: string;
    icon: string;
};
//# sourceMappingURL=verificationService.d.ts.map