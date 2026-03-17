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
- **Auth:** JWT (bcryptjs password hashing)
- **AI:** OpenAI for embeddings + chat (gpt-4-turbo-preview, text-embedding-3-small)

## Environment Variables (set in Replit Secrets)
- `DATABASE_URL` — runtime-managed by Replit
- `JWT_SECRET` — set
- `AI_PROVIDER` — openai
- `OPENAI_API_KEY` — set
- `NODE_ENV` — development
- `PORT` — 3001

## Running the App
```
npm run dev
```
Starts both frontend (port 5000) and backend (port 3001) concurrently.

## Frontend Proxy
`apps/frontend/next.config.js` has rewrites proxying `/api/*` → `http://localhost:3001/api/*` so the browser can reach the backend through the Next.js dev server.

## Database
- Schema pushed via `prisma db push`
- Seeded with `npx tsx packages/db/src/seed.ts`
- Seed data: admin + 5 sample persona users
- To re-seed: `npx tsx packages/db/src/seed.ts`

## Seed Users
- `admin@cleo.ai` / `admin123456` (ADMIN role)
- `sarah@techstartup.com` / `password123` (FOUNDER, priority=FUNDRAISING)
- `alex@venturefund.com` / `password123` (INVESTOR, investmentAmount=$500K)
- `priya@bigcorp.com` / `password123` (OPERATOR)
- `marcus@advisors.io` / `password123` (ADVISOR)
- `jessica@jobhunt.me` / `password123` (JOB_SEEKER, targetRole=FOUNDING_ENGINEER)

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
  - **Venture Partner** → Founders in focus industries + stage + investment thesis keyword matching
- **Intent alignment scoring**: Maps `lookingFor` values to ideal persona matches
- **Skill relevance scoring**: Both overlap + complementary skill matching

### Special Flows
- **Auto-matching**: Profile completion triggers automatic match finding + proposal (5s delay)
- **Introduction service**: After double opt-in acceptance, sends personalized intro via WhatsApp/SMS
- **Find & Propose**: Single endpoint to find matches and auto-propose top N

### Deal Tracking (Scout / Deal Partner Flow)
- **DealTracking model**: Tracks deals scouted by deal partners linking to founders
- **Fields**: dealPartnerId, founderId, status (SCOUTED→CONTACTED→INTRO_MADE→IN_DILIGENCE→PASSED→CLOSED), industry, stage, notes, introSent, responseStatus
- **Endpoints**: `GET/POST/PATCH/DELETE /api/deals`, `GET /api/deals/admin/all`
- **Unique constraint**: One deal per (dealPartner, founder) pair

### Event Management
- **Event model**: name, description, date, endDate, location, isVirtual, maxCapacity, organizer, status (UPCOMING/ACTIVE/COMPLETED/CANCELLED)
- **EventParticipant model**: eventId, userId, status (REGISTERED/CONFIRMED/WAITLISTED/CANCELLED/ATTENDED), checkedIn
- **Auto-waitlist**: When event reaches maxCapacity, new registrations get WAITLISTED status
- **Endpoints**: `GET/POST/PATCH/DELETE /api/events`, `POST /api/events/:id/join`, `DELETE /api/events/:id/leave`, `PATCH /api/events/:eventId/participants/:userId`, `GET /api/events/admin/all`

### Admin Dashboard Tabs
1. **Overview** — Key metrics, conversion funnel, users table with call/message triggers
2. **Communications** — Call/message stats and logs
3. **Deals** — Deal pipeline table with status, industry, stage, intro tracking; stats cards
4. **Events** — Event list with participants, status, capacity; create event modal; stats cards

### User-Facing Pages
- **Dashboard** (`/dashboard`) — Profile summary, match stats, quick actions
- **Matches** (`/matches`) — Card-based match review with accept/reject, contact reveal
- **Smart Login Routing**: Admin → `/admin`, completed profiles → `/dashboard`, new users → `/chat`

## Features (all tested E2E)
1. **Auth** — Sign up, login, JWT auth, Get Me, smart routing
2. **Chat Onboarding** — State machine flow with 6 persona types
3. **Profile** — Get/update, completeness scoring, AI embedding generation
4. **Matching** — Three-layer scoring, persona-specific context matching, auto-match, find-and-propose, double opt-in, contact reveal
5. **Introductions** — AI-generated intro messages, WhatsApp/SMS delivery
6. **Notifications** — Multi-channel (IN_APP, EMAIL, SMS, WHATSAPP)
7. **Voice Calls** — Twilio integration, AI voice assistant
8. **Deal Tracking** — Scout/deal partner workflow for sourcing founders
9. **Event Management** — Event CRUD, participant registration, waitlisting, check-in
10. **Admin Dashboard** — 4 tabs: Overview, Communications, Deals, Events

### Vector-Based AI Matching (pgvector)
- **Hybrid matching pipeline**: pgvector cosine similarity → rule-based + intent scoring → ranked results
- **Embedding management**: Auto-generates on profile update; backfill for existing profiles
- **Database indexes**: IVFFlat cosine, unique constraint for upsert
- **API endpoints**: similar search, text search, embedding stats, backfill

## Key Files
- `apps/backend/src/index.ts` — Main Express server (routes: auth, users, conversations, matches, calls, admin, notifications, messaging, twilio, deals, events)
- `apps/backend/src/services/matchingService.ts` — Matching orchestrator
- `apps/backend/src/services/vectorMatchingService.ts` — pgvector similarity + hybrid matching
- `apps/backend/src/services/introductionService.ts` — Post-acceptance intros
- `apps/backend/src/routes/deal.ts` — Deal tracking CRUD + admin endpoint
- `apps/backend/src/routes/event.ts` — Event CRUD + participant management + admin endpoint
- `apps/frontend/src/app/admin/page.tsx` — Admin dashboard (4 tabs)
- `apps/frontend/src/lib/api.ts` — API client (relative `/api` path, token as `cleo_token`)
- `packages/matching/src/index.ts` — Enhanced matching engine with persona context matching
- `packages/api/src/services/matching.ts` — Shared matching API services
- `packages/db/prisma/schema.prisma` — Full schema (User, Profile, Match, DealTracking, Event, EventParticipant, etc.)
