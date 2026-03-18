# Cleo.ai Platform

Imported from: https://github.com/visheshkhurana/boardy-ai-platform

## Architecture
Monorepo with:
- `apps/frontend` — Next.js 14 on port 5000
- `apps/backend` — Express + ts-node-dev on port 3001 (WebSocket on 3002)
- `packages/db` — Prisma ORM with PostgreSQL + pgvector
- `packages/ai` — LLM abstraction (OpenAI/Anthropic)
- `packages/conversation-engine` — JSON state machine for onboarding flows
- `packages/api` — Shared API services: vector matching, embedding generation (pgvector)
- `packages/matching` — Rule-based + intent + semantic matching engine
- `packages/types` — Shared TypeScript types

## Stack
- **Frontend:** Next.js 14, React 18, Tailwind CSS (dark purple theme)
- **Backend:** Express, TypeScript, WebSocket
- **Database:** PostgreSQL (Replit built-in), Prisma ORM, pgvector
- **Auth:** JWT (bcryptjs password hashing), CSRF double-submit cookie protection, email verification on signup
- **Validation:** Zod schemas on all state-changing endpoints (profile, password, match, introduction)
- **AI:** OpenAI for embeddings + chat (gpt-4-turbo-preview, text-embedding-3-small)

## Environment Variables (see .env.example for full list)
**Required:** `DATABASE_URL`, `JWT_SECRET` (min 32 chars; startup throws if missing)
**Optional (graceful fallback):** `OPENAI_API_KEY` (AI chat → fallback responses), `TWILIO_*` (calls/SMS disabled), `SMTP_*` (emails logged only), `GOOGLE_CLIENT_*` (Google login hidden), `SENTRY_DSN` (no error tracking), `POSTHOG_KEY` (no analytics)
**Admin seed:** `ADMIN_EMAIL` + `ADMIN_PASSWORD` — both must be set to create admin; no defaults in code
**CORS:** `CORS_ORIGIN` env var → defaults to `FRONTEND_URL`; locked to single origin (not wildcard)

## Running the App
```
npm run dev
```
Starts both frontend (port 5000) and backend (port 3001) concurrently.

## Building for Production
```
npm run build
```
Builds in dependency order: prisma generate → types → db → ai → matching → conversation-engine → api → backend (tsc) → frontend (next build). All packages compile TypeScript to `dist/` with `main` pointing to `./dist/index.js`. Frontend build script (`build.js`) handles the Next.js `_not-found` prerender issue and generates `prerender-manifest.json` if needed.

## Production Start
```
npm run start
```
Runs backend (`node dist/index.js` on port 3001) and frontend (`next start` on port 5000) concurrently.

## Page Architecture
All frontend pages use a server/client wrapper pattern for build compatibility:
- `page.tsx` — server component that exports `dynamic = 'force-dynamic'` and re-exports the client component
- `PageClient.tsx` — the actual `'use client'` component with hooks, state, and UI

## Frontend Proxy
`apps/frontend/next.config.js` has rewrites proxying `/api/*` → `http://localhost:3001/api/*` so the browser can reach the backend through the Next.js dev server.

## Database
- Schema pushed via `prisma db push`
- Seeded with `npx tsx packages/db/src/seed.ts`
- Seed data: admin + 5 sample persona users
- To re-seed: `npx tsx packages/db/src/seed.ts`

## Seed Users
- `admin@cleo.ai` / `admin123456` (ADMIN role)
- Sample/test users have been removed from production. The backend auto-seed only creates the admin user on empty databases.
- To clean seed data: `npx tsx packages/db/src/clean-seed.ts`

## Phase 1: Multi-Persona Onboarding
Six persona types with tailored onboarding flows:
1. **Founder / Business Owner** — company details, priority (fundraising/cofounder/hiring/marketing/sales/VP hire), fundraising fields
2. **Talent (Join a Startup)** — experience, target role (founding engineer/GTM/CoS/growth/open/cofounder)
3. **Investor** — fund details, investor type, check size, stage preferences
4. **The Pitch by Deel (Event)** — company pitch details for event participation
5. **Deal Partner / Scout** — deal sourcing, city, tracked companies, founder access pitch
6. **Other** — general profile

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
- **Introduction service**: After double opt-in acceptance, sends personalized intro via WhatsApp/SMS
- **Find & Propose**: Single endpoint to find matches and auto-propose top N

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
- **Landing Page** (`/`) — Redesigned "Precision Intelligence" aesthetic. Sections: frosted-glass nav, hero (Playfair Display serif headline + phone chat mockup with staggered match cards), metrics bar (count-up animation), testimonial ticker (marquee), How It Works (3-step cards), Who It's For (3 persona columns), featured match story (blockquote), final CTA, minimal footer. Fonts: Playfair Display (hero/quotes) + DM Sans (body). Colors: #0B0918 bg, #6D28D9 violet accent, #A09FB5 muted text. Animations respect prefers-reduced-motion. Auth modal has Escape/click-outside dismiss. Non-auth users see landing; auth users auto-redirect to dashboard/admin
- **Dashboard** (`/dashboard`) — Profile summary, match stats, recent match cards with scores + persona + reason, quick actions (View Matches, Find Matches, Edit Profile, Chat)
- **Profile** (`/profile`) — Edit all profile fields per persona type (Founder/Investor/Talent sections), save via PATCH /api/users/profile
- **Chat** (`/chat`) — AI chat with typing indicator, timestamps, smooth scroll, chat history persistence (localStorage, survives refresh, 24h expiry)
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
- **AI Chat Service**: `apps/backend/src/services/ai.ts` using `@boardy/ai` with gpt-4o-mini, POST /api/ai-chat/message with user context + fallback
- **Dashboard AI Chat Widget**: Floating 💬 FAB → fullscreen (mobile) / 500px panel (desktop), conversation history, typing indicator, quick prompts
- **MobileNav Component**: `apps/frontend/src/components/MobileNav.tsx` — hamburger icon, slide-out drawer, body scroll lock, click-outside-to-close
- **Google OAuth**: Optional (requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET env vars). Routes: GET /api/auth/google (redirect to Google), GET /api/auth/google/callback (exchange code → find/create user → redirect with token), GET /api/auth/google/status (check if enabled). Landing page shows "Continue with Google" button when configured. Handles token from redirect URL on landing/dashboard/chat pages.

### Phase 7: Introductions + Search + Error Handling
- **IntroductionRecord model**: matchId (unique), userAId, userBId, status (SENT/VIEWED/RESPONDED/MEETING_SCHEDULED), talkingPoints (String[]), scheduledAt, notes
- **Introduction routes**: GET /api/introductions, GET /api/introductions/:id (auto-marks VIEWED), PATCH /api/introductions/:id/status
- **Introduction pages**: `/introductions` (list), `/introductions/:id` (detail with both user cards, match reason, AI-generated talking points, Google Calendar link, mailto link, status tracking)
- **IntroductionRecord auto-creation**: When match accepted, introductionService creates record with AI-generated talking points (fallback to rule-based)
- **Matches search**: Search bar on matches page filtering by name, persona, industry, company, role, skills across all tabs
- **404 page**: Custom not-found.tsx with dark purple theme, navigation buttons
- **Error boundary**: error.tsx with retry button and dashboard link

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
17. **SEO** — OG tags, Twitter cards, robots.txt, sitemap.xml, SVG favicon, OG image
18. **Auth Flows** — Email verification (/verify-email), forgot/reset password (/reset-password), signup consent checkbox
19. **Legal Pages** — Privacy Policy (/privacy), Terms of Service (/terms)
20. **Input Validation** — HTML stripping, LinkedIn URL validation, headline ≤150 chars, bio ≤1000 chars
21. **Skeleton Loaders** — Dashboard and matches pages show animated skeleton UI during data loading

### Vector-Based AI Matching (pgvector)
- **Hybrid matching pipeline**: pgvector cosine similarity → rule-based + intent scoring → ranked results
- **Embedding management**: Auto-generates on profile update; backfill for existing profiles
- **Database indexes**: IVFFlat cosine, unique constraint for upsert
- **API endpoints**: similar search, text search, embedding stats, backfill

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
- `apps/frontend/src/lib/api.ts` — API client (relative `/api` path, token as `cleo_token`)
- `packages/matching/src/index.ts` — Enhanced matching engine with persona context matching
- `packages/api/src/services/matching.ts` — Shared matching API services
- `packages/db/prisma/schema.prisma` — Full schema (User, Profile, Match, DealTracking, Event, EventParticipant, etc.)
