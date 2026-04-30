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
export declare const matchActionRouter: import("express-serve-static-core").Router;
//# sourceMappingURL=matchAction.d.ts.map