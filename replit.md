# Cleya.ai Platform

Imported from: https://github.com/visheshkhurana/cleya-ai-platform

## Operational Gotchas (READ FIRST — recurring issues across sessions)

These are non-obvious things future-me will otherwise rediscover the hard way:

- **`apps/backend/src/index.ts` gets deleted on some workflow restarts.** Restore with:
  `git show d5dd882:apps/backend/src/index.ts > apps/backend/src/index.ts`
- **`origin` git remote flips and loses the auth token.** Re-set with:
  `git remote set-url origin "https://x-access-token:$(printenv GITHUB_PAT)@github.com/visheshkhurana/cleya.ai.git"`
- **Git identity** for commits: `user.email "agent@cleya.ai"`, `user.name "Cleya Agent"`.
- **DO NOT change individual user names** — must be preserved exactly as entered from LinkedIn or signup. Match-reason copy uses an explicit name allowlist sanitizer.
- **Prod DB schema drift**: Replit deploy runs `prisma db push --accept-data-loss` — schema changes can wipe data, be careful.
- **Email architecture**:
  - `hello@cleya.ai` is the FROM address only — it is NOT a provisioned inbox. Never use as Reply-To (replies bounce).
  - All Reply-To headers use `env.REPLY_TO_EMAIL` (defaults to `jivraj@cleya.ai`).
  - Joint-intro emails (after both parties accept): both addresses on `To:`, both in `reply_to` array, single shared Gmail thread. See `emailService.sendMatchIntroJoint()` in `apps/backend/src/services/email.ts`.
  - Side-effects in `respondToMatch` are gated by `justAccepted = updated.status === 'ACCEPTED' && match.status !== 'ACCEPTED'` for idempotency.
- **Test user for previewing auth-protected pages**: `test@cleya.ai` / `test1234`. Re-seed with `npx ts-node apps/backend/scripts/seed-test-user.ts`. Idempotent.
- **Layout primitives**:
  - `AppShell` is `min-h-screen flex flex-col` with inner `flex-1 flex flex-col min-h-0`. Pages can use `flex-1` children safely.
  - `.glass-header` (the top nav) is exactly **52px** tall and has `position: relative; z-index: 50` so dropdowns inside it stack above page content.
  - For viewport-filling pages (chat, etc.), wrap the main block in `<div style={{ height: 'calc(100dvh - 52px)' }} className="flex flex-col">` so the footer sits below the fold.
- **Two chat pages exist**: `/chat/PageClient.tsx` (used in production for both onboarding and post-onboarding chat) and `/secretary/PageClient.tsx`. Any chat-layout fix must be applied to BOTH.
- **Design tokens** (current warm-indigo palette): Canvas `#0B0820`, Surface `#15102E`, Card `#1E1745`; Violet `#8B7BFF`, Teal `#5DECDC`, Magenta `#FF6B9D`.
- **Email preview**: render-only (no send) via `npx ts-node apps/backend/scripts/preview-emails.ts` → outputs to `docs/email-previews/*.html`. Real send via `apps/backend/scripts/send-demo-emails.ts`.
- **Webhook signature secrets** (set these in Replit secrets to enforce verification — see `SECURITY_AUDIT_2026-04-20.md`):
  - `RESEND_WEBHOOK_SECRET` (format: `whsec_<base64>`, from Resend dashboard → Webhooks) — verifies svix-signed Resend webhooks. When unset, webhook is accepted with a loud warning log.
  - `GUPSHUP_WEBHOOK_SECRET` — same pattern for Gupshup.
  - `META_WHATSAPP_APP_SECRET` — same pattern for Meta Cloud API webhooks; when set, x-hub-signature-256 header is also required.
- **`/api/gupshup/test-send` is MANAGER-only** (was previously unauthenticated). Use the test user only for non-MANAGER scenarios; for WhatsApp test sends, log in as a MANAGER role account.

## Architecture
Monorepo with:
- `apps/frontend` — Next.js 14 on port 5000
- `apps/backend` — Express + ts-node-dev on port 3001 (WebSocket on 3002)
- `packages/db` — Prisma ORM with PostgreSQL + pgvector
- `packages/ai` — LLM abstraction (OpenAI/Anthropic/Google Gemini) with multi-model routing
- `packages/conversation-engine` — JSON state machine for onboarding flows
- `packages/api` — Shared API services: vector matching, embedding generation (pgvector)
- `packages/matching` — Rule-based + intent + semantic matching engine
- `packages/types` — Shared TypeScript types

## Stack
- **Avatar Optimization:** Single source of truth for OAuth avatar domains in `apps/frontend/src/lib/avatarDomains.js` (shared by next.config.js remotePatterns and runtime `isOptimizedAvatarDomain` utility in `avatarOptimization.ts`). Covers Google, GitHub, Facebook, Twitter, LinkedIn, Discord, Apple, Microsoft, Slack, Gravatar.
- **Frontend:** Next.js 14, React 18, Tailwind CSS ("Premium Dark" theme — Canvas #080D1A, Surface #0F1629, Card #1A2035, Raised #252B42; Brand accents: Violet #6C63FF primary CTA, Teal #4ECDC4 success/match; Plus Jakarta Sans + DM Mono typography), Framer Motion 11, @react-three/fiber 8.15.12 + drei 9.92.7 + three 0.160.0 (3D hero constellation), AppShell component (ParticleNetwork + dot-grid overlay for all pages), TiltCard (3D perspective hover), 3D scroll animations, flip counters, 3D button press effects
- **Mobile:** Expo SDK 52 (React Native 0.76), expo-router 4, React Query, SecureStore for auth tokens, expo-file-system + expo-sharing (data export), expo-web-browser (OAuth flows), expo-linking (deep links for reset-password, verify-email, join)
- **Backend:** Express, TypeScript, WebSocket
- **Database:** PostgreSQL (Replit built-in), Prisma ORM, pgvector
- **Auth:** JWT in httpOnly secure cookie (`cleo_auth`) for web, Bearer token (`Authorization: Bearer <token>`) for mobile. bcryptjs password hashing, CSRF double-submit cookie protection (web only), email verification on signup. Mobile stores JWT in expo-secure-store. Frontend auth checks use `/auth/me` endpoint. Additional auth options: Google OAuth, LinkedIn OAuth, and Clerk (optional, behind `CLERK_SECRET_KEY` + `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` web / `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` mobile; Clerk session token is exchanged at `POST /api/auth/clerk/exchange` to issue the standard Cleya session — cookie for web, JWT body for mobile).
- **RBAC:** 4-role hierarchy: ADMIN > MANAGER > USER > VIEWER. Default signup role: VIEWER. `requireRole(minimumRole)` middleware enforces hierarchy on all admin endpoints. `requireReauth` middleware requires elevated session token (15-min) for sensitive ops (role changes, user deletion). Admin sessions timeout after 30 minutes. Admin login rate-limited to 5 attempts per 15 min.
- **MFA (TOTP):** Optional TOTP-based MFA via `otplib`. Enrollment: `POST /api/auth/mfa/setup` → QR code + secret. Verify: `POST /api/auth/mfa/verify`. Login flow: if MFA enabled, returns `mfaRequired: true` with partial token, then `POST /api/auth/mfa/validate` completes login. Re-auth: `POST /api/auth/reauth` for elevated session token.
- **Admin Audit Logging:** `AdminAuditLog` table (`admin_audit_logs`) logs all admin actions (role changes, user deletions, status changes) with actor, target, action, metadata, IP, timestamp. API: `GET /api/admin/audit-logs`. Security logger extended with MFA_SETUP, MFA_ENABLED, MFA_VALIDATE, REAUTH, USER_MANAGEMENT actions.
- **Validation:** Zod schemas on all state-changing endpoints (profile, password, match, introduction)
- **Security Middleware:** Input sanitization (`middleware/sanitize.ts`) strips null bytes, control chars, normalizes Unicode (NFKC). HTML stripping (`stripHtml` in `validation.ts`) removes `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, event handlers, `javascript:` URIs. Body size limit 1MB. Helmet with CSP, HSTS, X-Content-Type-Options. Global ZodError + SyntaxError catching in error handler returns 400 (never 500 with stack traces). Health endpoint does not expose env/NODE_ENV.
- **AI:** Multi-model LLM routing — OpenAI (GPT-4o, GPT-4o-mini), Anthropic (Claude Sonnet, Haiku), Google Gemini (1.5 Pro, Flash, 2.0 Flash). Model router (`modelRouter.ts`) selects optimal model per task type/agent. Cost tracking per API call with ₹500 high-cost alerting to Ledger.

## Environment Variables (see .env.example for full list)
**Required:** `DATABASE_URL`, `JWT_SECRET` (min 32 chars; startup throws if missing)
**Optional (graceful fallback):** `OPENAI_API_KEY` (AI chat → fallback responses), `ANTHROPIC_API_KEY` (Claude models for content/support), `GOOGLE_AI_API_KEY` (Gemini models for Indian language content/research), `GUPSHUP_API_KEY` + `GUPSHUP_APP_NAME` + `GUPSHUP_SOURCE_NUMBER` (Gupshup WhatsApp — sole messaging provider), `GUPSHUP_TEMPLATE_NAMESPACE` (Gupshup template messages), `GUPSHUP_WEBHOOK_SECRET` (optional webhook verification), `SMTP_*` (emails logged only), `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REDIRECT_URI` (Google Calendar + Google login), `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET` (LinkedIn login hidden), `SENTRY_DSN` (backend error tracking), `NEXT_PUBLIC_SENTRY_DSN` (frontend error tracking via CDN), `NEXT_PUBLIC_POSTHOG_KEY` (PostHog analytics), `NEXT_PUBLIC_GA_MEASUREMENT_ID` (Google Analytics 4)
**Admin Analytics Integrations (optional):** `GA4_PROPERTY_ID` + `GA4_SERVICE_ACCOUNT_KEY` (GA4 Data API — website traffic in Control Tower), `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_BUSINESS_ACCOUNT_ID` (Instagram Graph API — social metrics), `POSTHOG_API_KEY` + `POSTHOG_HOST` + `POSTHOG_PROJECT_ID` (PostHog API — product analytics), `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` (Sentry API — error tracking analytics in Control Tower). All show "Not configured" UI when missing.
**Publishing Integrations (optional):** `LINKEDIN_PAGE_ACCESS_TOKEN` + `LINKEDIN_ORG_ID` (LinkedIn UGC Posts API — content publishing). Email publishing uses existing Resend integration.
**Razorpay (optional):** `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` + `RAZORPAY_PLAN_ID` + `RAZORPAY_WEBHOOK_SECRET` — payment gateway for subscription paywall. Without these, payment service gracefully reports "not configured".
**Admin seed:** `ADMIN_EMAIL` + `ADMIN_PASSWORD` — both must be set to create admin; no defaults in code
**CORS:** `CORS_ORIGIN` env var → defaults to `FRONTEND_URL`; locked to single origin (not wildcard)

## Analytics & Error Tracking
- **Frontend Sentry:** Loaded via CDN script (`browser.sentry-cdn.com/8.48.0/bundle.min.js`) in `BootstrapClient.tsx` — avoids webpack conflicts with Next.js 14. Helper functions in `src/lib/sentry.ts` (`captureException`, `captureMessage`, `setUser`). Initializes on all routes regardless of cookie consent (essential service).
- **Frontend GA4:** `src/lib/ga.ts` — CDN-loaded Google Analytics. Consent-gated via `cleo_cookie_consent` localStorage key. Page views tracked via `usePathname()` in `BootstrapClient.tsx` (single source, `send_page_view: false` in config).
- **Frontend PostHog:** CDN-loaded in `BootstrapClient.tsx`. Consent-gated. Analytics helpers in `src/lib/posthog.ts`.
- **Backend Sentry:** `@sentry/node` in `apps/backend/src/index.ts` + `errorHandler.ts`. Uses `SENTRY_DSN` env var.
- **Cookie consent:** Banner in `BootstrapClient.tsx` (DOM-injected, not React-rendered). Stored as `cleo_cookie_consent` in localStorage. PostHog + GA4 only init after "Accept all"; Sentry loads regardless.

## Subscription Paywall
- **Model:** `Subscription` (`subscriptions` table) tracks Razorpay subscription per user — razorpaySubscriptionId, razorpayPlanId, status (INACTIVE/CREATED/AUTHENTICATED/ACTIVE/PENDING/HALTED/CANCELLED/COMPLETED/EXPIRED), currentPeriodStart/End. One-to-one with User.
- **Free Tier:** 5 lifetime free accepted matches tracked via `User.matchesUsed` counter. After 5, paywall blocks accepting new matches (402 response with `PAYWALL_LIMIT_REACHED` code).
- **PRO Tier:** Unlimited matches after Razorpay subscription activated. User.tier set to PRO on `subscription.activated`/`subscription.charged` webhook events.
- **Enforcement:** Server-side in `POST /api/matches/:id/respond` (ACCEPTED only). Match scheduler skips free users at limit. Frontend shows remaining matches banner + paywall modal.
- **Razorpay Integration:** `razorpayService.ts` — creates subscriptions via Razorpay API, verifies webhook signatures (HMAC SHA256), handles lifecycle events (activated, charged, cancelled, halted, expired → tier changes).
- **Routes:** `POST /api/subscription/create` (creates Razorpay subscription), `GET /api/subscription/status` (returns tier, matches used/remaining), `POST /api/subscription/webhook` (Razorpay webhook handler).
- **Frontend:** Paywall modal in MatchesPage, Razorpay Checkout.js integration. Pricing page links to real checkout flow.
- **Admin:** Admin users endpoint includes tier, matchesUsed, subscription status per user.

## Matching Engine Intelligence
The matching engine (`packages/matching/src/index.ts`) uses a three-layer hybrid approach: Rule-based (50%), Intent (20%), Semantic (30%). Enhanced with:
- **Traction-stage alignment**: Investors see founders whose traction matches their stage focus (e.g., Series A investors see founders with MRR > ₹5L)
- **Portfolio conflict detection**: Investors are deprioritized for founders in sectors where they already have a portfolio company
- **Availability filtering**: Users not open to meeting or over their weekly intro cap are deprioritized (data from `extraData` JSON field)
- **Talent preference matching**: Equity preference, work style, functional area alignment
- **Feedback-driven re-ranking**: MatchFeedback ratings and IntroductionRecord outcomes (accept rates, positive outcome rates) are used as multipliers on hybrid scores (min 3 feedbacks to activate)

## Email Drip Campaign System
- **Model:** `DripEmail` (`drip_emails` table) tracks drip email state per user — sequence, emailKey, status (PENDING/SENT/SKIPPED/FAILED), scheduledFor, matchId. Unique constraint on (userId, sequence, emailKey) prevents duplicates.
- **Sequences:** ONBOARDING (Day 1: profile nudge, Day 3: how matching works, Day 7: match check-in), MATCH_FOLLOWUP (Day 3 post-acceptance: post-intro follow-up), FEEDBACK_REQUEST (Day 5 post-acceptance: feedback request with link).
- **Service:** `dripCampaignService` (`apps/backend/src/services/dripCampaignService.ts`) — enrolls users into sequences, processes due emails with smart skipping (skip profile nudge if profile complete, skip feedback request if feedback already submitted).
- **Cron:** Daily at 10:00 IST via `matchScheduler.runDripCampaign()`.
- **Hooks:** Auto-enrolls on signup (email/Google/LinkedIn via `authService`), auto-enrolls match follow-up + feedback request on match acceptance (`matchingService.respondToMatch`).
- **Templates:** `emailService` methods: `sendProfileNudge`, `sendHowMatchingWorks`, `sendMatchCheckIn`, `sendPostIntroFollowUp`, `sendFeedbackRequest`. All use existing Cleya brand template.
- **Dynamic intent signal**: Recent accept/decline patterns infer current intent (e.g., founder declining investors → NOT_FUNDRAISING) and adjust scores
- **Structured compatibility signals**: LLM match reasoning receives data (sector overlap %, stage fit, check size alignment, traction highlights) for specific introductions
- **LinkedIn enrichment**: Background job (`linkedinEnrichmentService.ts`) extracts career history, domain expertise, notable companies, exits from profile data + LinkedIn URL via LLM, stores in `profile.extraData.enrichedData`. Runs daily at 3:00 AM IST and on new profile completion.
- **Enhanced embeddings**: Embedding text now includes traction metrics, portfolio companies, equity/work preferences, and enriched LinkedIn data

New profile fields stored in `extraData` JSON: `portfolioCompanies`, `openToMeeting`, `weeklyIntroCap`, `equityPreference`, `workStyle`, `functionalArea`, `tractionMetrics`, `enrichedData`

## Match Scheduler
Automatic batch matching runs 3 times daily at **8:00 AM, 2:00 PM, and 8:00 PM IST** via `node-cron` in `apps/backend/src/services/matchScheduler.ts`. Each run: (1) finds all complete profiles, (2) backfills any missing embeddings, (3) runs `findAndAutoPropose` for each user (up to 3 matches per user per run). Skips already-existing match pairs. Admin can trigger manually via `POST /api/admin/batch-matching`. LinkedIn enrichment batch runs daily at **3:00 AM IST**.

Additional scheduled jobs:
- **Self-ping health check** — every 5 minutes, pings `/api/health` and logs warnings on failure
- **Weekly analytics summary** — Monday 10:00 AM IST, logs key platform metrics (new users, matches, calls, messages) for the past week
- **Old data cleanup** — daily 2:00 AM IST, prunes read notifications (>30 days) and old activity records (>90 days)

The backend handles `SIGTERM`/`SIGINT` for graceful shutdown: stops cron jobs, closes HTTP server, disconnects database (10s safety timeout). Health endpoint (`/api/health`) reports database connectivity, scheduler state, uptime, and memory usage (returns 503 when degraded).

## Agent Scheduler (Autonomous AI Workforce — 7 Agents)
`apps/backend/src/services/agentScheduler.ts` starts alongside `MatchScheduler` on server boot. Uses `node-cron` to autonomously run 7 AI agents:
- **Nexus** (Orchestrator): Daily at 7:00 AM IST — generates daily ops plan, delegates to sub-agents via JSON output
- **Maven** (Content Strategist): Mondays at 7:30 AM IST — weekly topic research & content calendar
- **Ledger** (Finance): Mondays at 8:00 AM IST — revenue tracking, burn rate analysis, financial summaries
- **Sentinel** (CTO): Mon/Thu at 9:00 AM IST — tech debt review, deployment health, architecture recommendations
- **Ally** (Support): Mon/Wed/Fri at 10:00 AM IST — ticket summaries, NPS analysis, help-desk automation
- **Catalyst** (Growth): Tuesdays at 11:00 AM IST — funnel analysis, A/B test proposals, growth experiments
- **Closer** (Sales): Thursdays at 11:00 AM IST — lead sourcing, outreach sequences, pipeline analysis

Backward-compatible agent ID aliases: `orchestrator→nexus`, `content-strategist→maven`, `social-media→maven`, `email-marketing→maven`, `cold-outreach→outreach`, `email-campaign→outreach`, `bulk-email→outreach`.

**Outreach Agent** (`outreach`): Cold bulk email marketing campaign agent. Creates/manages email campaigns with personalization, drip sequences, recipient lists, and analytics. Tools: `create_email_campaign`, `add_recipients`, `launch_campaign`, `get_campaign_analytics`, `get_recipient_list`, `pause_campaign`, `send_email`. Service: `outreachCampaignService.ts`. Tables: `outreach_campaigns`, `outreach_recipients`, `outreach_unsubscribes`. Safety: email validation, 500 recipients/campaign cap, 200 sends/day limit, 500ms delay between sends, mid-send pause support, unsubscribe list filtering. Scheduled Tue/Thu at 10 AM IST. Uses Resend for delivery.

**AgentRunner** (`apps/backend/src/services/agentRunner.ts`): Executes agents using multi-model LLM routing — each agent/task uses the optimal model selected by the model router (`modelRouter.ts`). Maven uses Claude Sonnet for LinkedIn thought leadership, Ally uses Claude Sonnet for empathetic support replies, Ledger uses GPT-4o for financial analysis, and cost-efficient tasks use GPT-4o-mini or Gemini Flash. Fallback logic: if primary model fails, automatically retries with fallback model. Per-call cost estimation logged (model_used, api_cost_usd, api_cost_inr) to execution log. ₹500 high-cost task alerts sent to Ledger. Task payloads include `assigned_model` set by Nexus. Writes generated content to `dm_content_queue` (Supabase REST) with status PENDING for human review, logs execution metadata to `dm_agent_logs`. Retry logic with exponential backoff (max 2 retries, 2s base delay). Agent state persisted to `dm_agent_state` table via Prisma raw SQL. State hydrated on boot. Enable/disable toggles per agent. Memory context injected into system prompts before each run; run results stored as short-term memories after completion.

**Agent Memory System** (`apps/backend/src/services/agentMemoryService.ts`): 6-layer persistent memory for agents:
- **Working Memory** (`agent_working_memory`): Session-scoped JSON, one per agent, tracks current active task context. Cleared after each run.
- **Short-Term Memory** (`agent_short_term_memory`): Time-decaying entries (48h TTL), stores recent run outputs, decisions, context.
- **Long-Term Memory** (`agent_long_term_memory`): Durable patterns with confidence scores. Auto-promoted from short-term when a pattern appears 3+ times (keyword overlap detection).
- **Episodic Memory** (`agent_episodic_memory`): Tagged notable events (successes, failures, milestones) with impact assessment.
- **Semantic Memory** (`agent_semantic_memory`): Vector embeddings (pgvector 1536-dim) for domain knowledge retrieval via cosine similarity search.
- **Shared Memory** (`dm_shared_memory`): Central knowledge pool visible to ALL agents. Agents can add insights, decisions, strategies, metrics via `add_shared_memory` tool. Supports categories, importance levels (critical/high/normal/low), tags, and expiration. Auto-injected into every agent's system prompt as "Team Shared Knowledge".
Memory is assembled and injected into agent system prompts automatically before each run. Admin UI "Memory" tab per agent shows all layers with add/delete capabilities. API routes: `GET/POST /admin/agents/:id/memory`, `DELETE /admin/agents/:id/memory/:memoryId?layer=...`. Shared memory API: `GET /agent-chat/shared-memory`.

**Inter-Agent Communication** (`apps/backend/src/services/agentCoordinationService.ts`): Agents can communicate with each other via `dm_agent_comms` table:
- **Direct Messages** (`message_agent`): Agent-to-agent messaging with subject, priority, and message types.
- **Task Delegation** (`delegate_to_agent`): Agents delegate tasks to teammates with context and priority.
- **Insight Broadcast** (`share_insight`): Broadcast important findings to all agents simultaneously.
- **Inbox** (`get_my_inbox`): Each agent has an inbox with unread messages, sorted by priority.
- **Team Updates** (`get_team_updates`): View recent communication activity.
- **Coordinated Tasks** (`coordinate_task`, Nexus only): Orchestrate multi-agent tasks across the team.
- **Inbox Processing**: On each chat, agent's unread messages are loaded and injected into context.
- **Frontend**: "team-comms" channel in Control Tower shows all agent-to-agent communication feed. API: `GET /agent-chat/team-comms`.

**Agent Chat Persistence** (`dm_agent_chat_history`): All agent chat messages (user + assistant) are stored in PostgreSQL, scoped per user_id. Backend loads last 40 messages from DB on each request (frontend doesn't pass history). Chat history restored on page load via `GET /agent-chat/history`. Each chat interaction stored as short-term memory for agent recall.

**AgentNotifier** (`apps/backend/src/services/agentNotifier.ts`): Sends Slack alerts to `#all-cleya` on agent success/failure. Sends email via Resend to admin on agent failure. Non-blocking, errors logged silently.

**File Upload & Creation** (`apps/backend/src/services/fileService.ts`, `apps/backend/src/routes/files.ts`): Full file management system for agents and users:
- **User uploads**: `POST /api/files/upload` — multipart file upload (images, PDFs, text, CSV, JSON, XLSX, DOCX). Max 10MB. Stored on local disk with metadata in `dm_files` table. File content validated via magic bytes.
- **Agent file creation**: `create_file` tool — agents can generate reports, CSV exports, markdown docs, analysis summaries, data exports. All 7 agents have `create_file` and `list_files` tools.
- **File access**: `GET /api/files/download/:fileId` (download), `GET /api/files/view/:fileId` (inline view), `GET /api/files/list` (list all files). DELETE requires ADMIN role.
- **Chat integration**: Users can attach files to agent chat messages (via paperclip button). File metadata is injected into agent context. Agent-created files generate download links rendered as clickable buttons in chat.
- **Frontend**: Paperclip button in chat input bar, file preview chips with remove, upload progress indicator, download buttons rendered in agent responses.

**AgentMigration** (`apps/backend/src/services/agentMigration.ts`): Auto-creates `dm_agent_state`, `dm_files`, `dm_shared_memory`, `dm_agent_comms`, `dm_agent_chat_history` tables via Prisma `$executeRawUnsafe` on startup. Sends `NOTIFY pgrst, 'reload schema'` to refresh Supabase PostgREST cache.

**Smart Orchestrator Delegation**: When Nexus completes, scheduler parses its full JSON output for task keys (`mavenTasks`, `ledgerTasks`, `sentinelTasks`, `allyTasks`, `catalystTasks`, `closerTasks`), creates `dm_agent_tasks` entries for each sub-agent. Falls back to triggering all sub-agents if JSON parsing fails.

**Supabase client** (`apps/backend/src/services/supabaseClient.ts`): Lightweight REST client for backend to read/write Supabase `dm_*` tables (content queue, logs, tasks). All frontend agent data access goes through backend proxy endpoints (`/api/admin/agents/data/*`) — no direct Supabase credentials in the frontend.

**Autonomy & Guardrails** (`apps/backend/src/services/guardrailsService.ts`): Per-agent autonomy levels — `manual` (all content queued for review), `semi_autonomous` (low-risk auto-executed, high-risk queued), `autonomous` (all auto-executed within guardrails). Guardrails framework enforces `daily_action_limit`, `daily_spend_cap`, and `content_blocklist` per agent. Execution audit log written to `dm_execution_log` table for every agent action.

**Agent Analytics Tools** (`apps/backend/src/services/analyticsToolsService.ts`): All 7 agents have access to real-time analytics data via 7 read-only tools: `get_posthog_insights` (user behavior, events, retention, feature usage from PostHog), `get_ga4_insights` (website traffic, top pages, traffic sources, geo from GA4), `get_analytics_overview` (combined summary across GA4, PostHog, Instagram, Sentry), `get_platform_stats` (core DB metrics — users, matches, calls, acceptance rates, top cities/roles), `get_user_growth_trend` (daily signup/match trends), `get_funnel_metrics` (activation funnel: signup → profile → match → accept → conversation → call with per-stage conversion), `get_agent_performance` (other agents' activity logs and states). Agents are instructed via `masterPrompt.ts` to proactively query data before making recommendations. Tools defined in `agentTools.ts` TOOL_DEFINITIONS, mapped to all agents via ANALYTICS_TOOLS array.

**Publishing Services** (`apps/backend/src/services/publishingService.ts`): Orchestrates multi-channel content publishing for approved content. Channels: LinkedIn (`linkedinPublisher.ts` — UGC Posts API), Instagram (`instagramService.ts` — Graph API single image + carousel), Email (Resend integration). `POST /api/admin/content/:id/publish` publishes single item; `POST /api/admin/content/publish-approved` batch-publishes all approved content.

**Emergency Kill Switch**: `POST /api/admin/agents/emergency-stop` sets all agents to `manual` autonomy and disables them, halting all autonomous activity immediately. Frontend shows a red "Emergency Stop" button when any agent is non-manual.

**Admin API endpoints:**
- `GET /api/admin/agents/status` — returns real-time agent statuses (running/completed/failed/scheduled), last run times, durations, enabled state, cron schedules, autonomy level
- `POST /api/admin/agents/:id/run` — manually trigger any agent immediately
- `GET /api/admin/agents/:id/run-history?limit=30` — paginated run history logs
- `GET /api/admin/agents/:id/accountability` — accountability stats (success rate, total runs, avg duration, generated content)
- `PATCH /api/admin/agents/:id/config` — update enabled state, cron expression (validated), cron description, autonomy_level, guardrails; triggers schedule reload
- `POST /api/admin/agents/activate-workforce` — configures and activates 5 high-impact agents (Probe, Maven, Scout, Nexus, Outreach) with tailored task contexts, schedules (Probe: daily 7am IST, Maven: MWF 10am IST, Scout: weekly Mon 6am IST, Nexus: weekly Mon 7am IST, Outreach: Tue/Thu 10am IST), manual autonomy, and sensible guardrails (maxActionsPerDay: 10, maxPostsPerDay: 5, maxSpendPerDay: 0). Agent runs execute in the background; returns immediately with config status. Frontend "Activate Workforce" button in AgentsManagement.tsx.
- `POST /api/admin/agents/emergency-stop` — emergency kill switch, disables all agents and sets to manual
- `POST /api/admin/content/:id/publish` — publish a single approved content item to its channel
- `POST /api/admin/content/publish-approved` — batch publish all approved content
- `GET /api/admin/execution-log` — query execution audit log with optional agent_id filter
- `GET /api/admin/analytics/health` — reports which analytics services (GA4, Instagram, PostHog, Sentry) are configured
- `GET /api/admin/agents/data/list` — proxy to Supabase dm_agents table
- `GET /api/admin/agents/data/logs` — proxy to dm_agent_logs (optional ?agent_id filter)
- `GET /api/admin/agents/data/tasks` — proxy to dm_agent_tasks (optional ?agent_id filter)
- `PATCH /api/admin/agents/data/tasks/:id/status` — update task status
- `GET /api/admin/agents/data/content` — proxy to dm_content_queue (optional ?agent_id filter)
- `PATCH /api/admin/agents/data/content/:id/status` — update content status
- `GET/POST /api/admin/agents/data/messages` — read/write dm_agent_messages (optional ?agent_id filter)
- `GET /api/admin/agents/data/code-changes` — proxy to dm_code_changes (optional ?agent_id filter)
- `GET /api/admin/agents/data/campaigns` — proxy to dm_campaign_metrics

**Frontend — Control Tower (Slack-style 3-panel layout):**
The admin Control Tower (`apps/frontend/src/app/controltower/PageClient.tsx`) uses a three-panel Slack-style layout:
- **Left panel (240px):** Channel sidebar (`ChannelSidebar.tsx`) — lists #founder-room (default), #all-agents (broadcast), and per-agent channels (#nexus, #maven, #ledger, #sentinel, #ally, #catalyst, #closer) with real-time presence indicators and unread counts.
- **Center panel (flexible):** Chat feed (`ChatPanel.tsx`) — Slack-style message timeline where admin can chat with agents inline. Supports @mentions routing (e.g., @maven in #founder-room routes to Marketing agent), threaded conversations, and expandable message content. Agent run outputs and system events render as styled messages.
- **Right panel (320px, collapsible):** Insights panel (`InsightsPanel.tsx`) — shows contextual data per channel: agent stats, run history, quick actions for agent channels; Overview stats, Comms, Deals, Events, Analytics, WhatsApp data for #founder-room.
- **Command palette (Cmd+K):** `CommandPalette.tsx` — fuzzy search overlay for /ask, /run, /report, /schedule, /approve commands and channel navigation.
- **Shared types/data:** `control-tower/types.ts` — Channel, ChatMessage, Thread, AgentInfo types plus AGENT_CHANNELS and AGENT_MAP (derived from shared `lib/agentDefinitions.ts` registry for single source of truth).

Legacy components `AgentsManagement.tsx` and `AgentArchitecture.tsx` are preserved but no longer directly rendered in the main layout (functionality migrated to insights panel and chat system).

## Founder Mode Dashboard & Decision Engine
`apps/frontend/src/components/admin/FounderMode.tsx` — Strategic command center accessible from the Control Tower "Founder Mode" tab (⚡). Answers "What should I do today?" with:
- **Daily Briefing**: Auto-generated summary of key metrics, agent activity (24h), pending content, priority items, and a prioritized action list. Generated by the Orchestrator via `POST /api/admin/founder/briefing/generate`. Stored in `dm_daily_briefings` table.
- **Decision Cards**: Data model for founder decisions (`dm_decisions` table). Agents can surface choices for founder input (title, context, options, requesting agent, urgency). Cards support Approve / Reject / Defer / Simulate actions.
- **AI Debate Mode**: On "Simulate", triggers multi-agent debate (`POST /api/admin/founder/decisions/:id/debate`). 2-3 relevant agents provide for/against/neutral perspectives with data points. Rendered as threaded debate with agent avatars. Stored in `dm_decision_debates` table.
- **Decision History**: Full decision log with context, agent recommendations, chosen action, and outcome tracking (`PATCH /api/admin/founder/decisions/:id/outcome`).
- **Priority Inbox**: Filtered view of actionable items — pending decisions, content approvals, agent errors, critical alerts — sorted by urgency with badge count.

**Founder Mode API endpoints:**
- `GET /api/admin/founder/briefing` — get latest daily briefing
- `POST /api/admin/founder/briefing/generate` — generate fresh briefing from live data
- `GET /api/admin/founder/decisions` — list decisions (filterable by status, urgency)
- `POST /api/admin/founder/decisions` — create a new decision (auto-sends Slack notification)
- `PATCH /api/admin/founder/decisions/:id` — approve/reject/defer a decision
- `PATCH /api/admin/founder/decisions/:id/outcome` — record decision outcome
- `POST /api/admin/founder/decisions/:id/debate` — trigger AI debate
- `GET /api/admin/founder/decisions/:id/debate` — get debate entries
- `GET /api/admin/founder/priority-inbox` — get priority inbox items
- `POST /api/admin/founder/audit-digest` — manually trigger daily audit digest
- `POST /api/admin/founder/weekly-report` — manually trigger weekly performance report

**Crisis Mode API endpoints:**
- `GET /api/admin/crisis-mode/status` — get current crisis mode state
- `POST /api/admin/crisis-mode/activate` — activate crisis mode (stops scheduler, pauses all agents, sends Slack alert)
- `POST /api/admin/crisis-mode/deactivate` — deactivate crisis mode (resumes scheduler, sends Slack notification)

**Safety & Notification System** (`apps/backend/src/services/founderSafetyService.ts`):
- **Approval notifications**: When a new decision is created, a structured Slack message is sent with agent name, context, options, urgency, and a link to Control Tower
- **Auto-escalation**: Every 30 minutes, checks pending decisions — sends escalation reminder after 2 hours, auto-cancels (rejects) after 4 hours
- **Crisis mode**: System-wide flag in `dm_system_flags` table — blocks all agent execution via scheduler guard, pauses all autonomous activity. Emergency stop button also activates crisis mode. Only deactivates via explicit API call.
- **Daily audit digest**: Sent at 10 PM IST via Slack + email — summarizes all agent actions (taken/blocked/errors), pending decisions, API spend
- **Weekly performance report**: Sent Monday 7 AM IST via email — platform metrics, content stats, agent activity, API spend

**DB tables** (auto-created via `ensureFounderModeTables()` and `ensureAgentTables()` in `agentMigration.ts`, and `ensureSafetyTables()` in `founderSafetyService.ts`):
- `dm_decisions` — decision records with title, context, options (text[]), urgency, status, outcome
- `dm_decision_debates` — debate entries linked to decisions, with agent_id, position, argument, data_points (JSONB)
- `dm_daily_briefings` — stored briefing snapshots with date and content (JSONB)
- `dm_system_flags` — key-value store for system-wide flags (crisis_mode state)
- `content_calendar` — structured content items with platform, content_type, risk_score (1-5), scheduled_time, status (draft/scheduled/pending_approval/approved/published/failed/blocked/rejected)
- `founder_approval_queue` — items needing founder approval, linked to content_calendar via content_calendar_id
- `audit_log` — comprehensive action audit trail with agent_id, action_type, risk_score, cost tracking
- `tickets` — support tickets for Ally agent
- `faq_kb` — FAQ knowledge base for self-service support
- `experiments` — growth experiments for Catalyst agent (A/B tests)
- `outreach_crm` — sales outreach CRM for Closer agent
- `ad_performance` — ad campaign performance tracking

## Agent Action Execution Pipeline
The agent system follows a structured execution pipeline: Agent generates content → Risk scoring (1-5 scale) → Approval routing → Publishing.

**Risk Scoring (1-5 scale)** (`guardrailsService.ts`):
- Score 1-2: Low risk — auto-publishable if autonomy level allows
- Score 3: Medium risk (named persons, financial claims, legal language, non-English) — requires founder approval
- Score 4: High risk (journalist/investor context, ad spend, mass email, multiple financial claims) — requires founder approval
- Score 5: Critical (crisis topics, significant legal language) — always requires founder approval

**Content Calendar Flow**:
- Maven agent generates structured JSON content items (individual LinkedIn posts, Instagram posts, newsletters)
- Each item gets risk-scored and inserted into `content_calendar` with appropriate status
- Items with risk_score < 3 and sufficient autonomy level → `scheduled` (auto-publish at scheduled_time)
- Items with risk_score >= 3 → `pending_approval` (added to founder_approval_queue)
- A cron job runs every 15 minutes to publish due scheduled/approved items via LinkedIn/Instagram/email
- Founder can approve (schedule for later or publish immediately) or reject items

**Content Calendar API endpoints:**
- `GET /api/admin/content-calendar` — list calendar items (filterable by status, platform)
- `POST /api/admin/content-calendar/:id/approve` — approve item (with optional immediate publish)
- `POST /api/admin/content-calendar/:id/reject` — reject item
- `POST /api/admin/content-calendar/:id/publish` — manually publish a calendar item
- `POST /api/admin/content-calendar/process` — manually trigger the publish processor
- `GET /api/admin/approval-queue` — list founder approval queue items

**Daily Nexus Briefing** (8 AM IST cron):
- Aggregates yesterday's actions, pending approvals, content calendar status, platform metrics
- Sends structured summary via Slack and email to founder

## Slack Notifications
`apps/backend/src/services/slackService.ts` uses `@slack/web-api@7.10.0` via Replit's Slack connector (OAuth token auto-managed). Posts to `#all-cleya` channel (fallback: `#new-signups`, `#general`). Bot name in Slack: `replit`.
- **User registration**: Fires on every signup (async, non-blocking) — shows email, name, total user count.
- **Daily report**: Scheduled at **9:00 PM IST** — shows total/new users, profile completion, match stats (total/new/accepted/pending), persona breakdown.
- **Admin endpoints**: `POST /api/admin/slack/daily-report` to trigger manually.

## Running the App
```
npm run dev
```
Starts both frontend (port 5000) and backend (port 3001) concurrently.

## Building for Production
```
npm run build
```
Builds in dependency order: prisma generate → types → db → ai → matching → conversation-engine → api → backend (tsc) → frontend (next build). All packages compile TypeScript to `dist/` with `main` pointing to `./dist/index.js`. Frontend build script (`build.js`) handles the Next.js 14 `_not-found` prerender bug: (1) generates fallback `prerender-manifest.json` with `notFoundRoutes: []` to prevent RSC contamination, (2) fixes `_buildManifest.js` by merging app routes from `app-build-manifest.json` into the client-side manifest (the build exits with error before writing page routes, leaving the manifest incomplete).

**AppShell pattern:** `AppShell.tsx` wraps all app pages with ParticleNetwork 3D background (dynamically imported, SSR-safe), dot-grid overlay, and proper z-indexing. CSS utility classes in `globals.css`: `glass-card-glow` (hoverable glassmorphism card), `glass-header` (frosted sticky header), `glass-stat` (animated stat card), `gradient-text` (blue-to-purple text gradient), `fade-up`/`fade-up-d1`/`fade-up-d2`/`fade-up-d3` (entrance animations), `cta-shimmer` (shimmer sweep on CTA buttons), `glow-pulse` (pulsing glow effect). All authenticated and public pages use AppShell. The landing page (`PageClient.tsx`) has its own 3D setup and does not use AppShell.

**AppNav component:** `AppNav.tsx` provides unified navigation across all logged-in pages (Dashboard, Matches, Intros, AI Secretary, Profile, Settings). Highlights the active page, includes MobileNav drawer for mobile. Used by dashboard, matches, introductions, introductions/[id], profile, settings, secretary, messages. Chat page uses its own custom header.

**PublicNav component:** `PublicNav.tsx` provides unified navigation for public/marketing pages (About, Features, Pricing, Blog, Contact + Log In/Get Started). Blue "C" square logo used site-wide (nav, footer, 404).

**Logo:** Violet (#6C63FF) square with white "C" — used consistently across homepage nav, PublicNav, AppNav, AppFooter, and 404 page.

**/register route:** Redirects to `/?action=signup` (server-side redirect via Next.js).

**SafeMotion pattern:** `SafeMotion.tsx` provides SSR-safe framer-motion wrappers. Uses a global `notifyMounted()` pattern (called from `ClientProviders` in layout) instead of `useContext` — because React's context dispatcher is null during Next.js static page generation. Components render plain HTML elements until mount, then switch to framer-motion components. The homepage uses `export const dynamic = 'force-dynamic'` to skip static prerendering entirely (framer-motion + Next.js SSG are incompatible).

## Production Start
```
npm run start
```
Runs backend (`node dist/index.js` on port 3001) and frontend (`next start` on port 5000) concurrently.

## Page Architecture
All frontend pages use a server/client wrapper pattern for build compatibility:
- `page.tsx` — server component that exports `dynamic = 'force-dynamic'` and wraps the client component in a function (e.g., `export default function Page() { return <Home />; }`)
- `PageClient.tsx` — the actual `'use client'` component with hooks, state, and UI

### Pages
- `/` — Landing page with auth modal (signup/login), mobile hamburger menu, real stats from DB (qualitative fallback if <10 members), testimonials
- `/about` — About page with mission, team section, investor/backer logos, qualitative highlights (no fake numbers), contact info
- `/pricing` — 3 tiers (Free/Professional ₹999/Growth ₹2999) + Enterprise + FAQ, monthly/annual toggle
- `/blog` — Blog listing with 5 posts (fundraising, investors, networking, AI matching, co-founders)
- `/blog/[slug]` — Blog post detail page with reading time, author, related posts
- `/cities/[city]` — City landing pages (Bangalore, Mumbai, Delhi, Hyderabad, Pune, Chennai) with local stats, investors, sectors
- `/messages` — P2P messaging between accepted matches with real-time chat, typing indicators via WebSocket
- `/features` — Features overview (8 feature cards)
- `/contact` — Contact form (Name, Email, Subject dropdown, Message) with FAQ accordion (7 items), loading spinner on submit, 24-48hr response time
- `/login` — Redirects to `/?action=login` to open login modal
- `/dashboard` — User dashboard with stats, matches, invite codes, activity feed, AI chat; stats auto-refresh on visibility change
- `/profile` — Profile editor; merges `extraData` JSON for persona-specific fields (preferredRole, portfolioSize, etc.)
- `/matches` — Match listing with qualitative labels + expandable score breakdown (industry/stage/location/goals/skills/role), verification badges, Message button for accepted matches, feedback, search
- `/chat` — AI onboarding conversation with progress indicator (Step X of 5)
- `/secretary` — AI Secretary chat interface with OpenAI-powered assistant for scheduling meetings, sending follow-ups, daily digest, and Zoom integration; quick prompt suggestions on empty state; action buttons for suggested meeting/followup actions
- `/settings` — Account settings with phone display (syncs from profile), password change, notification preferences (persisted to CommunicationPreference model), Zoom integration (connect/disconnect), Google Calendar integration (connect/disconnect with email display)
- `/introductions` — Introduction records with full status lifecycle (PENDING_APPROVAL → APPROVED → SENT → VIEWED → RESPONDED → COMPLETED)
- `/admin` — Admin dashboard

### API Endpoints (Backend)
- `GET /api/search?q=&persona=&industry=&location=&limit=` — Search users by name, headline, company, bio; filter by persona/industry/location
- `GET /api/conversations` — List all conversations for authenticated user with last message
- `POST /api/conversations/:id/messages` — Send a message in a conversation (alias for `/message`)
- `POST /api/verification/linkedin` — Validate and save LinkedIn URL to profile (linkedinVerified stays false until OAuth implemented)
- `GET /api/verification/status` — Get verification score, tier, badge, and factor breakdown
- `GET /api/dm/conversations` — List P2P message conversations for authenticated user
- `GET /api/dm/:partnerId` — Get direct messages with a partner (paginated)
- `POST /api/dm/:partnerId` — Send direct message to an accepted match partner
- `POST /api/dm/:partnerId/read` — Mark conversation as read
- `GET /api/meetings` — List meetings for authenticated user
- `POST /api/meetings` — Propose meeting with time slots
- `PUT /api/meetings/:id/confirm` — Confirm a meeting with selected time
- `PUT /api/meetings/:id/cancel` — Cancel a meeting
- `GET /api/meetings/:id/ics` — Download ICS calendar file for meeting
- `POST /api/secretary/chat` — Chat with AI Secretary (OpenAI-powered, user context aware)
- `POST /api/secretary/action` — Execute secretary-suggested action (schedule_meeting, send_followup)
- `GET /api/secretary/digest` — Generate daily digest with pending matches, meetings, intros
- `POST /api/secretary/digest/send` — Send daily digest via email
- `GET /api/secretary/history?limit=` — Get secretary conversation history
- `DELETE /api/secretary/history` — Clear secretary conversation history
- `GET /api/zoom/status` — Check Zoom configuration and connection status
- `GET /api/zoom/connect` — Get Zoom OAuth authorization URL
- `GET /api/zoom/callback` — Zoom OAuth callback (redirects to /settings)
- `POST /api/zoom/disconnect` — Disconnect Zoom account
- `GET /api/calendar/status` — Check Google Calendar configuration and connection status
- `GET /api/calendar/connect` — Get Google OAuth authorization URL (calendar scopes)
- `GET /api/calendar/callback` — Google OAuth callback (redirects to /settings?calendar=connected)
- `GET /api/calendar/events` — Get upcoming calendar events (supports ?timeMin, ?timeMax)
- `POST /api/calendar/events` — Create calendar event (summary, start, end, attendees)
- `GET /api/calendar/availability?date=YYYY-MM-DD` — Check free/busy for a day
- `DELETE /api/calendar/disconnect` — Disconnect Google Calendar
- `GET /api/analytics/overview` — User-facing analytics: match stats, intro counts, profile completeness, recent matches
- `GET /api/referrals` — Invite code summary (total/used/available) with referred user details

### Shared Components
- `PublicNav.tsx` — Shared navigation bar for all public pages (About, Features, Contact, Log In, Get Started). Used by: about, features, contact, privacy, terms, pricing, blog, blog/[slug], cities/[city]. Homepage uses its own inline nav with section-specific links (How It Works, Pricing, Blog).
- `Toast.tsx` — Global toast notification system (success/error/info/warning). Provider in `ClientProviders.tsx`, wrapped in layout. Max 3 visible, auto-dismiss 5s, accessible with role="alert".
- `MobileNav.tsx` — Slide-out mobile navigation drawer (Dashboard, Matches, Messages, Introductions, Chat, Profile, Settings)
- `NotificationCenter.tsx` — In-app notification dropdown
- `PhoneInput.tsx` — Phone number input with validation
- `VerificationBadge.tsx` — Tier-based verification badge (Trusted/Verified/Basic) shown on match cards
- `AppFooter.tsx` — Footer for authenticated pages (dashboard, matches, profile) with nav links and copyright
- `ChatBubble.tsx` — Chat message bubble with markdown rendering (react-markdown) for AI messages, plain text for user messages

### Auth Flow
- Signup: Full Name (optional) + Persona selector (Founder/Investor/Talent) + Email + Password (min 8 chars, letter + number required) + Confirm Password + Terms consent
- Persona stored on Profile model at signup time
- Password strength indicator shown during signup
- OAuth: Google + LinkedIn (both optional, shown only when configured via env vars)
- LinkedIn OAuth: `GET /api/auth/linkedin` → LinkedIn authorize → `GET /api/auth/linkedin/callback` → `findOrCreateLinkedInUser` (email-based lookup, auto-verifies email, pulls profile data). LinkedIn login auto-fills: name, avatarUrl (profile picture), headline, currentRole, location (from locale), linkedinUrl (from vanity name or userinfo), linkedinVerified=true, industries (if available from /v2/me). For returning users, only empty fields are filled (never overwrites existing data).
- Backend returns 400 with detailed Zod validation errors (not 500)
- Protected routes redirect unauthenticated users to `/?action=login` with a prompt message
- User model has `name` field (String?, added via db push)

## Frontend Proxy
`apps/frontend/next.config.js` has rewrites proxying `/api/*` → `http://localhost:3001/api/*` so the browser can reach the backend through the Next.js dev server.

## Database
- Schema: 20+ models — User, Profile (with pgvector `profileEmbedding`, `linkedinVerified`, `verificationScore`), Conversation, Message, Match (with `scoreBreakdown` JsonB), MatchFeedback, IntroductionRecord (with introText, outcome, sentAt, followUpAt), DealTracking, Event, EventParticipant, Notification, Call, MessageRecord, UserEmbedding, CommunicationPreference, InviteCode, Activity, Waitlist, DirectMessage (P2P messaging), Meeting (scheduling with ICS support), GoogleCalendarToken (OAuth tokens for Google Calendar per user)
- pgvector extension enabled for semantic similarity search
- Schema pushed via `prisma db push`
- Seed: `npx ts-node packages/db/src/seed.ts` — idempotent, skips existing emails
- Seed data: 1 admin + 20 Indian startup ecosystem profiles (6 Founders, 4 Investors, 3 Talent, 3 Deal Partners, 2 Venture Partners, 2 Event Participants)
- To clean seed data: `npx tsx packages/db/src/clean-seed.ts`

## WhatsApp Bot (Primary Communication Channel)
`apps/backend/src/services/whatsappBotService.ts` — Inbound message router that makes WhatsApp the primary communication channel for all users.

**Architecture:**
- **Conversation router**: Receives inbound text from phone number, looks up user, determines context (onboarding, pending match response, free AI chat), dispatches to correct handler
- **Onboarding via WhatsApp**: Drives `conversation-engine` state machine — choice nodes map number replies (1-N), form nodes collect required fields one at a time using `_wa_form_field_idx_` context key
- **Match responses**: Keyword matching (yes/accept/sure → accept; no/decline/pass → decline) for pending match proposals
- **Free chat**: Falls through to `chatWithCleo` AI service with conversation history
- **Deduplication**: `processedMessageIds` LRU Set prevents duplicate processing
- **Unknown numbers**: Replies with invite link to sign up

**Webhook**: `apps/backend/src/routes/gupshup.ts` — Handles both Meta Cloud API format (`payload.entry`) and legacy Gupshup format (`payload.type === 'message'`). Webhook verifies API key via query param or `x-gupshup-apikey` header.

**Auto-welcome**: All signup methods (email, Google OAuth, LinkedIn OAuth) trigger WhatsApp opt-in + welcome message when phone is present (`authService.ts`, `auth.ts`).

**Admin endpoints**:
- `GET /api/admin/whatsapp/activity` — Stats (opted-in users, inbound/outbound counts, delivery stats, recent messages)
- `GET /api/admin/whatsapp/users` — Per-user WhatsApp status

**Control Tower UI**: "WhatsApp" tab in `/controltower` shows stats cards + scrollable recent message feed with direction/status badges.

## Phase 1: Multi-Persona Onboarding
Six persona types with tailored conversational onboarding flows (warm, one-question-at-a-time, casual tone):
1. **Founder / Business Owner** — warm opening → company basics → deep dive (business + traction) → priority → fundraising details (if raising) → preferences + location → attribution → profile confirmation with narrative summary → CTA
2. **Talent (Join a Startup)** — warm opening → experience + goals → target role choice → preferences (stage/work style/industries/location) → attribution → profile confirmation → CTA
3. **Investor** — warm opening → fund basics → investment thesis (stage/check size/portfolio) → sector preferences + location → attribution → profile confirmation → CTA
4. **The Pitch by Deel (Event)** — company + pitch details → attribution → profile confirmation → CTA
5. **Deal Partner / Scout** — deal sourcing details → attribution → profile confirmation → CTA
6. **Other** — general profile → attribution → profile confirmation → CTA

Onboarding includes: 6-step progress bar with estimated time remaining, step labels, profile confirmation with narrative summary at end, dedicated completion screen with "View your matches" CTA button. Match cards use "warm referral" style — "thought of someone for you" format with personal, specific context.

### Schema additions (Phase 1)
- New PersonaType enums: TALENT, DEAL_PARTNER, VENTURE_PARTNER, EVENT_PARTICIPANT
- New enums: FounderPriority, TalentTargetRole
- New Profile columns: priority, raiseAmount, roundCloseDate, amountRaisedToDate, businessDescription, keyTractionPoints, investorType, investmentAmount, accreditedInvestor, targetRole, fundName, fundSize, investmentRange, industryFocus, investmentThesis, cityBased, exampleInvestment, outreachMethod, trackedCompanies, founderAccessPitch, channelSource, channelType, phoneNumber

## Phase 2: Twilio Communications
- **MessagingService** — Twilio SMS + WhatsApp (graceful skip if no credentials)
- **AutomationService** — Post-onboarding auto-call (30s delay) + WhatsApp welcome + SMS fallback
- **TwiML voice endpoint** — `/api/twilio/voice` with Cleo greeting
- **Admin Communications tab** — recent calls/messages tables, stats, manual trigger (Call/Message) per user
- **MessageRecord model** — SMS/WhatsApp/Email audit trail

## Phase 2b: Gupshup WhatsApp Templates + Opt-in System
- **WhatsApp Template System** (`whatsappTemplates.ts`) — 13 internal templates mapped to 5 Gupshup templates: `cleya_welcome`, `cleya_introduction`, `cleya_meeting_reminder`, `cleya_followup`, `cleya_reengagement`
- **Automatic triggers**: signup→welcome, match proposed→match_found (both users), match accepted→match_accepted (both users), meeting proposed→meeting_scheduled, meeting confirmed→meeting_confirmed (both parties)
- **Opt-in gating**: All WhatsApp messages check `user.whatsappOptedIn` before sending; users opt in via Settings page
- **User schema**: `whatsappOptedIn` (boolean, default false), `whatsappPhone` (string, nullable) on User model
- **Opt-in API**: `POST /api/whatsapp/opt-in` (with phone), `POST /api/whatsapp/opt-out`, `GET /api/whatsapp/status`
- **Frontend**: WhatsApp Notifications section in Settings page with phone input, enable/disable toggle, status indicator
- **Auto opt-in**: Inbound WhatsApp messages (via Gupshup webhook) auto opt-in the user if their phone matches a DB record
- **Admin endpoints**: `GET /api/admin/whatsapp/templates`, `POST /api/admin/whatsapp/send-template`, `POST /api/admin/whatsapp/trigger`, `POST /api/admin/whatsapp/broadcast`, `POST /api/admin/whatsapp/register-templates`, `GET /api/admin/whatsapp/gupshup-templates`
- **Gupshup API key limitation**: Current key is messaging-only; template registration + opt-in management requires partner/portal key from Gupshup dashboard
- **Template delivery**: Uses `gupshupService.sendTemplate()` for Gupshup templates with fallback to plain text; checks `whatsappOptedIn` before sending

## Phase 3: Enhanced Matching Engine + Special Flows + Deal/Event Management

### Enhanced Matching Engine
- **Three-layer scoring**: Rule-based (45%) + Intent alignment (20%) + Semantic similarity (35%)
- **Extended persona compatibility matrix**: All 12 persona types
- **Founder Context Matching** (15% of rule score):
  - **Founder (Fundraising)** → Investors/Deal Partners in same industry + compatible stage + raise/check size alignment
  - **Founder (Co-Founder)** → Talent/Founders with complementary skills + shared industry/interests
  - **Founder (Hiring)** → Talent/Job Seekers with matching target roles + industry + skills
  - **Investor** → Founders in matching industry + compatible stage + investment range fit
  - **Talent/Job Seeker** → Founders hiring for their target role + industry + skills
  - **Deal Partner** → Founders in focus industries + tracked companies overlap + stage compatibility
  - **Venture Partner** → Founders in focus industries + investment range/thesis compatibility
- **Intent alignment scoring**: Maps `lookingFor` values to ideal persona matches
- **Skill relevance scoring**: Both overlap + complementary skill matching

### Special Flows
- **Auto-matching**: Profile completion triggers automatic match finding + proposal (5s delay)
- **Find & Propose**: Single endpoint to find matches and auto-propose top N

### Warm Introduction Lifecycle
Full 8-stage lifecycle implemented:
1. **Match Generated** — auto after onboarding or batch
2. **Match Notification** — both users see on matches page (Connect/Pass buttons)
3. **User Action** — Connect = ACCEPTED, Pass = REJECTED. Double opt-in required.
4. **Double Opt-In → Generate Intro** — AI generates warm intro text (120 words, personal tone). Status = PENDING_APPROVAL. Both users notified to review.
5. **Review & Approve** — Users can preview intro text, edit it, or approve. Approve triggers send. 48h auto-approve via hourly cron.
6. **Introduction Sent** — Status = SENT, sentAt + followUpAt (7 days) set. WhatsApp/SMS sent with contact details.
7. **Follow-Up** — 7 days later, cron sends follow-up asking "how did it go?"
8. **Outcome Recorded** — User picks GREAT_MEETING / GOOD_CHAT / DIDNT_MEET / NOT_A_FIT → Status = COMPLETED

**API endpoints**: `POST /approve`, `PATCH /edit`, `POST /cancel`, `POST /outcome`. Legacy `PATCH /status` locked to safe transitions only.
**Cron jobs**: Hourly auto-approve stale intros (48h+), 6-hourly follow-up sends.
**Race safety**: `approveAndSend` uses atomic `updateMany` with status check to prevent duplicate sends.

### Deal Partner (Scout) Special Flow
- **Auto-scout on onboarding**: When a Deal Partner completes onboarding, automatically finds matching Founders, creates DealTracking records, and proposes matches (5s delay)
- **Manual scout**: `POST /api/deals/scout` — Deal Partners can trigger scouting on demand (persona-gated)
- **Deal pipeline auto-progression**: When a Deal Partner ↔ Founder match is accepted, the deal auto-progresses from OPEN → INTRO_MADE with introSent=true and introDate set
- **DealTracking model**: dealPartnerId, founderId, dealValue (Float), carryPercentage (Float), status (OPEN→INTRO_MADE→CLOSED_WON/CLOSED_LOST), introDate, closeDate, introSent, responseStatus
- **Auto-close date**: Setting status to CLOSED_WON or CLOSED_LOST auto-sets closeDate; INTRO_MADE auto-sets introDate
- **Admin deal management**: Admin can update deal status via dropdown, set deal value and carry percentage
- **Endpoints**: `POST /api/deals/scout`, `GET/POST/PATCH/DELETE /api/deals`, `GET /api/deals/admin/all`
- **Unique constraint**: One deal per (dealPartner, founder) pair

### Venture Partner Special Flow
- **Auto-match on onboarding**: When a VP completes onboarding, automatically finds thesis-matched Founders and proposes matches (5s delay)
- **Investment thesis matching**: Compares VP's `investmentThesis` against Founder's `businessDescription` + headline + bio + industries (keyword overlap scoring, 35% weight)
- **Investment range compatibility**: Parses VP's `investmentRange` (supports "$1M-$5M", "$500K", etc.) and checks if Founder's `raiseAmount` falls within range (20% weight, with partial credit for near-range)
- **Industry focus overlap**: VP's `industryFocus` vs Founder's industries (20% weight)
- **Stage compatibility**: VP's preferred stage vs Founder's current stage (10% weight)
- **Money parser**: Handles K/M/B suffixes and range formats (e.g., "1m-5m", "$500K")

### Event Management & "The Pitch by Deel" Flow
- **Event model**: name, description, date, endDate, location, isVirtual, maxCapacity, organizer, status (UPCOMING/ACTIVE/COMPLETED/CANCELLED)
- **EventParticipant model**: eventId, userId, status (REGISTERED/CONFIRMED/WAITLISTED/CANCELLED/ATTENDED), checkedIn, eventCode, eventName, pitchTopic, preferredMentors (String[]), registeredAt
- **Auto-waitlist**: When event reaches maxCapacity, new registrations get WAITLISTED status
- **Auto-registration**: EVENT_PARTICIPANT persona users are auto-registered for the next upcoming event on onboarding completion (3s delay), with pitchTopic pulled from their businessDescription
- **Pitch fields**: Join endpoint accepts eventCode, eventName, pitchTopic, preferredMentors; admin can update these per participant
- **Time-limited event matching**: `POST /api/events/match-participants` (admin) — matches participants only within the same event, tags Match records with `eventId`; `GET /api/events/:id/my-matches` — user sees their matches within an event
- **Post-event follow-up**: When admin marks event as COMPLETED, a 24h follow-up is auto-scheduled to send each participant their event-scoped match results via WhatsApp/SMS; `POST /api/events/follow-up` for manual trigger; follows up only show matches tagged with the specific eventId
- **Endpoints**: `GET/POST/PATCH/DELETE /api/events`, `POST /api/events/:id/join`, `DELETE /api/events/:id/leave`, `GET /api/events/:id/my-matches`, `POST /api/events/match-participants`, `POST /api/events/follow-up`, `PATCH /api/events/:eventId/participants/:userId`, `GET /api/events/admin/all`

### Admin Dashboard Tabs
1. **Overview** — Key metrics, conversion funnel, users table with call/message triggers
2. **Communications** — Call/message stats and logs
3. **Deals** — Deal pipeline table with status, industry, stage, intro tracking; stats cards
4. **Events** — Event list with participants, status, capacity; create event modal; stats cards
5. **Analytics** — Users by persona, onboarding rate, match stats, feedback distribution, daily signups chart, communications breakdown, recent activity feed, weekly digest trigger

### User-Facing Pages
- **Landing Page** (`/`) — Premium animated design with Framer Motion + Canvas2D animations. Sections: frosted-glass nav, hero (serif headline + floating 3D chat mockup with staggered match cards), testimonial marquee (auto-scrolling), How It Works (3-step TiltCards), Built For Every Side (3 persona columns), featured testimonial blockquote, final CTA with AnimatedOrb, minimal footer. Components: `ParticleNetwork` (Canvas2D particle animation), `AnimatedOrb` (Canvas2D blob), `TiltCard` (3D mouse-tilt), `ScrollProgress` (fixed progress bar), `SmoothScroll` (Lenis smooth scrolling). Colors: #0F172A bg, #1E293B surface, #334155 border, #0D9488 teal primary, #2DD4BF teal accent. Animations respect prefers-reduced-motion. Auth modal has Escape/click-outside dismiss. Non-auth users see landing; auth users auto-redirect to dashboard/admin
- **Dashboard** (`/dashboard`) — Profile summary, match stats, recent match cards with scores + persona + reason, quick actions (View Matches, Find Matches, Edit Profile, Chat)
- **Profile** (`/profile`) — Edit all profile fields per persona type (Founder/Investor/Talent sections), save via PATCH /api/users/profile
- **Chat** (`/chat`) — AI chat with typing indicator, timestamps, smooth scroll, chat history persistence (DB-backed via `ai_chat_freeform` conversation + localStorage fallback, last 50 messages loaded on open, last 20 sent as AI context)
- **Matches** (`/matches`) — Card-based match review with accept/reject, contact reveal, post-response feedback prompt (1-5 star rating + optional text)
- **Settings** (`/settings`) — Account info display, change password, logout, delete account (danger zone)
- **Smart Login Routing**: Admin → `/admin`, completed profiles → `/dashboard`, new users → `/chat`

### Phase 4: Landing Page + UX Polish
- **MatchFeedback model**: id, matchId (unique per user+match), userId, rating (1-5), feedback text, createdAt
- **Backend routes**: `PATCH /api/users/profile`, `POST /api/matches/:id/feedback`
- **Chat persistence**: Conversation ID + messages saved to localStorage, restored on refresh (24h expiry)
- **Match feedback UI**: After accept/reject, modal with star rating + optional text feedback

### Phase 6: Mobile Responsive + AI Chat + Google OAuth
- **Mobile Responsive**: All pages (landing, dashboard, matches, profile, settings, admin, chat) responsive with hamburger nav (MobileNav component), breakpoints at sm/md/lg
- **AI Chat Service**: `apps/backend/src/services/ai.ts` using `@cleya/ai` with gpt-4o-mini, POST /api/ai-chat/message with user context + fallback
- **Dashboard AI Chat Widget**: Floating 💬 FAB → fullscreen (mobile) / 500px panel (desktop), conversation history, typing indicator, quick prompts
- **MobileNav Component**: `apps/frontend/src/components/MobileNav.tsx` — hamburger icon, slide-out drawer, body scroll lock, click-outside-to-close
- **Google OAuth**: Optional (requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env vars). Routes: GET /api/auth/google (redirect to Google), GET /api/auth/google/callback (exchange code → find/create user → redirect with token), GET /api/auth/google/status (check if enabled). Landing page shows "Continue with Google" button when configured. Handles token from redirect URL on landing/dashboard/chat pages.

### Phase 7: Introductions + Search + Error Handling
- **IntroductionRecord model**: matchId (unique), userAId, userBId, status (SENT/VIEWED/RESPONDED/MEETING_SCHEDULED), talkingPoints (String[]), scheduledAt, notes
- **Introduction routes**: GET /api/introductions, GET /api/introductions/:id (auto-marks VIEWED), PATCH /api/introductions/:id/status
- **Introduction pages**: `/introductions` (list), `/introductions/:id` (detail with both user cards, match reason, AI-generated talking points, Google Calendar link, mailto link, status tracking)
- **IntroductionRecord auto-creation**: When match accepted, introductionService creates record with AI-generated talking points (fallback to rule-based)
- **Matches search**: Search bar on matches page filtering by name, persona, industry, company, role, skills across all tabs
- **404 page**: Custom not-found.tsx with dark teal theme, navigation buttons
- **Error boundary**: error.tsx with retry button and dashboard link

## Testing
- **Frontend unit tests:** Vitest + React Testing Library + jsdom. Config: `apps/frontend/vitest.config.ts`. Setup: `apps/frontend/src/__tests__/setup.ts`. Run: `cd apps/frontend && npm test`. Tests in `apps/frontend/src/__tests__/`.
- **Frontend mobile layout E2E tests:** Playwright. Config: `apps/frontend/playwright.config.ts`. Tests in `apps/frontend/e2e/`. Run: `cd apps/frontend && npm run test:e2e:install && npm run test:e2e`. Locks in the Phase 5 mobile audit rules (body font >= 14px, no rendered text < 12px, interactive controls including non-inline anchor links >= 44x44) across the four target viewports (360, 375, 393, 768) for the homepage, signup modal, dashboard, matches, messages and footer. Set `PLAYWRIGHT_BASE_URL` to point at an already-running frontend instead of spawning `next dev`. Set `PLAYWRIGHT_STORAGE_STATE` to a Playwright storage state JSON for a logged-in user to enable the `/dashboard`, `/matches`, and `/messages` checks (otherwise those three are skipped with a clear message). CI: `.github/workflows/mobile-layout.yml` runs the suite on every PR touching the frontend and on pushes to `main`.
- **Covered components:** UserAvatar (image rendering, optimized/unoptimized domains, error fallback to initials, error fallback to icon, all 7 size presets, both shape variants circle/rounded, className passthrough, style passthrough, gradient styling)

## Features (all tested E2E)
1. **Auth** — Sign up, login, JWT auth, Get Me, smart routing, Google OAuth (optional)
2. **Chat Onboarding** — State machine flow with 6 persona types
3. **Profile** — Get/update, completeness scoring, AI embedding generation
4. **Matching** — Three-layer scoring, persona-specific context matching, auto-match, find-and-propose, double opt-in, contact reveal, search/filter
5. **Introductions** — AI-generated intro messages, WhatsApp/SMS delivery, IntroductionRecord with talking points, status tracking, Google Calendar + mailto integration
6. **Notifications** — Multi-channel (IN_APP, EMAIL, SMS, WHATSAPP)
7. **Voice Calls** — Twilio integration, AI voice assistant
8. **Deal Tracking** — Scout/deal partner workflow for sourcing founders
9. **Event Management** — Event CRUD, participant registration, waitlisting, check-in
10. **Admin Dashboard** — 5 tabs: Overview, Communications, Deals, Events, Analytics
11. **Notification Center** — Bell icon in nav bar with unread count badge, dropdown with recent notifications, mark read/mark all read
12. **Settings Page** — Account info, change password, session management, account deletion
13. **Email Service** — Nodemailer (SMTP) for welcome, match proposed, match accepted, weekly digest, password reset, email verification emails (branded HTML templates)
14. **Rate Limiting** — 100/15min general, 5/min auth, 5/min login, 3/15min password reset, 50/hr match proposals (express-rate-limit)
15. **Error Handling** — Custom 404 page, global error boundary with retry
16. **Security Headers** — CSP, HSTS, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy (next.config.js)
17. **SEO** — OG tags (no fake stats), Twitter cards, robots.txt, sitemap.xml (with city/blog pages), SVG favicon, OG image; preconnect/dns-prefetch hints; static asset caching (images, fonts immutable 1yr)
18. **Auth Flows** — Email verification (/verify-email), forgot/reset password (/reset-password), signup consent checkbox
19. **Legal Pages** — Privacy Policy (/privacy) with GDPR, CCPA, Indian DPDPA sections, DPO contact, children's privacy, cookies/tracking, data export rights; Terms of Service (/terms) with India jurisdiction (Bangalore courts), dispute resolution, indemnification clauses
20. **Input Validation** — HTML stripping, LinkedIn URL validation, headline ≤150 chars, bio ≤1000 chars
21. **Skeleton Loaders** — Dashboard and matches pages show animated skeleton UI during data loading
22. **UTM Attribution** — Landing page captures utm_source/utm_medium/utm_campaign/utm_content/utm_term from URL params into localStorage; on signup, utmSource/utmMedium/utmCampaign are saved to User model in DB
23. **Channel Attribution** — Onboarding "How did you hear about us?" with 9 options (LinkedIn, Twitter/X, WhatsApp Group, Friend Referral, Event The Pitch, Angel Network, VC Newsletter, Google Search, Other); stored as channelSource on Profile; breakdown chart in admin analytics
24. **International Phone Input** — Custom PhoneInput component with country flag + dial code dropdown (36 countries, default India +91); integrated in onboarding common_details form, profile edit page, and admin trigger modal
25. **PostHog Analytics** — Optional analytics loaded from CDN (`https://us.i.posthog.com/static/array.js`) via `NEXT_PUBLIC_POSTHOG_KEY` env var; silently skips if not set; tracks signup_completed, onboarding_started, onboarding_completed, match_proposed, match_accepted, match_rejected, profile_updated, page_view; identifies users; resets on logout; CSP allows posthog.com; no npm dependency
26. **Sentry Error Monitoring** — Backend-only via `@sentry/node` + `SENTRY_DSN` env var; init before routes, `Sentry.setupExpressErrorHandler` after routes, `captureException` in error handler with request context; silently skips if not set; frontend has placeholder comment (no @sentry/nextjs to keep bundle light)
27. **GDPR Data Export** — Settings page "Export My Data" buttons (JSON + CSV); backend `GET /api/users/export?format=json|csv` returns all user data (profile, matches, messages, notifications, feedback); satisfies GDPR Article 20 data portability
28. **Health Endpoint** — `GET /health` and `GET /api/health` both return `{ status, timestamp, version, uptime, env }`; documented in DEPLOYMENT.md for UptimeRobot/Better Uptime monitoring
29. **Empty State Improvements** — Dashboard: welcome card with "Set Up Your Profile" CTA for new users; Chat: Cleo avatar + greeting + suggested prompts when no messages; Notifications: styled empty state with descriptive text
30. **Database Backup** — `scripts/backup.sh` runs pg_dump with gzip compression, 7-day retention; documented in DEPLOYMENT.md with restore instructions
31. **Cookie Consent Banner** — `CookieConsent` component in layout; appears after 1.5s on first visit; stores choice in `localStorage` (`cleo_cookie_consent`); "Accept all" or "Essential only" options; links to Privacy Policy; `role="dialog"` with ARIA label; dark theme matching app design
32. **Keyboard Navigation & Accessibility** — Skip-to-content link in layout; global `focus-visible` teal outline on all interactive elements; MobileNav: Escape key closes + returns focus to toggle, focus trap within drawer, `aria-expanded`/`aria-controls`/`aria-modal`/`aria-current="page"`; NotificationCenter: Escape key closes + returns focus, `aria-haspopup`/`aria-expanded`/`aria-label` with unread count, `role="menu"`/`role="list"`, notification items keyboard-operable with Enter/Space; PhoneInput: Escape closes country dropdown, arrow key navigation with visual highlight, `role="listbox"`/`role="option"`/`aria-selected`, `aria-describedby` for validation errors with `role="alert"`; `prefers-reduced-motion` already handled

### Vector-Based AI Matching (pgvector)
- **Hybrid matching pipeline**: pgvector cosine similarity → rule-based + intent scoring → ranked results
- **Embedding management**: Auto-generates on profile update; backfill for existing profiles
- **Database indexes**: IVFFlat cosine, unique constraint for upsert
- **API endpoints**: similar search, text search, embedding stats, backfill

### Hindi Language Support (i18n)
- **Lightweight i18n system**: `apps/frontend/src/lib/i18n/` — React Context-based, no heavy deps
- **Translations**: `translations.ts` with `en` and `hi` locales; keys for nav, hero, how-it-works, stats, footer, match labels, dashboard
- **Language switcher**: `LanguageSwitcher.tsx` in nav (desktop + mobile); persists to `localStorage` (`cleya_locale`); auto-detects browser language
- **Usage**: `useTranslation()` hook returns `{ t, locale, setLocale }`; `t('key')` falls back to English if Hindi key missing
- **Provider**: `I18nContext` in `ClientProviders.tsx`

### Match Explanation Cards (Enhanced)
- **CircularProgress**: SVG circular progress ring with animated stroke-dashoffset
- **ScoreBreakdown**: Expanded card with overall circular progress + per-factor bar charts (Industry Fit, Stage Match, Location, Goal Alignment, Skills Match, Role Fit)
- **VerificationBadge**: Tiered (Trusted/Verified/Basic) with label shown on match cards

### Mobile App Screens (`apps/mobile/app/(tabs)/`)
- `index.tsx` — Dashboard (profile summary, match stats, recent matches)
- `matches.tsx` — Match cards with accept/reject, score breakdown
- `chat.tsx` — AI Chat screen (free-form AI assistant with quick prompts, markdown in bubbles, typing indicator)
- `messages.tsx` — Direct Messaging (conversation list + thread view with polling, read receipts)
- `introductions.tsx` — Introductions list with status badges, detail modal (approve/edit/cancel, outcome recording)
- `profile.tsx` — Full profile editor with persona-specific sections
- `settings.tsx` — Account, notifications, WhatsApp opt-in/out, password change, logout, delete account
- `_layout.tsx` — 7-tab navigation (Dashboard, Matches, AI Chat, Messages, Intros, Profile, Settings)

### Mobile API Client (`apps/mobile/lib/api.ts`)
- Full typed API client with Bearer token auth
- Endpoints: auth, profile, matches, AI chat, DM conversations/messages, introductions (CRUD + approve/edit/cancel/outcome), WhatsApp status/opt-in/opt-out, notifications, settings

## Key Files
- `apps/backend/src/index.ts` — Main Express server (routes: auth, users, conversations, matches, calls, admin, notifications, messaging, twilio, deals, events, ai-chat, introductions)
- `apps/backend/src/routes/introduction.ts` — Introduction CRUD + status tracking
- `apps/backend/src/services/matchingService.ts` — Matching orchestrator
- `apps/backend/src/services/vectorMatchingService.ts` — pgvector similarity + hybrid matching
- `apps/backend/src/services/introductionService.ts` — Post-acceptance intros
- `apps/backend/src/routes/deal.ts` — Deal tracking CRUD + admin endpoint
- `apps/backend/src/routes/event.ts` — Event CRUD + participant management + admin endpoint
- `apps/backend/src/services/email.ts` — Email service (nodemailer, branded HTML templates)
- `apps/backend/src/middleware/rateLimit.ts` — Rate limiting middleware
- `apps/frontend/src/app/admin/page.tsx` — Admin dashboard (5 tabs)
- `apps/frontend/src/app/settings/page.tsx` — Settings page
- `apps/frontend/src/components/NotificationCenter.tsx` — Bell icon notification dropdown
- `apps/frontend/src/components/PhoneInput.tsx` — International phone input with country selector (36 countries, default India)
- `apps/frontend/src/lib/posthog.ts` — PostHog analytics utility (identify, track, reset; no-ops if no key)
- `apps/frontend/src/lib/sentry.ts` — Sentry error capture utility (captureException, setUser; no-ops if no DSN)
- `apps/frontend/src/components/BootstrapClient.tsx` — Client-side PostHog CDN loader + cookie consent banner; uses DOM manipulation only (no next/navigation imports) for SSR/prerender safety
- `apps/frontend/src/lib/api.ts` — API client (relative `/api` path, token as `cleo_token`)
- `apps/frontend/src/lib/i18n/index.ts` — I18n context, hooks, locale detection
- `apps/frontend/src/lib/i18n/translations.ts` — English + Hindi translation strings
- `apps/frontend/src/components/LanguageSwitcher.tsx` — Language toggle button (EN/हिं)
- `packages/matching/src/index.ts` — Enhanced matching engine with sector taxonomy, three-layer scoring (rule 50% / intent 20% / semantic 30%), persona compatibility matrix, sector family similarity, geographic weighting, cold-start penalty, and founder context matching. Industry scoring uses SECTOR_FAMILIES taxonomy (19 families with sub-sectors) and cross-family similarity matrix instead of simple Jaccard overlap.
- `packages/api/src/services/matching.ts` — Shared matching API services (min score threshold: 0.35)
- `packages/db/prisma/schema.prisma` — Full schema (User, Profile, Match, DealTracking, Event, EventParticipant, etc.)
