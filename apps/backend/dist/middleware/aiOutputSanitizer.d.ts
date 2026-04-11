interface SanitizeOptions {
    maxLength?: number;
    redactPII?: boolean;
    validateURLs?: boolean;
    sanitizeHTML?: boolean;
}
interface SanitizeResult {
    content: string;
    redactions: string[];
    truncated: boolean;
    urlsRemoved: number;
}
export declare function sanitizeAIOutput(content: string, options?: SanitizeOptions): SanitizeResult;
export {};
//# sourceMappingURL=aiOutputSanitizer.d.ts.map