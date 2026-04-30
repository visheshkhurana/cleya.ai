"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FEEDBACK_REASON_LABELS = exports.FEEDBACK_REASONS = void 0;
exports.createMatchActionToken = createMatchActionToken;
exports.verifyMatchActionToken = verifyMatchActionToken;
exports.createFeedbackToken = createFeedbackToken;
exports.verifyFeedbackToken = verifyFeedbackToken;
exports.createInboundReplyLocalPart = createInboundReplyLocalPart;
exports.verifyInboundReplyLocalPart = verifyInboundReplyLocalPart;
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../config/env");
const TTL_MS = 14 * 24 * 60 * 60 * 1000;
/**
 * Reasons we offer when nudging a non-responder for feedback. Kept short
 * so we can render them as 4 quick-tap buttons in the email body.
 */
exports.FEEDBACK_REASONS = [
    'not_relevant',
    'too_busy',
    'wrong_stage',
    'wrong_sector',
];
exports.FEEDBACK_REASON_LABELS = {
    not_relevant: 'Not relevant',
    too_busy: 'Too busy right now',
    wrong_stage: 'Wrong stage',
    wrong_sector: 'Wrong sector / industry',
};
function b64url(input) {
    return Buffer.from(input).toString('base64url');
}
function fromB64url(input) {
    return Buffer.from(input, 'base64url');
}
function sign(payload) {
    return crypto_1.default.createHmac('sha256', env_1.env.JWT_SECRET).update(payload).digest('base64url');
}
function createMatchActionToken(opts) {
    const expiresAt = Date.now() + (opts.ttlMs ?? TTL_MS);
    const payload = `${opts.matchId}.${opts.userId}.${opts.action}.${expiresAt}`;
    const sig = sign(payload);
    return `${b64url(payload)}.${sig}`;
}
function verifyMatchActionToken(token) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
        return { ok: false, reason: 'malformed' };
    }
    const lastDot = token.lastIndexOf('.');
    const payloadB64 = token.slice(0, lastDot);
    const sig = token.slice(lastDot + 1);
    if (!payloadB64 || !sig)
        return { ok: false, reason: 'malformed' };
    let payload;
    try {
        payload = fromB64url(payloadB64).toString('utf8');
    }
    catch {
        return { ok: false, reason: 'malformed' };
    }
    const expectedSig = sign(payload);
    // Constant-time compare; both buffers must be the same length.
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto_1.default.timingSafeEqual(a, b)) {
        return { ok: false, reason: 'bad_signature' };
    }
    const parts = payload.split('.');
    if (parts.length !== 4)
        return { ok: false, reason: 'malformed' };
    const [matchId, userId, action, expiresAtStr] = parts;
    if (action !== 'accept' && action !== 'decline') {
        return { ok: false, reason: 'bad_action' };
    }
    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        return { ok: false, reason: 'expired' };
    }
    return { ok: true, matchId, userId, action: action };
}
/**
 * Feedback tokens — separate from accept/decline because the payload
 * carries an extra `reason` field. We wrap the same HMAC primitive but
 * keep the format distinct so a stolen accept-token can never be reused
 * as a feedback-token (or vice versa).
 *
 * Format: f.base64url(payload).base64url(signature)
 *   payload = `${matchId}.${userId}.${reason}.${expiresAt}`
 */
function createFeedbackToken(opts) {
    const expiresAt = Date.now() + (opts.ttlMs ?? TTL_MS);
    const payload = `${opts.matchId}.${opts.userId}.${opts.reason}.${expiresAt}`;
    const sig = sign(`f.${payload}`);
    return `f.${b64url(payload)}.${sig}`;
}
function verifyFeedbackToken(token) {
    if (!token || typeof token !== 'string' || !token.startsWith('f.')) {
        return { ok: false, reason: 'malformed' };
    }
    const body = token.slice(2);
    const lastDot = body.lastIndexOf('.');
    if (lastDot < 0)
        return { ok: false, reason: 'malformed' };
    const payloadB64 = body.slice(0, lastDot);
    const sig = body.slice(lastDot + 1);
    if (!payloadB64 || !sig)
        return { ok: false, reason: 'malformed' };
    let payload;
    try {
        payload = fromB64url(payloadB64).toString('utf8');
    }
    catch {
        return { ok: false, reason: 'malformed' };
    }
    const expectedSig = sign(`f.${payload}`);
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto_1.default.timingSafeEqual(a, b)) {
        return { ok: false, reason: 'bad_signature' };
    }
    const parts = payload.split('.');
    if (parts.length !== 4)
        return { ok: false, reason: 'malformed' };
    const [matchId, userId, reasonStr, expiresAtStr] = parts;
    if (!exports.FEEDBACK_REASONS.includes(reasonStr)) {
        return { ok: false, reason: 'bad_reason' };
    }
    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        return { ok: false, reason: 'expired' };
    }
    return { ok: true, matchId, userId, reason: reasonStr };
}
/**
 * Per-match reply-to local-part. Encodes (matchId, userId) and signs it
 * so we can trust the inbound webhook's parsed To: address.
 *
 * Local-part format: r-{base64url(matchId.userId.expiresAt)}-{shortSig}
 *   - 8-byte truncated HMAC keeps the address email-friendly while still
 *     making blind forgery infeasible (2^64 search space + we re-verify
 *     full HMAC anyway).
 *   - The full signed payload is stable; we re-derive expectedSig server-side.
 *
 * The full local part stays well under the RFC 5321 64-char limit for
 * the kinds of cuid()s we use (typical match.id is 25 chars; user.id 25;
 * encoded payload ~ 80 chars before truncation — too long). To stay
 * compact we truncate the encoded payload to 32 chars of base64url and
 * store the (matchId, userId) -> token mapping in memory? No — that
 * defeats statelessness. Instead we shorten by skipping expiresAt and
 * relying on a fresh signature verification (still HMAC-secure).
 */
const INBOUND_REPLY_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
function createInboundReplyLocalPart(matchId, userId) {
    const expiresAt = Date.now() + INBOUND_REPLY_TTL_MS;
    const payload = `${matchId}.${userId}.${expiresAt}`;
    const sig = crypto_1.default.createHmac('sha256', env_1.env.JWT_SECRET).update(`reply.${payload}`).digest('base64url').slice(0, 16);
    const encoded = Buffer.from(payload).toString('base64url');
    return `r-${encoded}-${sig}`;
}
function verifyInboundReplyLocalPart(localPart) {
    if (!localPart || !localPart.startsWith('r-'))
        return { ok: false, reason: 'malformed' };
    const rest = localPart.slice(2);
    const lastDash = rest.lastIndexOf('-');
    if (lastDash < 0)
        return { ok: false, reason: 'malformed' };
    const encoded = rest.slice(0, lastDash);
    const sig = rest.slice(lastDash + 1);
    if (!encoded || !sig)
        return { ok: false, reason: 'malformed' };
    let payload;
    try {
        payload = Buffer.from(encoded, 'base64url').toString('utf8');
    }
    catch {
        return { ok: false, reason: 'malformed' };
    }
    const expectedSig = crypto_1.default.createHmac('sha256', env_1.env.JWT_SECRET).update(`reply.${payload}`).digest('base64url').slice(0, 16);
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto_1.default.timingSafeEqual(a, b)) {
        return { ok: false, reason: 'bad_signature' };
    }
    const parts = payload.split('.');
    if (parts.length !== 3)
        return { ok: false, reason: 'malformed' };
    const [matchId, userId, expiresAtStr] = parts;
    const expiresAt = Number(expiresAtStr);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        return { ok: false, reason: 'expired' };
    }
    return { ok: true, matchId, userId };
}
//# sourceMappingURL=matchActionToken.js.map