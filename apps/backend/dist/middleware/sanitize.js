"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeInput = sanitizeInput;
const NULL_BYTE_REGEX = /\x00/g;
const CONTROL_CHAR_REGEX = /[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
function sanitizeValue(value) {
    if (typeof value === 'string') {
        return value
            .replace(NULL_BYTE_REGEX, '')
            .replace(CONTROL_CHAR_REGEX, '')
            .normalize('NFKC');
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value !== null && typeof value === 'object') {
        const result = {};
        for (const [k, v] of Object.entries(value)) {
            result[k] = sanitizeValue(v);
        }
        return result;
    }
    return value;
}
function sanitizeInput(req, _res, next) {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeValue(req.body);
    }
    next();
}
//# sourceMappingURL=sanitize.js.map