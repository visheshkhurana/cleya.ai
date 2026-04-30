/**
 * One-click match-response tokens.
 *
 * Goal: a user can hit Accept or Decline directly from their inbox without
 * having to log in to the web app. The token is signed with HMAC-SHA256
 * using JWT_SECRET (already required, min 32 chars), is bound to a single
 * (matchId, userId, action) tuple, and expires after 14 days.
 *
 * Format: base64url(payload).base64url(signature)
 *   payload = `${matchId}.${userId}.${action}.${expiresAt}`
 *
 * We deliberately do NOT use a JWT library here — the token is short, the
 * payload is tiny, and a hand-rolled HMAC keeps the surface area minimal.
 */
export type MatchAction = 'accept' | 'decline';
/**
 * Reasons we offer when nudging a non-responder for feedback. Kept short
 * so we can render them as 4 quick-tap buttons in the email body.
 */
export declare const FEEDBACK_REASONS: readonly ["not_relevant", "too_busy", "wrong_stage", "wrong_sector"];
export type FeedbackReason = typeof FEEDBACK_REASONS[number];
export declare const FEEDBACK_REASON_LABELS: Record<FeedbackReason, string>;
export declare function createMatchActionToken(opts: {
    matchId: string;
    userId: string;
    action: MatchAction;
    ttlMs?: number;
}): string;
export declare function verifyMatchActionToken(token: string): {
    ok: true;
    matchId: string;
    userId: string;
    action: MatchAction;
} | {
    ok: false;
    reason: 'malformed' | 'bad_signature' | 'expired' | 'bad_action';
};
/**
 * Feedback tokens — separate from accept/decline because the payload
 * carries an extra `reason` field. We wrap the same HMAC primitive but
 * keep the format distinct so a stolen accept-token can never be reused
 * as a feedback-token (or vice versa).
 *
 * Format: f.base64url(payload).base64url(signature)
 *   payload = `${matchId}.${userId}.${reason}.${expiresAt}`
 */
export declare function createFeedbackToken(opts: {
    matchId: string;
    userId: string;
    reason: FeedbackReason;
    ttlMs?: number;
}): string;
export declare function verifyFeedbackToken(token: string): {
    ok: true;
    matchId: string;
    userId: string;
    reason: FeedbackReason;
} | {
    ok: false;
    reason: 'malformed' | 'bad_signature' | 'expired' | 'bad_reason';
};
export declare function createInboundReplyLocalPart(matchId: string, userId: string): string;
export declare function verifyInboundReplyLocalPart(localPart: string): {
    ok: true;
    matchId: string;
    userId: string;
} | {
    ok: false;
    reason: 'malformed' | 'bad_signature' | 'expired';
};
//# sourceMappingURL=matchActionToken.d.ts.map