export declare function isZoomConfigured(): boolean;
export declare function createZoomOAuthState(userId: string): Promise<string>;
export declare function validateZoomState(state: string): Promise<string | null>;
export declare function getZoomAuthUrl(state: string): string;
export declare function handleZoomCallback(userId: string, code: string): Promise<void>;
export declare function createZoomMeeting(userId: string, topic: string, startTime: Date, durationMinutes?: number, agenda?: string): Promise<{
    joinUrl: string;
    meetingId: string;
    startUrl: string;
} | null>;
export declare function isUserZoomConnected(userId: string): Promise<boolean>;
export declare function disconnectZoom(userId: string): Promise<void>;
//# sourceMappingURL=zoomService.d.ts.map