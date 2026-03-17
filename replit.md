# Boardy AI Platform

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
- `FRONTEND_URL` — https://boardy-ai-platform.replit.dev
- `BACKEND_URL` — https://boardy-ai-platform.replit.dev:3001

## Running the App
```
npm run dev
```
Starts both frontend (port 5000) and backend (port 3001) concurrently.

## Frontend Proxy
`apps/frontend/next.config.js` has rewrites proxying `/api/*` → `http://localhost:3001/api/*` so the browser can reach the backend through the Next.js dev server.

## Database
- Migration applied: `20260317_init`
- Seeded with 11 users (admin + 5 persona types + test users)
- Demo data includes: notifications, conversations, matches, calls
- To re-seed: `npm run db:seed`

## Seed Users
- `admin@boardy.ai` / `admin123456` (ADMIN role)
- `sarah@techstartup.com` / `password123` (FOUNDER)
- `alex@venturefund.com` / `password123` (INVESTOR)
- `priya@bigcorp.com` / `password123` (OPERATOR)
- `marcus@advisors.io` / `password123` (ADVISOR)
- `jessica@jobhunt.me` / `password123` (JOB_SEEKER)

## Features (all tested E2E)
1. **Auth** — Sign up, login, JWT auth, Get Me
2. **Chat Onboarding** — State machine flow: welcome → persona select → persona-specific form → common details → voice offer → completion
3. **Profile** — Get/update profile, completeness scoring, AI embedding generation
4. **Matching** — Rule-based scoring (persona compatibility, industry/interest overlap, location) + semantic similarity, find matches, propose match, double opt-in accept/reject
5. **Notifications** — Multi-channel (IN_APP, EMAIL, SMS, WHATSAPP), mark as read
6. **Voice Calls** — Twilio integration, AI voice assistant, transcript extraction
7. **Admin Dashboard** — Stats, user list, conversion funnel, match analytics, call logs

## Key Files
- `apps/backend/src/index.ts` — Main Express server (reconstructed, not in original repo)
- `apps/backend/src/middleware/auth.ts` — JWT auth + admin role check (case-insensitive)
- `apps/frontend/src/lib/api.ts` — API client (uses relative `/api` path)
- `packages/conversation-engine/src/flows/onboarding.ts` — Onboarding flow definition
- `packages/matching/src/index.ts` — Matching engine with persona compatibility matrix
