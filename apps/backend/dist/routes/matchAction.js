"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchActionRouter = void 0;
const express_1 = require("express");
const matchActionToken_1 = require("../services/matchActionToken");
const matchingService_1 = require("../services/matchingService");
const email_1 = require("../services/email");
const db_1 = require("@cleya/db");
const env_1 = require("../config/env");
/**
 * One-click email response endpoint.
 *
 * GET /api/match/respond?token=...
 *
 * The token is HMAC-signed and binds (matchId, userId, action). We do NOT
 * accept any ?action= query override — the action is always whatever the
 * token was issued for, so a single tampered URL can't flip Accept→Decline.
 *
 * Verifies the HMAC-signed token, records the user's response via the same
 * MatchingService.respondToMatch path the web UI uses (so all the
 * downstream side-effects — joint intro email, drip enrollment, deal
 * progression — fire identically), then sends an instant acknowledgement
 * email and renders a tiny HTML confirmation page.
 *
 * No login required. The token is the proof of identity.
 */
exports.matchActionRouter = (0, express_1.Router)();
const matchingService = new matchingService_1.MatchingService();
function renderConfirmation(opts) {
    const accent = opts.variant === 'success' ? '#0D9488' :
        opts.variant === 'error' ? '#dc2626' : '#475569';
    const cta = opts.cta
        ? `<p style="margin-top:24px;"><a href="${opts.cta.url}" style="display:inline-block;padding:12px 28px;background:${accent};color:#fff;font-weight:600;border-radius:8px;text-decoration:none;">${opts.cta.label}</a></p>`
        : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${opts.title} — Cleya</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:520px;margin:80px auto;padding:40px;background:#fff;border-radius:16px;box-shadow:0 4px 20px rgba(0,0,0,0.06);text-align:center;">
    <div style="font-size:14px;font-weight:600;color:${accent};letter-spacing:0.05em;text-transform:uppercase;">Cleya</div>
    <h1 style="margin:16px 0 12px;font-size:24px;color:#0f172a;">${opts.title}</h1>
    <p style="margin:0;font-size:16px;line-height:1.6;color:#475569;">${opts.message}</p>
    ${cta}
  </div>
</body></html>`;
}
exports.matchActionRouter.get('/respond', async (req, res) => {
    const tokenRaw = req.query.token;
    if (typeof tokenRaw !== 'string' || !tokenRaw) {
        return res.status(400).type('html').send(renderConfirmation({
            title: 'Link missing',
            message: "This link doesn't include the response token. Please use the button in the original email.",
            variant: 'error',
        }));
    }
    const verified = (0, matchActionToken_1.verifyMatchActionToken)(tokenRaw);
    if (!verified.ok) {
        const reason = verified.reason === 'expired'
            ? "This link has expired. Open the introduction in your dashboard to respond."
            : "This link looks invalid. Open the introduction in your dashboard to respond.";
        return res.status(400).type('html').send(renderConfirmation({
            title: 'Link not valid',
            message: reason,
            variant: 'error',
            cta: { label: 'Open dashboard', url: `${env_1.env.FRONTEND_URL}/matches` },
        }));
    }
    // The action is bound to the signed token at issue time. We deliberately
    // ignore any ?action= query param so a single Accept token can never be
    // converted into a Decline by URL tampering, and vice versa.
    const { matchId, userId, action: finalAction } = verified;
    const dbResponse = finalAction === 'accept' ? 'ACCEPTED' : 'REJECTED';
    try {
        const match = await db_1.prisma.match.findUnique({
            where: { id: matchId },
            include: {
                userA: { include: { profile: true } },
                userB: { include: { profile: true } },
            },
        });
        if (!match) {
            return res.status(404).type('html').send(renderConfirmation({
                title: 'Introduction not found',
                message: "We couldn't find this introduction — it may have been removed.",
                variant: 'error',
            }));
        }
        const isUserA = match.userAId === userId;
        const alreadyResponded = isUserA
            ? match.userAResponse !== 'PENDING'
            : match.userBResponse !== 'PENDING';
        if (alreadyResponded) {
            const partner = isUserA ? match.userB : match.userA;
            return res.type('html').send(renderConfirmation({
                title: 'Already noted',
                message: `You've already responded to your introduction with ${partner?.name || 'this person'}. ${match.status === 'ACCEPTED' ? "Both of you are connected — check your inbox for the warm intro." : "We'll let you know when there's an update."}`,
                variant: 'info',
                cta: { label: 'Open dashboard', url: `${env_1.env.FRONTEND_URL}/matches` },
            }));
        }
        const updated = await matchingService.respondToMatch(matchId, userId, dbResponse);
        const partner = isUserA ? match.userB : match.userA;
        const responder = isUserA ? match.userA : match.userB;
        // Fire the instant ack email — non-blocking so the user gets the
        // confirmation page immediately even if Resend is slow.
        if (responder?.email && partner?.name) {
            email_1.emailService.sendIntroResponseAck({
                to: responder.email,
                responderName: responder.name || 'there',
                partnerName: partner.name,
                action: finalAction,
                bothAccepted: updated.status === 'ACCEPTED',
            }).catch((e) => console.error('[matchAction] ack email failed:', e?.message || e));
        }
        if (finalAction === 'accept') {
            const bothAccepted = updated.status === 'ACCEPTED';
            return res.type('html').send(renderConfirmation({
                title: bothAccepted ? "You're connected!" : "Got it — message sent",
                message: bothAccepted
                    ? `${partner?.name || 'They'} also said yes. The warm intro is hitting both your inboxes now.`
                    : `I've conveyed your interest to ${partner?.name || 'them'}. The moment they say yes, I'll send the warm intro to both of you.`,
                variant: 'success',
                cta: { label: 'Open dashboard', url: `${env_1.env.FRONTEND_URL}/matches` },
            }));
        }
        else {
            return res.type('html').send(renderConfirmation({
                title: 'Noted',
                message: `Thanks for the quick reply. I'll keep curating sharper introductions for you.`,
                variant: 'info',
                cta: { label: 'Open dashboard', url: `${env_1.env.FRONTEND_URL}/matches` },
            }));
        }
    }
    catch (err) {
        console.error('[matchAction] respond error:', err?.message || err);
        return res.status(500).type('html').send(renderConfirmation({
            title: 'Something went wrong',
            message: "We couldn't record your response. Please try again from your dashboard.",
            variant: 'error',
            cta: { label: 'Open dashboard', url: `${env_1.env.FRONTEND_URL}/matches` },
        }));
    }
});
/**
 * Non-response feedback endpoint.
 *
 * GET /api/match/feedback?token=...
 *
 * After 72h with no response from a recipient, we email them a tiny menu
 * of "why didn't this land?" reasons (4 quick-tap buttons). Each button
 * carries a signed feedback token; clicking it records a MatchFeedback
 * row with reasonCode set, then renders a thank-you confirmation page.
 *
 * The signal feeds the matching algorithm so we stop suggesting people
 * with the same mismatch (wrong stage, wrong sector, etc.).
 */
exports.matchActionRouter.get('/feedback', async (req, res) => {
    const tokenRaw = req.query.token;
    if (typeof tokenRaw !== 'string' || !tokenRaw) {
        return res.status(400).type('html').send(renderConfirmation({
            title: 'Link missing',
            message: "This link doesn't include the feedback token. Please use the button in the original email.",
            variant: 'error',
        }));
    }
    const verified = (0, matchActionToken_1.verifyFeedbackToken)(tokenRaw);
    if (!verified.ok) {
        return res.status(400).type('html').send(renderConfirmation({
            title: 'Link not valid',
            message: verified.reason === 'expired'
                ? "This feedback link has expired."
                : "This feedback link looks invalid.",
            variant: 'error',
            cta: { label: 'Open dashboard', url: `${env_1.env.FRONTEND_URL}/matches` },
        }));
    }
    const { matchId, userId, reason } = verified;
    try {
        // Upsert so a user can change their mind / click a different reason
        // within the 14-day window without crashing on the unique constraint.
        await db_1.prisma.matchFeedback.upsert({
            where: { matchId_userId: { matchId, userId } },
            create: {
                matchId,
                userId,
                rating: 0,
                reasonCode: reason,
                action: 'IGNORED',
            },
            update: {
                reasonCode: reason,
                action: 'IGNORED',
            },
        });
        return res.type('html').send(renderConfirmation({
            title: 'Thanks — that helps',
            message: `Got it: "${matchActionToken_1.FEEDBACK_REASON_LABELS[reason]}". I'll factor this in and steer your next introductions away from the same mismatch.`,
            variant: 'success',
            cta: { label: 'Open dashboard', url: `${env_1.env.FRONTEND_URL}/matches` },
        }));
    }
    catch (err) {
        console.error('[matchAction] feedback error:', err?.message || err);
        return res.status(500).type('html').send(renderConfirmation({
            title: 'Something went wrong',
            message: "We couldn't save your feedback. Please try again from your dashboard.",
            variant: 'error',
            cta: { label: 'Open dashboard', url: `${env_1.env.FRONTEND_URL}/matches` },
        }));
    }
});
//# sourceMappingURL=matchAction.js.map