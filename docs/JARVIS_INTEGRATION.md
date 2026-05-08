# JARVIS ↔ Cleya integration

Cleya exposes a small HMAC-authed surface so the operator OS
(jarvis-web-pearl.vercel.app) can read business metrics on a schedule
and take admin-style actions on operator approval.

Two endpoints:

```
GET  /api/jarvis/metrics
POST /api/jarvis/actions/:id
```

Source: `apps/backend/src/routes/jarvis.ts`
Auth:   `apps/backend/src/middleware/jarvisAuth.ts`

## Auth

Every request must carry two headers:

```
x-jarvis-timestamp: <unix-ms>
x-jarvis-signature: <hex sha256-hmac>
```

The signature is computed over:

```
${timestamp}.${method}.${path}.${rawBody}
```

with `JARVIS_SHARED_SECRET` (env var on Cleya backend, mirrored as
`api_key` on JARVIS's `app_connections` row). Replay window is
5 minutes. Invalid timestamp / signature → 401.

## Metrics returned

Pulled by JARVIS's `Multi-app metrics fetch` cron task (hourly, see
`migrations/20260507_multi_app_control.sql` on the JARVIS side).
Inserted into `business_metrics` and surfaced on `/view/finance` and
`/view/growth` of the operator OS.

| name                          | unit  | source                                           |
|-------------------------------|-------|--------------------------------------------------|
| `mrr_inr`                     | INR   | `Subscription` × tier price (env `PRO_MONTHLY_INR`, `ENTERPRISE_MONTHLY_INR`) |
| `arr_inr`                     | INR   | `mrr_inr × 12`                                   |
| `paid_users`                  | count | active subscriptions                             |
| `pro_subs`                    | count | active subs with user.tier = PRO                 |
| `enterprise_subs`             | count | active subs with user.tier = ENTERPRISE          |
| `users_total`                 | count | all users                                        |
| `users_active`                | count | users.isActive = true                            |
| `users_active_30d`            | count | distinct activity.userId in last 30d             |
| `signups_24h`                 | count | users created in last 24h                        |
| `signups_7d`                  | count |                                                  |
| `signups_30d`                 | count |                                                  |
| `conversion_rate_pct`         | pct   | paid_users / users_total                         |
| `matches_proposed_30d`        | count | matches with createdAt in last 30d               |
| `matches_accepted_30d`        | count | status = ACCEPTED in last 30d                    |
| `match_acceptance_rate_pct`   | pct   | accepted / (accepted + rejected) decided in 30d  |
| `intros_total`                | count | all-time IntroductionRecord rows                 |
| `intros_30d`                  | count | sentAt in last 30d                               |
| `feedback_positive_30d`       | count | matchFeedback.rating ≥ 4 in last 30d             |
| `feedback_total_30d`          | count |                                                  |

## Action catalog

Each action is invoked by `POST /api/jarvis/actions/<id>` with body
`{ params: {...} }`. The operator approves the call inside JARVIS's
HITL queue (`/view/approvals`) before JARVIS dispatches.

| action               | params                                   | effect                                                       |
|----------------------|------------------------------------------|--------------------------------------------------------------|
| `flag_user`          | `{ userId }`                             | sets `user.isActive = false` (suspend)                       |
| `unflag_user`        | `{ userId }`                             | re-activates the user                                        |
| `set_tier`           | `{ userId, tier }` `tier` ∈ FREE\|PRO\|ENTERPRISE | force a tier change                                          |
| `pause_matching`     | `{}`                                     | sets `MatchThrottleConfig.dailyProposalCap = 0`              |
| `resume_matching`    | `{ dailyProposalCap?: number = 50 }`     | restores the cap                                             |
| `send_announcement`  | `{ title, body, audience? }` `audience` ∈ all\|paid | inserts an `IN_APP` `SECRETARY_DIGEST` notification per user |

## Deploy

1. Generate a strong shared secret (32+ bytes hex):
   ```bash
   openssl rand -hex 32
   ```
2. Set `JARVIS_SHARED_SECRET` in the Cleya backend env (Replit / Vercel / wherever).
3. On the JARVIS side, update the `app_connections` row for `cleya`:
   ```sql
   update app_connections
      set api_endpoint = 'https://api.cleya.ai/api/jarvis',
          api_key      = '<the same secret>',
          status       = 'connected'
    where slug = 'cleya';
   ```
4. Enable the JARVIS scheduled task:
   ```sql
   update scheduled_tasks set enabled = true
    where name = 'Multi-app metrics fetch';
   ```
5. Watch `business_metrics` populate after the next top-of-hour tick.
   The /view/finance and /view/growth screens stop showing
   "metrics not wired" and start charting real numbers.

## Adding a new metric

Just append to the array returned in `jarvisRouter.get('/metrics')`.
JARVIS's runner inserts whatever `name`s show up — no schema change
needed on either side.

## Adding a new action

1. Add the `case` in `jarvisRouter.post('/actions/:id')`.
2. Document it here.
3. On the JARVIS side, surface it in the operator's command palette
   or as a dropdown on the relevant agent's profile.
