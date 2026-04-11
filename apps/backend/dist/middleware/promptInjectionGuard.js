"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.promptInjectionGuard = promptInjectionGuard;
exports.scanForInjection = scanForInjection;
const aiAuditService_1 = require("../services/aiAuditService");
const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i,
    /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i,
    /forget\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i,
    /override\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/i,
    /you\s+are\s+now\s+(a\s+)?new\s+(ai|assistant|bot|system)/i,
    /act\s+as\s+(if\s+)?(you\s+are\s+)?(a\s+)?(jailbroken|unrestricted|unfiltered)/i,
    /\bDAN\b.*\b(mode|prompt|jailbreak)\b/i,
    /\b(jailbreak|do\s+anything\s+now)\b/i,
    /\bsystem\s*prompt\b/i,
    /\bsystem\s*message\b/i,
    /reveal\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions?|message)/i,
    /show\s+(me\s+)?(your|the)\s+(system|initial|original)\s+(prompt|instructions?|message)/i,
    /what\s+(are|is)\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions?|message)/i,
    /repeat\s+(your|the)\s+(system|initial|original)\s+(prompt|instructions?|message)/i,
    /pretend\s+(you\s+are|to\s+be)\s+(a\s+)?(different|new|evil|malicious)/i,
    /\brole\s*play\s*as\b.*\b(admin|root|system|developer)\b/i,
    /\[\s*SYSTEM\s*\]/i,
    /<<\s*SYS\s*>>/i,
    /\{\{.*system.*\}\}/i,
];
const INVISIBLE_CHAR_PATTERN = /[\u200B\u200C\u200D\u200E\u200F\u2028\u2029\u202A-\u202E\u2060\u2061\u2062\u2063\u2064\uFEFF\uFFF9\uFFFA\uFFFB]/;
const HOMOGLYPH_SUSPICIOUS = /[\u0410-\u044F\u0370-\u03FF\u1D00-\u1D7F\u2100-\u214F]/;
const EXCESSIVE_DELIMITER_PATTERN = /([=\-#*~`]{10,})/;
const EXCESSIVE_NEWLINES_PATTERN = /(\n\s*){20,}/;
function scanForInjection(text) {
    if (INVISIBLE_CHAR_PATTERN.test(text)) {
        return { blocked: true, reason: 'Input contains invisible or zero-width characters' };
    }
    const normalizedForHomoglyphs = text.replace(/[a-zA-Z0-9\s.,!?'"()\-:;@#$%^&*+=\[\]{}|\\/<>~`_]/g, '');
    if (normalizedForHomoglyphs.length > 0 && HOMOGLYPH_SUSPICIOUS.test(normalizedForHomoglyphs)) {
        const homoglyphRatio = normalizedForHomoglyphs.length / text.length;
        if (homoglyphRatio > 0.3) {
            return { blocked: true, reason: 'Input contains suspicious character substitutions' };
        }
    }
    if (EXCESSIVE_DELIMITER_PATTERN.test(text)) {
        return { blocked: true, reason: 'Input contains excessive delimiter characters' };
    }
    if (EXCESSIVE_NEWLINES_PATTERN.test(text)) {
        return { blocked: true, reason: 'Input contains excessive whitespace' };
    }
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(text)) {
            return { blocked: true, reason: 'Input contains potentially harmful instructions' };
        }
    }
    return { blocked: false };
}
function promptInjectionGuard(req, res, next) {
    const fieldsToScan = [];
    if (req.body?.message && typeof req.body.message === 'string') {
        fieldsToScan.push(req.body.message);
    }
    if (Array.isArray(req.body?.history)) {
        for (const h of req.body.history) {
            if (h?.content && typeof h.content === 'string') {
                fieldsToScan.push(h.content);
            }
        }
    }
    for (const text of fieldsToScan) {
        const result = scanForInjection(text);
        if (result.blocked) {
            console.warn(`[PROMPT_INJECTION_GUARD] Blocked request from ${req.user?.userId || 'unknown'}: ${result.reason}`);
            if (req.user?.userId) {
                (0, aiAuditService_1.logAIInteraction)({
                    userId: req.user.userId,
                    endpoint: req.originalUrl,
                    inputLength: text.length,
                    outputLength: 0,
                    latencyMs: 0,
                    promptInjectionDetected: true,
                    success: false,
                    errorMessage: `Prompt injection blocked: ${result.reason}`,
                }).catch(() => { });
            }
            res.status(400).json({
                success: false,
                error: {
                    message: result.reason,
                    code: 'PROMPT_INJECTION_DETECTED',
                },
            });
            return;
        }
    }
    next();
}
//# sourceMappingURL=promptInjectionGuard.js.map