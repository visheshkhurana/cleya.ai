interface ContentQueueItem {
    id: number;
    agent_id: string;
    channel: string;
    content_type: string;
    title: string;
    body: string;
    media_urls: string[];
    scheduled_for: string;
    status: string;
    metadata: Record<string, any>;
}
interface PublishResult {
    success: boolean;
    platform: string;
    postId?: string;
    error?: string;
}
export declare function publishContentItem(itemId: number): Promise<PublishResult>;
export declare function publishCalendarItem(calendarId: number): Promise<PublishResult>;
export declare function processContentCalendar(): Promise<{
    published: number;
    failed: number;
    errors: string[];
}>;
export declare function publishApprovedContent(): Promise<{
    published: number;
    failed: number;
    errors: string[];
}>;
export declare function approveCalendarItem(calendarId: number, founderNotes?: string, publishImmediately?: boolean): Promise<{
    success: boolean;
    error?: string;
    publishResult?: PublishResult;
}>;
export declare function rejectCalendarItem(calendarId: number, founderNotes?: string): Promise<{
    success: boolean;
    error?: string;
}>;
export declare const publishingService: {
    publishContentItem: typeof publishContentItem;
    publishApprovedContent: typeof publishApprovedContent;
    publishCalendarItem: typeof publishCalendarItem;
    processContentCalendar: typeof processContentCalendar;
    approveCalendarItem: typeof approveCalendarItem;
    rejectCalendarItem: typeof rejectCalendarItem;
    publishToLinkedIn: (item: ContentQueueItem) => Promise<PublishResult>;
    publishToInstagram: (item: ContentQueueItem) => Promise<PublishResult>;
    publishViaEmail: (item: ContentQueueItem) => Promise<PublishResult>;
};
export {};
//# sourceMappingURL=publishingService.d.ts.map