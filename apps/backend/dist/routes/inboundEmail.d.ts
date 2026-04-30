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
export declare const inboundEmailRouter: import("express-serve-static-core").Router;
//# sourceMappingURL=inboundEmail.d.ts.map