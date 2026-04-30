"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboundEmailRouter = void 0;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const matchActionToken_1 = require("../services/matchActionToken");
const matchingService_1 = require("../services/matchingService");
const email_1 = require("../services/email");
const db_1 = require("@cleya/db");
const env_1 = require("../config/env");
/**
 * Resend Inbound webhook.
 *
 * Resend can be configured to POST every inbound message at a domain
 * (e.g. reply.cleya.ai) to a webhook of our choosing. This route receives
 * those POSTs, locates the original Match via the signed local-part of
 * the To: address, parses a yes/no out of the body, and feeds it through
 * the same MatchingService.respondToMatch path as every other channel.
 *
 * Setup notes (printed in /api/inbound/email/dns for the user):
 *   1. Verify domain `reply.cleya.ai` in Resend
 *   2. Add the MX record they show you
 *   3. Set REPLY_INBOUND_DOMAIN=reply.cleya.ai
 *   4. Set RESEND_INBOUND_SECRET to the webhook signing secret
 *   5. Configure inbound webhook URL → /api/inbound/email
 */
exports.inboundEmailRouter = (0, express_1.Router)();
const ACCEPT_WORDS = new Set([
    'yes', 'accept', 'connect', 'sure', 'ok', 'okay', 'yeah', 'yep', 'y', '1',
    'go ahead', 'lets go', "let's go", 'do it', 'send it', 'intro me', 'please do',
]);
const DECLINE_WORDS = new Set([
    'no', 'decline', 'pass', 'skip', 'nah', 'nope', 'n', '2',
    'not now', 'maybe later', "don't", 'do not',
]);
/**
 * Walk the inbound text, look at the first non-quote, non-empty line and
 * the first sentence-ish chunk. Mail clients prepend the new reply at the
 * top above the quoted history, so this catches "yes\n\nOn Tue, ..."
 * and "Sure, sounds good." style replies.
 */
function detectIntent(rawText) {
    if (!rawText)
        return 'unclear';
    // Drop quoted lines (>) and signature blocks; keep only the user's new
    // text. Take the first ~5 non-empty lines so a long quoted history
    // doesn't drown out a one-word "yes" at the top.
    const newLines = rawText
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('>') && !/^on .+ wrote:$/i.test(l) && !/^-- ?$/.test(l))
        .slice(0, 5);
    const head = newLines.join(' ').toLowerCase();
    if (!head)
        return 'unclear';
    // Token-level pass — exact word at start gives strongest signal.
    const firstToken = head.split(/[\s.,!?]+/).filter(Boolean)[0] || '';
    if (ACCEPT_WORDS.has(firstToken))
        return 'accept';
    if (DECLINE_WORDS.has(firstToken))
        return 'decline';
    // Phrase pass — substring match anywhere in the head.
    for (const w of ACCEPT_WORDS)
        if (head.includes(w))
            return 'accept';
    for (const w of DECLINE_WORDS)
        if (head.includes(w))
            return 'decline';
    return 'unclear';
}
/**
 * Resend signs inbound webhooks with the same Svix-style HMAC scheme as
 * outbound event webhooks. We accept either `Svix-Signature` or
 * `resend-signature` to be tolerant of header casing variations.
 */
function verifySignature(req, rawBody) {
    const secret = env_1.env.RESEND_INBOUND_SECRET;
    if (!secret) {
        // No secret configured. We REJECT in any non-development environment so
        // that a forgotten env var can never be turned into an unauthenticated
        // webhook. In dev we accept (with a loud warning) so local curl tests
        // and webhook simulator runs still work.
        if (env_1.env.NODE_ENV === 'production') {
            console.error('[inboundEmail] RESEND_INBOUND_SECRET not set in production — rejecting webhook');
            return false;
        }
        console.warn('[inboundEmail] RESEND_INBOUND_SECRET not set — accepting webhook without signature verification (dev only)');
        return true;
    }
    const sig = (req.header('svix-signature') || req.header('resend-signature') || '').toString();
    const id = (req.header('svix-id') || '').toString();
    const ts = (req.header('svix-timestamp') || '').toString();
    if (!sig || !id || !ts)
        return false;
    // Svix-style signing: HMAC-SHA256 over `${id}.${ts}.${body}`, base64.
    // The secret may be prefixed with `whsec_` — strip it and base64-decode
    // when present (matches Svix client behaviour).
    const rawSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    let key;
    try {
        key = Buffer.from(rawSecret, 'base64');
        if (!key.length)
            key = Buffer.from(rawSecret, 'utf8');
    }
    catch {
        key = Buffer.from(rawSecret, 'utf8');
    }
    const signedPayload = `${id}.${ts}.${rawBody}`;
    const expected = crypto_1.default.createHmac('sha256', key).update(signedPayload).digest('base64');
    // Svix sig header looks like `v1,<sig> v1,<sig2>` — accept any.
    const sigs = sig.split(' ').map((s) => s.split(',')[1]).filter(Boolean);
    return sigs.some((s) => {
        try {
            return crypto_1.default.timingSafeEqual(Buffer.from(s), Buffer.from(expected));
        }
        catch {
            return false;
        }
    });
}
exports.inboundEmailRouter.get('/dns', (_req, res) => {
    const domain = env_1.env.REPLY_INBOUND_DOMAIN || '<your-reply-subdomain.cleya.ai>';
    res.type('text').send([
        'Resend Inbound DNS setup',
        '========================',
        '',
        `1. In Resend, add domain: ${domain}`,
        '2. Add the MX record Resend shows you (something like):',
        `   ${domain}.   IN MX 10  inbound-smtp.resend.com.`,
        '3. Add the suggested SPF / DKIM TXT records',
        `4. Set env REPLY_INBOUND_DOMAIN=${domain}`,
        '5. Set env RESEND_INBOUND_SECRET to your webhook signing secret',
        '6. Point the inbound webhook to this server:',
        `   POST ${env_1.env.BACKEND_URL || 'https://api.cleya.ai'}/api/inbound/email`,
        '',
        `Status: ${env_1.env.REPLY_INBOUND_DOMAIN ? 'enabled' : 'disabled (REPLY_INBOUND_DOMAIN not set)'}`,
    ].join('\n'));
});
exports.inboundEmailRouter.post('/email', async (req, res) => {
    // index.ts express.json verify callback stashes the exact request bytes
    // on req.rawBody for any URL starting with /api/inbound/email. Fall back
    // to a re-stringified body for local curl testing (no signature anyway).
    const rawBody = req.rawBody || JSON.stringify(req.body || {});
    if (!verifySignature(req, rawBody)) {
        console.warn('[inboundEmail] signature verification failed');
        return res.status(401).json({ ok: false, error: 'bad_signature' });
    }
    const payload = req.body || {};
    // Resend payload shape (see https://resend.com/docs/dashboard/webhooks):
    //   { type: 'email.received', data: { from, to, subject, text, html, ... } }
    const data = payload?.data || payload;
    // Resend can deliver `to` as a plain string, an array of strings, or an
    // array of `{ email, name }` objects depending on provider config — handle
    // all three.
    const toAddrs = Array.isArray(data?.to)
        ? data.to
        : (data?.to ? [data.to] : []);
    const fromAddr = (data?.from?.email || data?.from || '').toString().toLowerCase();
    const text = data?.text || data?.body_plain || data?.bodyPlain;
    if (!toAddrs.length || !fromAddr) {
        return res.status(400).json({ ok: false, error: 'missing_fields' });
    }
    // Pull the local-part of the *first* matching reply-to address. The
    // user might have CC'd other addresses too; we ignore those.
    let matched = null;
    for (const to of toAddrs) {
        const addr = (typeof to === 'string' ? to : to?.email || '').toString().toLowerCase();
        const at = addr.indexOf('@');
        if (at < 0)
            continue;
        const local = addr.slice(0, at);
        const verified = (0, matchActionToken_1.verifyInboundReplyLocalPart)(local);
        if (verified.ok) {
            matched = { matchId: verified.matchId, userId: verified.userId };
            break;
        }
    }
    if (!matched) {
        console.warn('[inboundEmail] no signed match address in To:', toAddrs);
        return res.status(202).json({ ok: true, ignored: 'no_signed_to_address' });
    }
    const intent = detectIntent(text);
    if (intent === 'unclear') {
        console.log(`[inboundEmail] unclear reply for match ${matched.matchId}; not responding`);
        return res.json({ ok: true, intent: 'unclear' });
    }
    // Sanity: confirm the From: address actually matches the user we're
    // about to mark a response for. Stops a spammer who somehow learned a
    // valid signed local-part from impersonating the recipient.
    const user = await db_1.prisma.user.findUnique({ where: { id: matched.userId } });
    if (!user)
        return res.status(404).json({ ok: false, error: 'user_not_found' });
    if (user.email && user.email.toLowerCase() !== fromAddr) {
        console.warn(`[inboundEmail] from-address ${fromAddr} != registered ${user.email}; rejecting`);
        return res.status(403).json({ ok: false, error: 'from_mismatch' });
    }
    const match = await db_1.prisma.match.findUnique({
        where: { id: matched.matchId },
        include: {
            userA: { include: { profile: true } },
            userB: { include: { profile: true } },
        },
    });
    if (!match)
        return res.status(404).json({ ok: false, error: 'match_not_found' });
    const isUserA = match.userAId === matched.userId;
    const alreadyResponded = isUserA
        ? match.userAResponse !== 'PENDING'
        : match.userBResponse !== 'PENDING';
    if (alreadyResponded) {
        return res.json({ ok: true, ignored: 'already_responded' });
    }
    const dbResponse = intent === 'accept' ? 'ACCEPTED' : 'REJECTED';
    try {
        const updated = await matchingService_1.matchingService.respondToMatch(matched.matchId, matched.userId, dbResponse);
        const partner = isUserA ? match.userB : match.userA;
        const responder = isUserA ? match.userA : match.userB;
        if (responder?.email && partner?.name) {
            email_1.emailService.sendIntroResponseAck({
                to: responder.email,
                responderName: responder.name || 'there',
                partnerName: partner.name,
                action: intent,
                bothAccepted: updated.status === 'ACCEPTED',
            }).catch((e) => console.error('[inboundEmail] ack email failed:', e?.message || e));
        }
        return res.json({ ok: true, intent, response: dbResponse });
    }
    catch (err) {
        console.error('[inboundEmail] respond error:', err?.message || err);
        return res.status(500).json({ ok: false, error: 'respond_failed' });
    }
});
//# sourceMappingURL=inboundEmail.js.map