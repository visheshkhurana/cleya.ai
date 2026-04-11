"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhookTimestamp = verifyWebhookTimestamp;
exports.verifyHmacSignature = verifyHmacSignature;
exports.webhookRawBodyParser = webhookRawBodyParser;
exports.webhookPayloadSizeLimit = webhookPayloadSizeLimit;
exports.requireWebhookTimestamp = requireWebhookTimestamp;
exports.getRawBody = getRawBody;
const crypto_1 = __importDefault(require("crypto"));
const express_1 = __importDefault(require("express"));
const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
function verifyWebhookTimestamp(timestampHeader, toleranceMs = WEBHOOK_TIMESTAMP_TOLERANCE_MS) {
    if (!timestampHeader)
        return false;
    const timestamp = parseInt(timestampHeader, 10);
    if (isNaN(timestamp))
        return false;
    const timestampMs = timestamp < 1e12 ? timestamp * 1000 : timestamp;
    const now = Date.now();
    const age = Math.abs(now - timestampMs);
    return age <= toleranceMs;
}
function verifyHmacSignature(payload, signature, secret, algorithm = 'sha256') {
    const expected = crypto_1.default
        .createHmac(algorithm, secret)
        .update(payload)
        .digest('hex');
    const sigHex = signature.startsWith('sha256=')
        ? signature.slice(7)
        : signature.startsWith('sha1=')
            ? signature.slice(5)
            : signature;
    if (sigHex.length !== expected.length)
        return false;
    return crypto_1.default.timingSafeEqual(Buffer.from(sigHex, 'hex'), Buffer.from(expected, 'hex'));
}
function webhookRawBodyParser(maxBytes = 512 * 1024) {
    return express_1.default.json({
        limit: maxBytes,
        verify: (req, _res, buf) => {
            req.rawBody = buf;
        },
    });
}
function webhookPayloadSizeLimit(maxBytes = 1024 * 1024) {
    return (req, res, next) => {
        const contentLength = parseInt(req.headers['content-length'] || '0', 10);
        if (contentLength > maxBytes) {
            console.warn(`[Webhook Security] Payload too large: ${contentLength} bytes (max ${maxBytes})`);
            res.status(413).json({ error: 'Payload too large' });
            return;
        }
        next();
    };
}
function requireWebhookTimestamp(headerName) {
    return (req, res, next) => {
        const timestamp = req.headers[headerName.toLowerCase()];
        if (!verifyWebhookTimestamp(timestamp)) {
            console.warn(`[Webhook Security] Rejected: missing or stale timestamp header '${headerName}'`);
            res.status(403).json({ error: 'Invalid or expired webhook timestamp' });
            return;
        }
        next();
    };
}
function getRawBody(req) {
    return req.rawBody;
}
//# sourceMappingURL=webhookSecurity.js.map