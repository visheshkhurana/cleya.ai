declare class EmailService {
    private resendAvailable;
    private send;
    sendWelcome(email: string): Promise<void>;
    sendMatchProposed(recipientEmail: string, recipientName: string, matchName: string, matchPersona: string, matchScore: number, matchDetails?: {
        companyName?: string;
        headline?: string;
        raiseAmount?: string;
        sector?: string;
        stage?: string;
        traction?: string;
        linkedinUrl?: string;
        location?: string;
        bio?: string;
        matchReason?: string;
    }): Promise<void>;
    sendMatchAccepted(recipientEmail: string, recipientName: string, matchName: string, matchPersona: string, matchEmail: string, matchLinkedin?: string, matchDetails?: {
        headline?: string;
        companyName?: string;
        sector?: string;
        location?: string;
        matchReason?: string;
        matchUserId?: string;
    }): Promise<void>;
    sendPasswordReset(email: string, token: string): Promise<void>;
    sendEmailVerification(email: string, token: string): Promise<void>;
    sendNewMatch(email: string, matchName: string, matchScore: number): Promise<void>;
    sendWeeklyDigest(userId: string): Promise<void>;
    sendMeetingInvite(to: string, otherName: string, title: string, meetingTime: Date, duration: number, meetingUrl: string | null): Promise<void>;
    sendFollowup(to: string, subject: string, body: string): Promise<void>;
    sendDailyDigest(to: string, digestContent: string): Promise<void>;
    sendIntroductionEmail(recipientEmail: string, recipientName: string, introPersonName: string, introBody: string, linkedinUrl?: string): Promise<void>;
    private generateICS;
    sendProfileNudge(email: string, name?: string): Promise<boolean>;
    sendHowMatchingWorks(email: string, name?: string): Promise<boolean>;
    sendMatchCheckIn(email: string, name?: string): Promise<boolean>;
    sendPostIntroFollowUp(email: string, name?: string, matchName?: string): Promise<boolean>;
    sendFeedbackRequest(email: string, name?: string, matchName?: string): Promise<boolean>;
    sendDigestToAll(): Promise<{
        sent: number;
        failed: number;
        total: number;
    }>;
}
export declare const emailService: EmailService;
export {};
//# sourceMappingURL=email.d.ts.map