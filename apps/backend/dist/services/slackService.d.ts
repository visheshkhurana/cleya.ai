declare class SlackService {
    private enabled;
    private post;
    postAlert(text: string, blocks?: any[]): Promise<void>;
    notifySecurityAlert(title: string, details: string): Promise<void>;
    notifyUserRegistered(user: {
        id: string;
        email: string;
        name?: string;
    }): Promise<void>;
    sendDailyReport(): Promise<void>;
}
export declare const slackService: SlackService;
export {};
//# sourceMappingURL=slackService.d.ts.map