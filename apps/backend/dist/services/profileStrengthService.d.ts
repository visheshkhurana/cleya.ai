export interface ProfileStrengthChecklist {
    key: string;
    label: string;
    done: boolean;
    weight: number;
}
export interface ProfileStrengthResult {
    score: number;
    checklist: ProfileStrengthChecklist[];
    isComplete: boolean;
}
export declare class ProfileStrengthService {
    computeFromProfile(user: {
        emailVerified: boolean;
        phoneVerified: boolean;
    }, profile: any): ProfileStrengthResult;
    recompute(userId: string): Promise<ProfileStrengthResult | null>;
    getStrength(userId: string): Promise<ProfileStrengthResult | null>;
}
export declare const profileStrengthService: ProfileStrengthService;
//# sourceMappingURL=profileStrengthService.d.ts.map