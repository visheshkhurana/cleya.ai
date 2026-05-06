# Cleya.ai — Engagement & User Data Audit

**Generated:** 2026-05-06
**Scope:** Development PostgreSQL database (`heliumdb`)
**Method:** Read-only SQL across 70 tables (users, profiles, matches, introductions, conversations, messages, notifications, security_logs, ai_usage, etc.)

---

## TL;DR — Headline finding

**This database currently holds a seeded test cohort with effectively zero real engagement.** 25 users exist (24 of whom were inserted in two batches on March 17–18, 2026 — almost certainly a one-off seed run). The platform's matching engine produced 40 match proposals from those seeds, but **not a single match has been viewed, accepted, or converted into an introduction**. Notifications, DMs, AI usage tracking, referrals, and recent logins are all at zero.

If you expected this to reflect production traffic, **it doesn't** — `test@cleya.ai/test1234` is a dev-only account, and prod traffic lives in a separate database. This report describes the dev environment.

---

## 1. User base

| Metric | Value |
|---|---|
| Total users | **25** |
| New in last 7 days | 0 |
| New in last 30 days | 1 |
| Email verified | 23 / 25 (92%) |
| Phone verified | 0 / 25 (0%) |
| Onboarding complete | 1 / 25 (4%) |
| WhatsApp opted in | 1 / 25 (4%) |
| MFA enabled | 0 / 25 (0%) |
| `isActive` flag set | 25 / 25 (100%) |

### Signup distribution

| Date | Signups |
|---|---|
| 2026-03-17 | 1 |
| **2026-03-18** | **21** ← bulk seed |
| 2026-03-23 | 1 |
| 2026-03-31 | 1 |
| 2026-04-20 | 1 |

**Read:** 22 of 25 users (88%) were created in a 24-hour window, confirming this is seed data — not organic signup.

### Authentication providers

| Provider | Users |
|---|---|
| Password (bcrypt) | 25 |
| Google OAuth | 0 |
| LinkedIn OAuth | 0 |
| Clerk | 0 |

**Read:** 100% password signups. None of the OAuth flows have been exercised in dev.

### Roles & tiers

- **Roles:** USER 24, ADMIN 1
- **Tiers:** FREE 25 (no PRO upgrades, no referrals used, no own referral codes generated)

### Acquisition attribution

100% of users are `(direct)` / `(none)` / `(none)` for UTM source/medium/campaign. No paid or tracked-channel signups have hit dev.

---

## 2. Profile completeness

| Metric | Value |
|---|---|
| Total profiles | 25 |
| `isComplete = true` | 21 (84%) |
| Avg `completenessScore` | 0.8 / 1.0 |
| Profiles ever match-checked | 21 |

### Persona distribution

| Persona | Users | Complete | Avg score |
|---|---|---|---|
| FOUNDER | 9 | 7 | 0.7 |
| INVESTOR | 4 | 4 | 0.9 |
| TALENT | 3 | 3 | 0.9 |
| DEAL_PARTNER | 3 | 3 | 0.9 |
| VENTURE_PARTNER | 2 | 2 | 0.9 |
| EVENT_PARTICIPANT | 2 | 2 | 0.9 |
| (no profile) | 2 | 0 | — |

**Read:** Founders are the largest cohort (36%) and also the *least* complete on average (0.7 vs 0.9 for everyone else). If founders skew abandonment in production too, the founder onboarding flow is the highest-ROI conversion target.

### Geography (top 7)

| City | Users |
|---|---|
| Bangalore | 10 |
| Mumbai | 6 |
| Delhi NCR | 3 |
| (unset) | 3 |
| Hyderabad | 1 |
| Bengaluru, India | 1 |
| San Francisco, CA | 1 |

**Read:** 76% Bangalore + Mumbai + Delhi — concentrated in India's startup triangle as expected. **Note the data-quality bug:** "Bangalore" and "Bengaluru, India" are stored as separate strings — no normalization. Same city, two buckets. Worth fixing in the profile-edit form (auto-suggest from a city dictionary).

### Industries (top 10, multi-select)

| Industry | Profiles tagging |
|---|---|
| AI / ML | 10 |
| SaaS | 9 |
| Fintech | 9 |
| Consumer | 6 |
| Enterprise | 4 |
| D2C | 3 |
| Healthtech | 2 |
| Logistics | 2 |
| Edtech | 2 |
| Infra | 2 |

---

## 3. Matching engine — the critical funnel

| Stage | Count | Conversion |
|---|---|---|
| **Total proposed** | **40** | 100% |
| Viewed by either side | 0 | **0%** |
| Either user accepted | 0 | 0% |
| Both accepted (mutual) | 0 | 0% |
| Introduction records created | 0 | 0% |

| Match metrics | Value |
|---|---|
| Distinct match statuses | 1 (`PROPOSED` only) |
| Avg match score | 0.34 |
| All `userAResponse` | `PENDING` |
| All `userBResponse` | `PENDING` |
| New matches in 7d | 0 |
| New matches in 30d | 3 |

**Read — this is the single most important finding.** The matching engine is producing matches (40 of them, scoring around 0.34), but **no human has ever interacted with a match in this database**. Every record has `userAViewedAt = NULL` and `userBViewedAt = NULL`, confirming nobody opened the matches page or notification.

This is consistent with the data being a seed dump and the seed users never logging in. It does NOT mean the matching engine is broken — it means we have no real engagement signal in dev.

### Top "matched" users (by # of proposals received)

| Email | Joined | Matches | Responded |
|---|---|---|---|
| vikram.reddy@example.com | 2026-03-18 | 8 | 0 |
| rohan.joshi@example.com | 2026-03-18 | 8 | 0 |
| arjun.mehta@example.com | 2026-03-18 | 8 | 0 |
| kavya.nair@example.com | 2026-03-18 | 8 | 0 |
| deepak.krishnan@example.com | 2026-03-18 | 6 | 0 |
| ritu.malhotra@example.com | 2026-03-18 | 6 | 0 |
| nandini.rao@example.com | 2026-03-18 | 5 | 0 |
| amit.patel@example.com | 2026-03-18 | 5 | 0 |
| ananya.bhat@example.com | 2026-03-18 | 4 | 0 |
| aditya.menon@example.com | 2026-03-18 | 4 | 0 |

(All `@example.com` domain → all seed accounts.)

---

## 4. Conversational AI

| Metric | Value |
|---|---|
| Conversations started | 2 |
| Unique users with conversations | 2 |
| Conversations completed | 0 |
| All conversations status | `ACTIVE` (0 completed) |
| Total messages | 11 (6 from AI, 5 from user) |
| Messages in last 7 days | 0 |

**Read:** Two users started the onboarding/chat flow but neither finished. Tiny sample — but a 0% completion rate is worth flagging if it persists in production.

---

## 5. Communication channels

| Channel | Count |
|---|---|
| Direct messages (in-app) total | 0 |
| DMs in last 7 days | 0 |
| Notifications total | 0 |
| Notifications unread | 0 |
| Notifications by channel | (table empty) |

**Read:** Zero notifications have been sent and zero in-app messages exchanged. Either notifications are only triggered in prod, or the dev triggers haven't fired (no match has been accepted, so no "match accepted" notification could fire).

---

## 6. Introductions

| Metric | Value |
|---|---|
| Total introduction records | 0 |
| New in 7 / 30 days | 0 / 0 |
| Outcomes recorded | 0 |

Empty by design — introductions only get created after both sides accept a match, and zero matches were accepted.

---

## 7. AI usage & cost

| Metric | Value |
|---|---|
| Rows in `ai_usage_daily` (last 30d) | 0 |
| Total tokens (last 30d) | 0 |
| Total requests (last 30d) | 0 |

**Read:** Either the AI usage tracker isn't writing to `ai_usage_daily` in dev, or no AI calls have been made in the last 30 days. Worth verifying — if usage is actually happening (the conversation engine is OpenAI-backed), this is a **telemetry bug** that's silently swallowing your AI cost data.

---

## 8. Events & meetings

| Metric | Value |
|---|---|
| Total events | 3 |
| Upcoming | 1 |
| Past | 2 |

(Small sample, no participant data queried.)

---

## 9. Subscriptions / monetization

| Status | Count |
|---|---|
| CREATED | 1 |

One subscription was created and never activated. Razorpay flow exists but has effectively no usage in dev.

---

## 10. Security & auth health

| Metric | Value |
|---|---|
| Logins in last 7 days (success) | 0 |
| Logins in last 30 days (success) | 0 |
| Most recent successful login event | (none recorded) |
| `TOKEN_INVALID` failures (last 30d) | **364** |
| `ROLE_CHECK_FAILURE` failures (last 30d) | 1 |

**Read — security flag worth investigating.** There are **364 invalid-token attempts** in the last 30 days but **zero successful logins logged**. Two possible explanations:

1. **The `LOGIN_SUCCESS` event isn't being written to `security_logs`** — only failures are. (Likely cause; worth grepping `apps/backend/src/services/securityLog.ts` or wherever events are emitted.)
2. **Stale or misconfigured tokens are flooding the validator** — possibly the Rork mobile app, an old browser session, or a monitoring probe holding an expired JWT and retrying repeatedly.

364 failures over 30 days = ~12/day, ~1 every 2 hours. Not alarming volume, but the silent absence of `LOGIN_SUCCESS` events means **you have no audit trail for who actually logged in**. This is a compliance gap.

---

## 11. WhatsApp & telephony

- **WhatsApp opted-in users:** 1 / 25 (the test/admin user)
- **Phone verified users:** 0 / 25
- **WhatsApp/SMS volume:** not directly counted; no `gupshup_messages` table observed

WhatsApp is your "primary communication channel" per `replit.md`, but in dev there's no signal of it being used end-to-end.

---

## 12. Data-quality issues found

1. **Geographic strings unnormalized** — "Bangalore" vs "Bengaluru, India" treated as different cities.
2. **`activities` table is empty** — likely a tracking gap; many user actions should populate it.
3. **`ai_usage_daily` is empty for last 30d** — either no AI calls or the tracker isn't writing.
4. **`LOGIN_SUCCESS` security events missing** — only failures logged.
5. **2 users have no profile** at all (likely abandoned signups before onboarding).
6. **Average match score is 0.34** — relatively low; the rule+intent+semantic blend may need recalibration once real engagement signals start landing.

---

## 13. Recommendations (ranked by impact)

| # | Action | Why | Effort |
|---|---|---|---|
| 1 | **Audit the production database separately** with the same queries — this dev report doesn't reflect real users. Use the database skill with `environment: "production"` for read-only prod queries. | You asked for an engagement audit; dev has no engagement to audit. | 15 min |
| 2 | **Fix `LOGIN_SUCCESS` logging** in `security_logs` so you have a real audit trail. | Compliance + security + you can't compute DAU/WAU/MAU without it. | 30 min |
| 3 | **Verify `ai_usage_daily` is actually being written** by the LLM router. Empty over 30d is suspicious given conversations exist. | You're flying blind on AI cost. | 30 min |
| 4 | **Investigate the 364 `TOKEN_INVALID` events** — find the source (Rork app? old browser tab? probe?) and either fix it or add throttling. | Noise in security logs hides real attacks. | 1 hour |
| 5 | **Normalize city names** at write-time in profile edit form. | Improves matching accuracy and reporting quality. | 1 hour |
| 6 | **Add view-tracking for matches** — `userAViewedAt` should populate the moment a user opens the matches page. Currently it never fires. | This is the #1 funnel metric you need. Can't optimize what you don't measure. | 1 hour |
| 7 | **Backfill the `activities` table** with the action types you care about (match_viewed, match_responded, profile_updated, conversation_started, etc.) | Becomes the single source of truth for engagement queries. | 2-3 hours |

---

## Appendix — Tables queried

`users`, `profiles`, `matches`, `match_feedbacks`, `introduction_records`, `conversations`, `messages`, `direct_messages`, `notifications`, `events`, `subscriptions`, `waitlist`, `referrals`, `security_logs`, `ai_usage_daily`, `activities`, `oauth_states` — plus discovery query against `information_schema.columns` for 70 tables in the `public` schema.

All queries were read-only. No writes, deletes, or schema changes were performed. Raw query results are available on request.
