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
- `sarah@techstartup.com` / `password123` (FOUNDER)
- `alex@venturefund.com` / `password123` (INVESTOR)
- `priya@bigcorp.com` / `password123` (OPERATOR)
- `marcus@advisors.io` / `password123` (ADVISOR)
- `jessica@jobhunt.me` / `password123` (JOB_SEEKER)

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

## Phase 3: Enhanced Matching Engine + Special Flows
### Enhanced Matching Engine
- **Three-layer scoring**: Rule-based (45%) + Intent alignment (20%) + Semantic similarity (35%)
- **Extended persona compatibility matrix**: All 12 persona types (FOUNDER, INVESTOR, TALENT, DEAL_PARTNER, EVENT_PARTICIPANT, VENTURE_PARTNER, ADVISOR, OPERATOR, JOB_SEEKER, RECRUITER, FREELANCER, OTHER)
- **Intent alignment scoring**: Maps `lookingFor` values to ideal persona matches (e.g., fundraising → INVESTOR)
- **Founder priority boost**: FUNDRAISING → INVESTOR/DEAL_PARTNER, HIRING → TALENT/RECRUITER
- **Talent target role boost**: FOUNDING_ENGINEER → FOUNDER, etc.
- **Skill relevance scoring**: Both overlap + complementary skill matching

### Special Flows
- **Auto-matching**: Profile completion triggers automatic match finding + proposal (5s delay)
- **Introduction service**: After double opt-in acceptance, sends personalized intro via WhatsApp/SMS with AI-generated intro text + contact details
- **Find & Propose**: Single endpoint to find matches and auto-propose top N

### User-Facing Pages
- **Dashboard** (`/dashboard`) — Profile summary, match stats (total/pending/accepted), quick actions (view matches, find new, chat), industries/skills display
- **Matches** (`/matches`) — Card-based match review with accept/reject, pending vs accepted tabs, contact reveal on acceptance, AI match reasons, score display
- **Smart Login Routing**: Admin → `/admin`, completed profiles → `/dashboard`, new users → `/chat`
- **Post-onboarding redirect**: Chat completion → dashboard (3s delay)
- **Navigation**: Dashboard ↔ Matches ↔ Chat with sign out

## Features (all tested E2E)
1. **Auth** — Sign up, login, JWT auth, Get Me, smart routing
2. **Chat Onboarding** — State machine flow: welcome → persona select (6 options) → persona-specific forms → common details → attribution → completion → dashboard redirect
3. **Profile** — Get/update profile, completeness scoring, AI embedding generation
4. **Matching** — Enhanced three-layer scoring, intent alignment, persona-specific boosts, auto-match on completion, find-and-propose, double opt-in, contact reveal
5. **Introductions** — AI-generated intro messages, WhatsApp/SMS delivery, in-app notifications
6. **Notifications** — Multi-channel (IN_APP, EMAIL, SMS, WHATSAPP), mark as read
7. **Voice Calls** — Twilio integration, AI voice assistant, transcript extraction
8. **Admin Dashboard** — Stats, user list, conversion funnel, communications tab, manual call/message triggers

### Vector-Based AI Matching (pgvector)
- **VectorMatchingService** (`apps/backend/src/services/vectorMatchingService.ts`) — Uses pgvector's native `<=>` cosine distance operator for efficient similarity search at the database level
- **Hybrid matching pipeline**: Pre-filters candidates via pgvector similarity → combines with rule-based + intent scoring → returns ranked results
- **Text search**: Generate ad-hoc query embeddings and find matching profiles by natural language description
- **Embedding management**: Auto-generates embeddings on profile update; backfill endpoint for existing profiles
- **Database indexes**: `user_embeddings_vector_cosine_idx` (IVFFlat cosine), `user_embeddings_userId_source_uniq` (unique constraint for upsert)
- **API endpoints**:
  - `POST /api/matches/similar` — Find similar users by vector similarity
  - `POST /api/matches/search` — Search users by text query (generates embedding on-the-fly)
  - `GET /api/matches/embeddings/stats` — Embedding coverage statistics
  - `POST /api/matches/embeddings/backfill` — Generate missing embeddings in batch

## Key Files
- `apps/backend/src/index.ts` — Main Express server
- `apps/backend/src/services/matchingService.ts` — Matching orchestrator (find, propose, respond, auto-match, stats)
- `apps/backend/src/services/vectorMatchingService.ts` — pgvector-based similarity search + hybrid matching
- `apps/backend/src/services/introductionService.ts` — Post-acceptance intro messages
- `apps/backend/src/services/automationService.ts` — Post-onboarding automation (call, message, auto-match)
- `apps/backend/src/services/messagingService.ts` — Twilio SMS/WhatsApp
- `apps/backend/src/routes/match.ts` — Match API routes (find, propose, respond, stats, similar, search, embeddings)
- `apps/backend/src/routes/admin.ts` — Admin routes (stats, users, funnel, communications, triggers)
- `apps/frontend/src/app/dashboard/page.tsx` — User dashboard
- `apps/frontend/src/app/matches/page.tsx` — Match review UI
- `apps/frontend/src/app/chat/page.tsx` — Onboarding chat
- `apps/frontend/src/app/admin/page.tsx` — Admin dashboard
- `apps/frontend/src/lib/api.ts` — API client (uses relative `/api` path, token as `cleo_token`)
- `packages/conversation-engine/src/flows/onboarding.ts` — Onboarding flow definition (6 persona types)
- `packages/matching/src/index.ts` — Enhanced matching engine (persona matrix, intent, skills, priorities)
- `packages/db/prisma/schema.prisma` — Full schema with all models
