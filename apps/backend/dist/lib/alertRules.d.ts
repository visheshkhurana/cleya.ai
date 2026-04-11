import { AlertSeverity } from './alerting';
export declare function recordEvent(ruleName: string): void;
export declare function getAlertRules(): {
    currentCount: number;
    triggered: boolean;
    name: string;
    severity: AlertSeverity;
    threshold: number;
    windowMs: number;
    service: string;
    message: string;
}[];
//# sourceMappingURL=alertRules.d.ts.map