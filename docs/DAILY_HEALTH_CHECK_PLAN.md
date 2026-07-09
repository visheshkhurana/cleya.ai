# Cleya.ai — Daily Morning Health Check Plan

Runs each morning against production (`https://cleya.ai`) to catch outages before customers do. Prioritised by blast radius: anything that stops **new signups** is P0 and pages immediately; anything that stops **existing users** is P1; slower degradations are P2.

## Priority ladder

| Prio | Failure mode | Why it's here |
|------|--------------|---------------|
| **P0** | Signup blocked (new visitors can't create an account) | No new users = no growth. Silent revenue kill. |
| **P0** | Login blocked (existing users locked out) | Active users churn within hours. |
| **P0** | Frontend `/` returns 5xx or times out | Nothing else matters if the door is shut. |
| **P0** | DB unhealthy | Everything cascades from the database. |
| **P1** | CSRF/rate-limit/recaptcha misconfig blocks flows | Users see errors they can't diagnose. |
| **P1** | OAuth callbacks (Google/LinkedIn) broken | Suppresses ~half of signups on some funnels. |
| **P1** | `/api/auth/me` inconsistent with cookie | Session bugs → white screens after login. |
| **P2** | Redis degraded | Rate-limits fall back to in-memory; still works. |
| **P2** | Heap > 90%, RSS > 500MB | Restart soon; not user-visible yet. |
| **P2** | Email/SMS providers not configured | Verification & notifications delayed, not blocked. |

## Test matrix (daily)

Each test runs against production. A dedicated canary domain (`@cleya-canary.test`) is used so canary users are trivially findable in the DB and never conflict with real users.

### P0 — Signup & login end-to-end

1. **CSRF token issuance.** `GET /api/csrf-token` → 200, returns `csrfToken`, sets `cleo_csrf` cookie.
2. **Fresh signup.** `POST /api/auth/signup` with a random `canary-<n>@cleya-canary.test` email → **201** with `user.id`, `token`, `emailVerified: true` (SMTP not required in prod path when disabled).
3. **Login round-trip.** `POST /api/auth/login` with the just-created credentials → **200** with `token`; `Set-Cookie: cleo_auth` present.
4. **Session verified.** `GET /api/auth/me` with cookie → **200**, echoes the same `user.id`.
5. **Bad password rejected.** `POST /api/auth/login` with wrong password → **401** `INVALID_CREDENTIALS` (not 500).
6. **Duplicate signup rejected.** Re-POST the same email → **409** `SIGNUP_FAILED`.

### P0 — Availability

7. **Frontend homepage.** `GET https://cleya.ai/` → 200, `content-length > 5000`.
8. **DB health.** `GET /api/health/db` → 200, `status: "healthy"`, latency < 500ms.
9. **Overall health.** `GET /api/health` — record status. Anything **`unhealthy`** pages; `degraded` is P2 unless it lasts >24h.

### P1 — Auth surface

10. **Register page.** `GET /register` → 307 → `/?action=signup`.
11. **Login page.** `GET /login` → 200.
12. **OAuth status endpoints.** `GET /api/auth/google/status` and `/api/auth/linkedin/status` → 200 (regardless of whether the button is enabled — endpoint must respond).
13. **Signup validation.** Post a password missing an uppercase char → **400** `VALIDATION_ERROR` with `password` in the field list.
14. **Signup rate limit sanity.** 6 back-to-back signups from the same IP; the last should 429. (Skipped if a prod IP allowlist is in effect.)

### P2 — Ops signals (record, don't page unless persistent)

15. `checks.redis.status` from `/api/health` — expect `healthy`, flag if `degraded` >24h.
16. `checks.memory` — flag if `heapPercent > 90` for two consecutive runs.
17. `checks.ai.status` — flag if `degraded` (OPENAI key missing).
18. **Static asset**: `GET /favicon.ico` → 200 (proves CDN is serving assets).

## Notification rules

- **Page immediately** if any P0 fails, or two P1s fail in the same run.
- **Silent** if everything passes. (No "all clear" spam.)
- **Digest at week's end** if any P2 has been degraded >3 days.

The page must contain: which test failed, the HTTP status/error code, the request URL, and the git-`HEAD` at run time.

## Canary data hygiene

- Canary emails use the `@cleya-canary.test` suffix — a domain that will never accept mail and is trivially filterable.
- A weekly cleanup deletes users older than 7 days matching that suffix (add to `scripts/` if it becomes noisy).
- Never test on `test@cleya.ai` in production; that account is dev-only.

## Runbook

- Script: `scripts/daily-health-check.sh` (exit code non-zero on any P0/P1 failure).
- Invoke: `bash scripts/daily-health-check.sh` — prints JSON summary; suitable for cron.
- On failure: check the referenced status codes against the priority table, then look at the latest deploy in Vercel/Replit for anything shipped in the last 24h.
