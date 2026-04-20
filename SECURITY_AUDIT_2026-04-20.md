# Cleya Codebase Security & Quality Scan - Top 10 Findings

## 1. Missing Webhook Signature Verification (Resend)
**File:** `/sessions/exciting-wizardly-cerf/cleya/apps/backend/src/routes/resendWebhook.ts` (lines 6-8)  
**Severity:** CRITICAL  
**What's wrong:** The POST `/api/webhooks/resend` endpoint accepts all webhook requests without verifying the Resend signature. Any attacker can inject fake webhook events (email opened, clicked, bounced) to manipulate campaign metrics or trigger unsubscribes.  
**Suggested fix:**
```typescript
const signature = req.headers['x-resend-signature'] as string;
if (!resendService.verifyWebhookSignature(req.body, signature)) {
  return res.status(403).json({ error: 'Invalid signature' });
}
```
**Effort:** 30min

## 2. Optional Webhook Signature Validation (Gupshup)
**File:** `/sessions/exciting-wizardly-cerf/cleya/apps/backend/src/routes/gupshup.ts` (lines 13-21)  
**Severity:** HIGH  
**What's wrong:** The POST `/api/gupshup/webhook` only validates the signature if `GUPSHUP_WEBHOOK_SECRET` is configured. If missing, all requests are accepted. This allows spoofed WhatsApp message events in production if the secret is ever misconfigured or forgotten.  
**Suggested fix:**
```typescript
if (!webhookSecret) {
  console.warn('[Gupshup] Webhook secret not configured');
  res.sendStatus(503);
  return;
}
const incomingKey = (req.query.secret as string) || req.headers['x-gupshup-webhook-secret'] as string;
if (incomingKey !== webhookSecret) {
  res.sendStatus(403);
  return;
}
```
**Effort:** 5min

## 3. Conditional Meta WhatsApp Signature Verification
**File:** `/sessions/exciting-wizardly-cerf/cleya/apps/backend/src/routes/gupshup.ts` (lines 177-184)  
**Severity:** HIGH  
**What's wrong:** POST `/api/gupshup/meta-webhook` signature verification is skipped if `env.META_WHATSAPP_APP_SECRET` is undefined. If the secret is misconfigured or missing in a production environment, all webhook payloads are processed without validation.  
**Suggested fix:**
```typescript
if (!env.META_WHATSAPP_APP_SECRET) {
  console.warn('[Meta Webhook] App secret not configured');
  res.sendStatus(503);
  return;
}
const signature = req.headers['x-hub-signature-256'] as string;
if (!signature || !metaWhatsAppService.verifyWebhookSignature(req.rawBody || Buffer.from(JSON.stringify(req.body)), signature)) {
  res.sendStatus(403);
  return;
}
```
**Effort:** 5min

## 4. Unauthenticated Admin Test Endpoint
**File:** `/sessions/exciting-wizardly-cerf/cleya/apps/backend/src/routes/gupshup.ts` (lines 124-157)  
**Severity:** HIGH  
**What's wrong:** The POST `/api/gupshup/test-send` endpoint lacks any authentication check. Any unauthenticated user can send WhatsApp messages via this endpoint, potentially causing spam or abuse.  
**Suggested fix:**
```typescript
gupshupRouter.post('/test-send', authenticate, requireRole('MANAGER'), async (req: Request, res: Response) => {
  // ... rest of endpoint
});
```
**Effort:** 5min

## 5. Hardcoded Default Email Address
**File:** `/sessions/exciting-wizardly-cerf/cleya/apps/backend/src/config/env.ts` (line 58)  
**Severity:** MEDIUM  
**What's wrong:** The environment schema has a hardcoded default `REPLY_TO_EMAIL: z.string().default('jivraj@cleya.ai')`. This founder email will be used in production if the env var is missing, potentially sending transactional emails from a personal email address.  
**Suggested fix:**
```typescript
REPLY_TO_EMAIL: z.string().min(1).email('Invalid email'),
// Or if optional: z.string().email().optional(),
```
**Effort:** 5min

## 6. Unsafe Integer Parsing Without Validation
**File:** `/sessions/exciting-wizardly-cerf/cleya/apps/backend/src/routes/match.ts` (line 326)  
**Severity:** MEDIUM  
**What's wrong:** `parseInt(req.body.batchSize)` can return `NaN` if batchSize is a non-numeric string. The fallback `|| 10` only handles `NaN` after the fact, and the parseInt happens on unvalidated user input.  
**Suggested fix:**
```typescript
const batchSize = z.number().int().min(1).max(50).default(10).parse(req.body.batchSize);
```
**Effort:** 30min

## 7. Direct req.body Property Access Without Zod Validation
**File:** `/sessions/exciting-wizardly-cerf/cleya/apps/backend/src/routes/user.ts` (lines 32-33, 47-48)  
**Severity:** MEDIUM  
**What's wrong:** Routes access `req.body.persona` and `req.body.companyName` directly even when a validation middleware is applied. If the middleware is removed or the schema is changed, these fields won't be validated, potentially allowing malicious input.  
**Suggested fix:**
```typescript
// In the route, after validate() middleware has parsed req.body:
const { persona, companyName } = req.body as z.infer<typeof profileUpdateSchema>;
// Or apply discriminated union validation to ensure strict type safety
```
**Effort:** 30min

## 8. Async Initialization Without Startup Blocking
**File:** `/sessions/exciting-wizardly-cerf/cleya/apps/backend/src/index.ts` (lines 170-175)  
**Severity:** MEDIUM  
**What's wrong:** Server starts listening before intro template seeding and agent scheduler initialization complete. If these fail silently (caught in `.catch()`), the server runs in a degraded state without alerting operators.  
**Suggested fix:**
```typescript
const initPromises = [
  introTemplateSeed().catch(err => { throw new Error(`Intro seed failed: ${err.message}`); }),
  agentScheduler.start().catch(err => { throw new Error(`Scheduler failed: ${err.message}`); }),
];
await Promise.all(initPromises);
server.listen(PORT, () => console.log('Server running'));
```
**Effort:** 30min

## 9. Missing Input Validation on Admin Endpoints
**File:** `/sessions/exciting-wizardly-cerf/cleya/apps/backend/src/routes/admin.ts` (lines 232-270)  
**Severity:** MEDIUM  
**What's wrong:** Admin endpoints accept `req.body.phoneNumber`, `req.body.channel`, `req.body.message` with only runtime null checks. No Zod schema validates these fields, allowing malformed input to reach downstream services.  
**Suggested fix:**
```typescript
const triggerCallSchema = z.object({
  phoneNumber: z.string().regex(/^\+?[1-9]\d{1,14}$/),
  recipientId: z.number().int().positive(),
});
const { phoneNumber, recipientId } = triggerCallSchema.parse(req.body);
```
**Effort:** 30min

## 10. Unsafe SQL Construction in Webhook Handler
**File:** `/sessions/exciting-wizardly-cerf/cleya/apps/backend/src/routes/resendWebhook.ts` (lines 17-20, 31-47)  
**Severity:** MEDIUM  
**What's wrong:** Uses `prisma.$queryRawUnsafe()` and `prisma.$executeRawUnsafe()` without parameterized queries. While the `emailId` parameter is passed as a value (not directly interpolated), the API is deprecated in favor of safer parameterized queries. If the code is later refactored to use string interpolation, SQL injection becomes possible.  
**Suggested fix:**
```typescript
// Use prisma.outreachRecipient.findUnique() or findFirst() instead:
const recipient = await prisma.outreachRecipient.findFirst({
  where: { resend_email_id: emailId },
  select: { id: true, campaign_id: true, status: true },
});
// Replace all $executeRawUnsafe with prisma.outreachRecipient.update() calls
```
**Effort:** 2h

---

## Summary

- **CRITICAL (1):** Missing Resend webhook signature verification
- **HIGH (3):** Optional/conditional webhook validation (Gupshup, Meta), unauthenticated test endpoint
- **MEDIUM (6):** Hardcoded email, unsafe parseInt, direct req.body access, async initialization, missing input validation, unsafe SQL API

All findings focus on security hardening and input validation—low-risk changes a founder can ship immediately without deep product review.
