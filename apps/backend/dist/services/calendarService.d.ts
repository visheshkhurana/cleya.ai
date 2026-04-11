import { calendar_v3 } from 'googleapis';
export declare function isCalendarConfigured(): boolean;
export declare function getAuthUrl(userId: string): Promise<string>;
export declare function validateState(state: string): Promise<string | null>;
export declare function cleanupExpiredStates(): Promise<void>;
export declare function handleCallback(code: string, userId: string): Promise<void>;
export declare function isUserCalendarConnected(userId: string): Promise<boolean>;
export declare function getCalendarStatus(userId: string): Promise<{
    connected: boolean;
    email?: string;
}>;
export declare function getEvents(userId: string, timeMin?: Date, timeMax?: Date): Promise<calendar_v3.Schema$Event[]>;
export declare function createEvent(userId: string, event: {
    summary: string;
    description?: string;
    start: Date;
    end: Date;
    attendees?: string[];
}): Promise<calendar_v3.Schema$Event>;
export declare function checkAvailability(userId: string, date: Date): Promise<{
    busy: Array<{
        start: string;
        end: string;
    }>;
    free: boolean;
}>;
export declare function disconnect(userId: string): Promise<void>;
//# sourceMappingURL=calendarService.d.ts.map