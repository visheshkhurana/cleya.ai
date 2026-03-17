# Cleo.ai Platform

Imported from: https://github.com/visheshkhurana/boardy-ai-platform

## Architecture
Monorepo with:
- `apps/frontend` — Next.js 14 on port 5000
- `apps/backend` — Express + ts-node-dev on port 3001 (WebSocket on 3002)
- `packages/db` — Prisma ORM with PostgreSQL + pgvector
- `packages/ai` — LLM abstraction (OpenAI/Anthropic)
- `packages/conversation-engine` — JSON state machine for onboarding flows
- `packages/matching` — Rule-based + semantic matching engine
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
- Seeded with 11 users (admin + 5 persona types + test users)
- Demo data includes: notifications, conversations, matches, calls
- To re-seed: `npm run db:seed`

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

## Features (all tested E2E)
1. **Auth** — Sign up, login, JWT auth, Get Me
2. **Chat Onboarding** — State machine flow: welcome → persona select (6 options) → persona-specific forms → common details → attribution → completion
3. **Profile** — Get/update profile, completeness scoring, AI embedding generation
4. **Matching** — Rule-based scoring (persona compatibility, industry/interest overlap, location) + semantic similarity, find matches, propose match, double opt-in accept/reject
5. **Notifications** — Multi-channel (IN_APP, EMAIL, SMS, WHATSAPP), mark as read
6. **Voice Calls** — Twilio integration, AI voice assistant, transcript extraction
7. **Admin Dashboard** — Stats, user list, conversion funnel, match analytics, call logs

## Key Files
- `apps/backend/src/index.ts` — Main Express server (reconstructed, not in original repo)
- `apps/backend/src/middleware/auth.ts` — JWT auth + admin role check (case-insensitive)
- `apps/frontend/src/lib/api.ts` — API client (uses relative `/api` path)
- `packages/conversation-engine/src/flows/onboarding.ts` — Onboarding flow definition (6 persona types)
- `packages/matching/src/index.ts` — Matching engine with persona compatibility matrix
- `packages/db/prisma/schema.prisma` — Full schema with Phase 1 persona fields
