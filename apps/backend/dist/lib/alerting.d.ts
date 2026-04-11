export declare enum AlertSeverity {
    P1_CRITICAL = "P1",
    P2_HIGH = "P2",
    P3_MEDIUM = "P3",
    P4_LOW = "P4"
}
export interface AlertPayload {
    severity: AlertSeverity;
    title: string;
    service: string;
    message: string;
    error?: string;
    errorRate?: number;
    duration?: number;
    status?: string;
    metadata?: Record<string, unknown>;
}
export declare function sendAlert(alert: AlertPayload): Promise<void>;
//# sourceMappingURL=alerting.d.ts.map