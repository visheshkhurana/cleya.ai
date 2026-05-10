# Meta App Review — submission copy

Ready-to-paste content for `submission_id 943709495147144`. Where you
see `[YOUR …]` placeholders, fill in from your records. Everything else
is pre-written from publicly visible cleya.ai facts and the
`apps/frontend/src/app/layout.tsx` schema metadata.

---

## App settings

| Field | Value |
|---|---|
| App name | `Cleya.ai` |
| App category | `Business / Productivity` |
| Contact email | `hello@cleya.ai` |
| Privacy Policy URL | `https://cleya.ai/privacy` ✅ live |
| Terms of Service URL | `https://cleya.ai/terms` ✅ live |
| Data Deletion Instructions URL | `https://cleya.ai/privacy#data-deletion` ✅ live (commit `8f43c6c`, deploys with next Vercel build) |
| App Domains | `cleya.ai` |
| App Icon | 1024×1024 PNG — convert `apps/frontend/public/icon.svg` via any vector→raster tool, or commission. **Required.** |
| Business Verification | Should already be linked (Tech Provider gate is downstream of this). |
| App tagline (≤80 chars) | `AI Networker for India's startup ecosystem.` |
| App description (long) | See "Long app description" below. |

### Long app description (paste into App Description field)

```
Cleya.ai is an AI-powered networking and matchmaking platform for India's startup ecosystem. Founders, investors, and operators publish what they need (capital, design partners, distribution, hires) and what they offer; Cleya's matching engine surfaces mutual-fit pairs, and both sides opt in by name before any introduction is revealed. The product replaces cold LinkedIn DMs with a curated, double-opt-in introduction flow.

The Marketing API integration powers Cleya's autonomous paid-acquisition agent. Cleya's operator OS (jarvis-web) lets the founding team review AI-generated ad campaign briefs — audience, copy variants, generated creatives, budget plan, success metrics — and accept them with one click. On accept, the platform programmatically creates the campaign, ad set, and ads on the linked Meta ad account as PAUSED, then surfaces a deep link into Ads Manager where the operator manually flips to ACTIVE. No autonomous activation occurs without explicit human approval.

All ad-account credentials (System User access tokens, Page IDs, Pixel IDs) are stored encrypted at rest in Supabase Postgres, scoped per-tenant by ad account, and rotated by the operator. Cleya does not redistribute these credentials, sell them to third parties, or use them outside the campaign-creation flow.
```

### Data Deletion options (pick one — Meta accepts either)

**Option A — Instructions URL (simpler):** ✅ **DONE** in commit `8f43c6c` — section 10 of the privacy page is now `id="data-deletion"`. Submit:
```
https://cleya.ai/privacy#data-deletion
```

For reference, the deployed section will read:

```
## Data Deletion

To delete your Cleya.ai account and all associated data:

1. Email hello@cleya.ai with subject "Delete my account" from the email
   address linked to your Cleya account, OR
2. Sign in → Settings → Account → Delete account.

Within 30 days we will remove your profile, matches, messages, and any
data we hold from connected platforms (Meta, Google, etc.). Operational
backups are purged on the next scheduled rotation (≤90 days).
```

Then submit the URL `https://cleya.ai/privacy#data-deletion`.

**Option B — Programmatic callback (Meta's deauthorize callback):** If you want Meta to ping us automatically when a user removes the Cleya app from their Facebook account, expose a POST endpoint at `https://cleya.ai/api/meta/deauthorize` that receives a signed `signed_request` body, verifies the signature, and queues that user's deletion. Adds engineering work; only required if you want auto-deletion on Facebook-side disconnect. Recommend Option A for now.

---

## Allowed usage — per-permission justifications

For each permission, Meta wants three things: **what your app does, why this permission is required, how the user interacts.** Below is paste-ready copy per permission. Ones marked **(needs screencast)** require a 30–90 sec screen recording attached.

### `ads_management` (advanced) — **(needs screencast)**

```
Cleya.ai uses ads_management to create paid Meta campaigns on behalf of authenticated business users. The flow:

1. The Cleya operator (a small set of business users from the founding team) reviews an AI-generated campaign brief inside the Cleya Operator OS — audience targeting, copy variants, generated creatives, budget split, success metrics.

2. On clicking "Accept" the operator authorizes Cleya to create the campaign on the linked Meta ad account. Cleya makes POST calls to the /act_<id>/campaigns, /act_<id>/adsets, /act_<id>/adimages, /act_<id>/adcreatives, and /act_<id>/ads endpoints, persisting the resulting object IDs in our database.

3. Every campaign is created with status: 'PAUSED'. Cleya never sets a campaign to ACTIVE programmatically — the operator manually flips status in Meta Ads Manager as a final review gate.

4. On rejection, the campaign is marked rejected in our DB and never created on Meta. Audit logs are kept indefinitely for compliance.

Without ads_management, Cleya's operator would have to manually re-enter every campaign in Ads Manager — defeating the product's value (programmatic creation from a reviewed AI brief).

The Standard Access tier is required because Cleya users may run ads on real production ad accounts (not test accounts).
```

**Screencast script (1–2 min, record in Cleya's actual operator UI):**

1. Sign into jarvis-web (the operator OS).
2. Open the **Ads** tab → click **Generate** → fill the brief form (platform=Meta, objective=signup, budget=$2000) → click Generate.
3. Wait for the proposal card to appear with copy variants + 2 generated images.
4. Click **Accept** on the card.
5. Wait for the green confirmation showing `platform_campaign_id` and the Ads Manager URL.
6. Click the Ads Manager URL → narrate: "campaign is created PAUSED — I review here and manually flip to ACTIVE."

### `ads_read`

```
Cleya.ai reads campaign performance (spend, impressions, clicks, conversions, CTR, frequency) from connected ad accounts daily, then dispatches a campaign-optimizer agent that proposes scale/pause/kill/refresh actions back to the operator for review. Without ads_read, the optimizer cannot evaluate which campaigns are working and where spend is being wasted.
```

### `business_management`

```
Cleya.ai uses business_management to (a) verify the user's authorization to manage the chosen ad account before issuing any write call, and (b) discover ad account / Page / Instagram Business Account IDs during one-time setup so the operator doesn't have to copy IDs by hand from Business Manager.
```

### `pages_manage_ads`

```
Required because Meta ads must be linked to a Page actor (Page-as-advertiser). Cleya creates ad creatives whose object_story_spec.page_id references the operator's Cleya.ai Facebook Page. Without pages_manage_ads, the /adcreatives call fails because the API cannot confirm the ad account has rights to advertise as that Page.
```

### `pages_read_engagement`

```
Cleya reads basic Page metadata (Page name, follower count) for two reasons: (1) to display the operator's connected Page in the Ad Account Settings card so they can confirm the right Page is linked before publishing, and (2) to cap ad creatives at the Page's max-supported aspect ratios.
```

### `pages_show_list`

```
During one-time onboarding the operator picks which Page to use as the ad actor. pages_show_list lets Cleya display the list of Pages the user manages so they can pick one. Without it, the operator would have to paste a numeric Page ID from Business Manager.
```

### `public_profile`

```
Cleya reads the operator's name and Facebook ID at sign-in to attach a Meta identity to their internal Cleya operator account, used for audit logging ("operator X accepted campaign Y at time Z").
```

### `manage_app_solution`

```
Required by Meta for Tech Provider apps that programmatically install Marketing API solutions on behalf of business users.
```

### `catalog_management`

```
Reserved for the next product milestone — Cleya is rolling out e-commerce campaign templates that target product catalogs (Advantage+ Shopping format). Catalog_management is required to read the operator's connected product catalog, fetch product feed metadata, and pass the catalog ID into adcreatives.product_set_id when generating shopping ad templates. If catalog_management is approved later (separate review), this submission can be amended.
```

*If catalog_management isn't actually needed yet, drop it from the submission to reduce review surface.*

### WhatsApp / Threads permissions

```
whatsapp_business_messaging: Cleya offers an opt-in channel for matched founders to continue conversations on WhatsApp Business after a double-opt-in introduction. The user explicitly enables WhatsApp under Profile → Communication preferences. We send only transactional messages (intro confirmations, scheduling) — no marketing.

whatsapp_business_management: Required to programmatically create message templates for the transactional flows above. Templates are submitted via the API to Meta's review queue.

whatsapp_business_manage_events: Used to subscribe to delivery / read / failed webhooks so we can show "delivered" indicators in the operator's CRM view.

threads_basic + threads_business_basic: Cleya is piloting a content-distribution feature where operators can cross-post networking insights from their Cleya profile to their Threads account. This is operator-initiated only.
```

*Same caveat — drop these from this submission if they're not in the imminent roadmap. Each unused permission expands the review surface.*

### `Marketing API Access Tier` (Standard)

```
Cleya is requesting Standard Access on Marketing API to support production ad accounts beyond the test-tier limits. Cleya's primary user base is Indian seed-stage founders running real campaigns on real ad accounts — the Test tier (sandbox accounts only, 5K calls/day) cannot serve this audience. Volume estimate: ≤200 campaigns / month across all customers in the first 90 days; ≤5,000 campaigns / month at end-of-year scale.
```

---

## Data Handling

These answers assume the existing Cleya stack (Supabase Postgres, Clerk auth, Vercel hosting, Resend transactional email, Google Analytics 4, Meta Pixel). Adjust if anything is wrong.

### How does your app store, transmit, encrypt and protect platform data?

```
Storage: Meta-issued data (System User access tokens, Page IDs, Pixel IDs, ad account IDs, campaign metadata) is stored in Supabase Postgres on AWS RDS-equivalent infrastructure. Postgres data files at rest are encrypted with AES-256. Access tokens are scoped per-row to the ad account that issued them — there is no cross-tenant access.

Transmission: All API calls to Meta endpoints (graph.facebook.com, business.facebook.com) are over TLS 1.2+. Internal service-to-service calls (Cleya operator OS ↔ core API) use HTTPS with HMAC-signed request bodies for replay protection.

Access controls: Production database access is gated by Supabase RLS policies — only the service-role key (held by the core API) can read access_token columns; client-side reads return masked values. The service-role key is held only in Vercel encrypted env vars and never embedded in client bundles.

Audit: Every campaign creation and every read of an access token is logged to an append-only events table (operator_id, action, ad_account_id, timestamp, request_id). Logs are retained for 13 months.
```

### How long does your app retain platform data, and what is your deletion policy?

```
Retention by data type:
- Access tokens: kept while the operator's connection is active. On disconnect (operator-initiated, Meta deauthorize callback, or 60 days of inactivity), tokens are deleted from primary storage within 24 hours. Encrypted backups are purged on the next 90-day rotation.
- Campaign metadata (campaign_id, ad_set_id, ad_id, object_story_spec snapshots): retained for 13 months for performance analytics, then purged.
- Aggregated performance metrics (CTR, CPA, spend by day): retained indefinitely in anonymized form (no per-user identifiers) for benchmarking other operators.
- Audit logs: 13 months.

Deletion: Operator-initiated account deletion (https://cleya.ai/privacy#data-deletion) triggers immediate soft-delete (token revoked, account inaccessible) and hard-delete within 30 days. Meta-initiated deauthorize callback (if implemented) revokes tokens immediately and queues hard-delete with the same 30-day window.
```

### Does your app share platform data with third parties?

```
No platform data (Meta-issued or otherwise) is sold or shared for marketing.

Subprocessors used for operating the service, all under DPA:
- Supabase (Postgres + Storage; AWS Mumbai region)
- Vercel (application hosting; multi-region)
- Clerk (authentication; SOC 2)
- Resend (transactional email)
- Anthropic, Google AI Studio, OpenAI (LLM API providers — see below for what's sent)
- Meta itself (Conversions API, Marketing API)
- Google (Analytics 4, Search Console — only Cleya-owned site data)

LLM scope: only campaign briefs (audience description, copy variants, performance summary aggregates) are sent to LLM providers — never raw access tokens, user PII, or ad account IDs that the LLM cannot use.

We do not share platform data with advertisers, data brokers, or analytics providers other than the ones above.
```

### Does your app log Meta API requests / responses?

```
Yes — request URL, response status code, and the resource ID returned (e.g. campaign_id) are logged for debugging and abuse detection. Full response bodies are NOT logged. Access tokens in request headers are redacted at the logging layer before persistence.
```

### Does your app meet the Limited Login / Standard requirements?

```
Cleya implements the standard OAuth flow with state parameter for CSRF protection, redirect URI allowlist (developers.google.com/oauthplayground for one-time refresh-token grab; production redirect URI is https://cleya.ai/auth/meta/callback), and PKCE on the public web client.

Sessions are managed by Clerk (SOC 2 certified). Session tokens are httpOnly + Secure + SameSite=Lax cookies. No long-lived bearer tokens are exposed to the browser.
```

---

## Final pre-submit checklist

- [ ] App icon uploaded (1024×1024 PNG) — convert from `apps/frontend/public/icon.svg`
- [x] Privacy Policy URL live at `cleya.ai/privacy` ✅
- [x] Terms URL live at `cleya.ai/terms` ✅
- [x] Data Deletion section live at `cleya.ai/privacy#data-deletion` ✅ (commit `8f43c6c`)
- [ ] Per-permission justifications pasted (use copy above)
- [ ] Screencast for `ads_management` recorded + uploaded (script above)
- [ ] Data Handling answers pasted
- [ ] Review the WhatsApp/Threads/catalog_management permissions — drop any not in the next 90 days roadmap to reduce review surface
- [ ] Submit

**SLA:** 1–5 business days normally, 3–7 with the Tech Provider gate. They may come back with clarification questions; respond within 7 days or the submission auto-cancels.
