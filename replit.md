# Boardy AI Platform

Imported from: https://github.com/visheshkhurana/boardy-ai-platform

## Architecture
Monorepo with:
- `apps/frontend` — Next.js 14 on port 5000
- `apps/backend` — Express + ts-node-dev on port 3001 (WebSocket on 3002)
- `packages/db` — Prisma ORM with PostgreSQL

## Stack
- **Frontend:** Next.js 14, React 18, Tailwind CSS
- **Backend:** Express, TypeScript, WebSocket
- **Database:** PostgreSQL (Replit built-in), Prisma ORM
- **Auth:** JWT

## Environment Variables (set in Replit Secrets)
- `DATABASE_URL` — runtime-managed by Replit
- `JWT_SECRET` — set
- `AI_PROVIDER` — openai
- `NODE_ENV` — development
- `PORT` — 3001
- `FRONTEND_URL` — https://boardy-ai-platform.replit.dev
- `BACKEND_URL` — https://boardy-ai-platform.replit.dev:3001

## Running the App
```
npm run dev
```
Starts both frontend (port 5000) and backend (port 3001) concurrently.

## Database
- Migration applied: `20260317_init`
- Seeded with 6 users (admin + 5 persona types)
- To re-seed: `npm run db:seed`

## Seed Users
- `admin@boardy.ai` / `admin123456`
- `sarah@techstartup.com` (FOUNDER)
- `alex@venturefund.com` (INVESTOR)
- `priya@bigcorp.com` (OPERATOR)
- `marcus@advisors.io` (ADVISOR)
- `jessica@jobhunt.me` (JOB_SEEKER)
