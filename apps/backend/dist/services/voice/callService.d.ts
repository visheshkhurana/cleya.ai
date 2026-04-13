export declare class CallService {
    private ai;
    initiateCall(userId: string, phoneNumber: string): Promise<null>;
    updateCallStatus(callId: string, status: string, duration?: number): Promise<void>;
    getCallHistory(userId: string): Promise<{
        status: import(".prisma/client").$Enums.CallStatus;
        userId: string;
        id: string;
        createdAt: Date;
        phoneNumber: string;
        scheduledAt: Date | null;
        startedAt: Date | null;
        twilioCallSid: string | null;
        direction: import(".prisma/client").$Enums.CallDirection;
        duration: number | null;
        transcript: import("@prisma/client/runtime/library").JsonValue | null;
        extractedData: import("@prisma/client/runtime/library").JsonValue | null;
        endedAt: Date | null;
    }[]>;
}
export declare const callService: CallService;
//# sourceMappingURL=callService.d.ts.map