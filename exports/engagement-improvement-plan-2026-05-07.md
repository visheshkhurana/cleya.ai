# Cleya.ai — Engagement Audit & Re-Engagement Plan
_Date: 2026-05-07 · Author: Cleya Agent_

---

## 1. Engagement state today (raw numbers)

| Surface | Volume | Notes |
|---|---|---|
| Total users | 25 | 24 are seed/synthetic (`*.example.com`, `*.test`); only `test@cleya.ai` is real |
| Onboarding complete | **1 / 25** (4%) | The test user — everyone else stalled in onboarding |
| Email verified | 23 / 25 | Verification works; signup flow not the bottleneck |
| WhatsApp opted-in | **1 / 25** (4%) | The most engaging channel is reaching almost no one |
| Matches proposed | 40 (all PROPOSED, avg 33 days old) | None viewed, none responded — they were created and forgotten |
| Match views | **0 / 40** | (Now instrumented as of yesterday's fix) |
| Match responses | **0 / 80** sides | Email CTAs never clicked or matches sent before email infra was live |
| Introductions | 0 | Cannot happen until both sides accept |
| Notifications row count | **0** | The `notifications` table has *never been written to* |
| Drip emails queued/sent | **0 / 0** | `drip_emails` table is empty — `DripCampaignService` has never enqueued anything |
| Activities | 0 (pre-fix) | Now starting to fill from yesterday's instrumentation |
| `LOGIN_SUCCESS` last 30d | **0** | Returning logins not happening (also: only just instrumented yesterday) |
| `TOKEN_INVALID` last 30d | 364 | 279 from one IP — single browser stuck in a stale-token loop |

**Headline:** the engagement engine is _wired but cold_. Schedulers run, but no real users are loaded onto the rails — and even the synthetic ones never got nudged because (a) drip campaigns require `onboardingComplete=true` to enroll, and (b) WhatsApp opt-in is essentially zero.

---

## 2. Channel inventory (every nudge that exists today)

### 2.1 Email (`apps/backend/src/services/email.ts`)
| Method | Trigger | One-click? | CTA |
|---|---|---|---|
| `sendWelcome` | Signup (immediate) | No | `/chat` |
| `sendMatchProposed` | New match auto-proposed | **Yes** (signed JWT Accept/Decline) | `/api/match/respond?token=…` |
| `sendMatchIntroJoint` | Both sides accepted | No | `/messages?partner=…` |
| `sendProfileNudge` | T+24h, profile incomplete | No | `/chat` |
| `sendHowMatchingWorks` | T+3d, complete & 0 matches | No | `/matches` |
| `sendMatchCheckIn` | T+7d post-onboarding | No | `/matches` |
| `sendPostIntroFollowUp` | T+3d after intro | No | `/matches` |
| `sendNonResponseFeedback` | T+72h, match still PENDING | **Yes** (signed JWT) | `/api/match/feedback?token=…` |
| `sendFeedbackRequest` | T+5d after match | No | `/matches` |
| `sendReferralOnboarding` | Invite/referral signup | No | `/?action=signup` |

### 2.2 WhatsApp (Gupshup templates + `whatsappBotService`)
| Template | Trigger | In-channel reply handled? |
|---|---|---|
| `welcome` | Signup | Yes — starts onboarding flow |
| `match_found` | New match | **Yes** — Yes/No/1/2 reply updates match |
| `match_accepted` | Partner accepted | No (link to `/messages`) |
| `intro_sent` / `intro_accepted` | Intro lifecycle | No (link out) |
| `profile_incomplete` | T+24h | Yes — resumes onboarding |
| `follow_up` | Inactivity | Yes — surfaces pending matches |
| `weekly_digest` | Mondays 09:00 IST | No (link to dashboard) |
| `meeting_*` | Calendar | No (calendar context) |

### 2.3 Schedulers
- `matchScheduler.runTick` — every 2 min, proposes matches → `sendMatchProposed`
- `runSafetyNetSweep` — daily 04:00 IST, backfills proposals
- `runDripCampaign` — daily 10:00 IST, processes `drip_emails`
- `runWeeklyDigest` — Mon 09:00 IST, email + WhatsApp
- `runFreeTierReset` — daily 00:05 IST
- `agentScheduler` — 10 autonomous agents on individual crons (mostly admin/founder facing)
- `dripSequenceProcessor` — hourly, processes `outreach_campaigns`

### 2.4 In-app notifications
- `notifications` table exists, has `channel`, `event`, `readAt`, `sentAt` columns.
- **Zero rows.** No code path is currently calling `notificationService.create` for normal user events. Only edge paths (anti-spam, AI audit, intro service) reference it — and we have no intros or AI audit volume.

---

## 3. The 7 things actually killing engagement

Ranked by impact / effort.

### 🔴 P0 — Drip campaigns aren't running for anyone
**Symptom:** `drip_emails` is empty despite 25 users and 33-day-old matches.
**Root cause:** `dripCampaignService.enrollUser()` is gated on `onboardingComplete=true`, but only 1 user qualifies. The 24 seed users — and any future real signup who drops off mid-onboarding — never get enrolled in the `ONBOARDING` drip, which is exactly the sequence designed to bring them back.
**Fix:** enroll every signup in the ONBOARDING drip the moment the row is created (or at email-verify), not at onboarding-complete. Step 1 (`profile_nudge`) should already assume the profile is incomplete — that's the whole point.

### 🔴 P0 — WhatsApp opt-in is 4%, but it's the only channel with real reply handling
**Symptom:** 1 / 25 users opted in. Yet WhatsApp is the only channel where a user can finish onboarding, accept a match, or react to an intro without ever opening a browser.
**Root cause:** opt-in is buried — there's no signup-flow ask, no email CTA, no SMS fallback. Indian audience expects WhatsApp as default.
**Fix bundle:**
1. Add a phone-number + WhatsApp opt-in step **inside** the onboarding chat (not as a separate settings page).
2. Inside `sendWelcome`, add a "Continue on WhatsApp" CTA that calls a tokenised `/api/whatsapp/opt-in?token=…` (single click, no login).
3. After 48h with no login and no WhatsApp opt-in, send one SMS via Twilio with the opt-in link.

### 🔴 P0 — In-app notifications are dead code
**Symptom:** 0 rows in `notifications` ever, despite a fully-built schema, websocket plumbing, and a `/notifications` UI.
**Root cause:** the create calls only exist in low-volume paths. The high-volume events — match proposed, match accepted, intro sent, message received, weekly digest — do not write notification rows.
**Fix:** mirror every email/WhatsApp send into `notifications.create` with the right `channel` (`IN_APP` for ones the user should see on next login, `EMAIL`/`WHATSAPP` for an audit log of what we sent). This unlocks (a) a non-empty bell icon when users _do_ log in, (b) a digest of "what you missed" on the dashboard, and (c) the ability to compute "real engagement" instead of guessing.

### 🟠 P1 — Match-Proposed emails have 0% response — diagnose, don't keep sending
**Symptom:** 40 proposed, 0 viewed, 0 responded.
**Root cause hypotheses:** (a) emails never actually delivered (no `email_events` table — Resend webhooks not landing), (b) tokens look phishy and get junked, (c) the receiving inboxes are seed accounts that don't exist.
**Fix:**
1. Stand up the Resend webhook → store delivery / open / click events in a real `email_events` table.
2. Add a tiny tracking pixel + branded link domain so we know what's getting opened vs bounced.
3. Add a hard **kill-switch**: if 3 consecutive `sendMatchProposed` to a user yield no open in 7d, stop sending and route to WhatsApp / SMS instead. We are currently fire-and-forget into the void.

### 🟠 P1 — No re-engagement curve for "logged in once, never came back"
The current funnel assumes either a fully onboarded user or a brand new signup. There is no nudge for the in-between: "you signed up 14 days ago, verified email, did 30% of onboarding, never came back."
**Fix:** add three new drip steps:
- T+2d, partial onboarding → "You're 30% done — finish in 2 questions" (deep-link to last unanswered question).
- T+10d, no login → "Three new founders just like you joined this week — see them" (uses the new vector matching).
- T+30d, dormant → magic-login email (passwordless) so they don't fight the password screen.

### 🟠 P1 — Weekly digest is the strongest comeback driver but ships to nobody
The `runWeeklyDigest` aggregates new matches, intros, meetings — exactly the dopamine loop a returning user wants. But:
- It only runs against opted-in users (so only 1 today).
- The CTA `/dashboard` requires a fresh login.
**Fix:** (a) generate the digest for every active user regardless of WhatsApp opt-in (email by default), (b) include a magic-login link in the email so the user lands inside the dashboard with one click — no password.

### 🟡 P2 — No cross-channel orchestration, no quiet hours, no fatigue cap
Today every channel fires independently. A user can in theory receive an email + WhatsApp + SMS for the same match.
**Fix:** introduce a `notificationOrchestrator` that, per event:
1. Picks the highest-engagement available channel (WhatsApp > Email > SMS > In-app).
2. Caps at N nudges per user per 24h.
3. Honors quiet hours (21:00–08:00 IST).
4. Falls back down the channel ladder only on no-engagement signal.

---

## 4. CRM "bring them back to log in" audit — what's missing

Re-engagement is a funnel: **stimulus → opens → clicks → returns → acts**. Right now we only have the stimulus side, and most of it isn't even firing. Here's the gap analysis on the "comeback" side specifically:

| Mechanism | Exists? | Working today? | Recommendation |
|---|---|---|---|
| Welcome email | ✅ | Yes for signups | Add a one-click **magic-login** button (today's CTA forces password) |
| 24h profile nudge | ✅ | **No** — gated on onboardingComplete | Enroll on signup, deep-link to next unanswered question |
| 7-day check-in | ✅ | **No** — same gate | Same fix; add proof element ("3 founders viewed your match") |
| Match-proposed email | ✅ | Sent, 0 response | Add delivery tracking + WhatsApp fallback after 1d no-open |
| 72h non-response feedback | ✅ | Untested | Make this the **primary** reactivation lever — one tap, no login |
| Weekly digest | ✅ | Not reaching anyone | Send to all users, magic-login link, social proof in subject |
| Cold dormant (30d+) | ❌ | — | New: passwordless email + WhatsApp "your network grew" |
| Behavioral (viewed match, didn't respond) | ❌ | — | New: 24h after view, "Still thinking about [Name]?" |
| Birthday / milestone | ❌ | — | New: low-cost annual/monthly novelty |
| Magic-link login | ❌ | — | New: `/api/auth/magic-link` — token to set HTTP-only cookie, redirect to intent URL |
| Browser push | ❌ | — | New (web-push, low priority for India) |
| Mobile push (Expo) | Plumbing exists in `apps/mobile` | Not wired to events | Wire the same events that drive email/WhatsApp |
| Social proof in nudges | ❌ | — | "5 new founders in Bengaluru this week" — uses new activity log |
| Re-permission ask | ❌ | — | After 60d dormant: "Want fewer emails? One click." (paradoxically lifts engagement) |

---

## 5. Concrete sequenced plan (2 weeks of work)

### Week 1 — make the rails carry traffic
1. **Open the drip gate.** `dripCampaignService.enrollUser` on `user.created`, not `onboardingComplete`. (~30 LOC)
2. **Mirror every send into `notifications`.** New helper `recordNotification({ userId, channel, event, … })` called from `email.send*` and `whatsapp.send*`. (~120 LOC + DB writes)
3. **Wire the Resend webhook** into a new `email_events` table — delivered / opened / clicked / bounced / complained.
4. **Magic-login route.** `POST /api/auth/magic-link` issues a short-TTL JWT, `GET /api/auth/magic` consumes it, sets the cookie, redirects. Embed in welcome, weekly digest, and all comeback emails.

### Week 2 — close the loop
5. **WhatsApp opt-in inside onboarding** + a tokenised one-click opt-in link in the welcome email.
6. **NotificationOrchestrator** with channel ladder, fatigue cap, quiet hours.
7. **New drip steps:** partial-onboarding T+2d, dormant T+10d, dormant T+30d (passwordless), behavioral "viewed but didn't respond" T+24h.
8. **Send weekly digest to everyone** (not just WhatsApp opt-ins) with magic-login.
9. **Kill-switch on dead emails** — 3 consecutive no-opens flips the user to WhatsApp/SMS preferred.

### Measurement (do this Day 1)
Add a single dashboard tile that tracks, for each cohort week:
- `% of users with ≥1 LOGIN_SUCCESS in last 7d`
- `% match emails opened / clicked / responded`
- `time-to-first-match-response`
- `notification → login attribution` (via magic-link click params)

Without these, every "improvement" above is a guess. With them, you'll know within a week which lever moved.

---

## 6. The single most important thing

**Fix the drip-enrollment gate first.** Today's data is not "users won't engage" — it's "the system has never asked them to." A 25-user sample with a 24/25 incomplete-profile rate, zero notifications written, and zero drip emails sent means we have no signal yet. Open the gate, instrument the funnel, and engagement numbers will move on their own before you ship a single new feature.
