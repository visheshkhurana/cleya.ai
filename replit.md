# Cleya.ai Platform

Cleya.ai is an AI-powered platform that connects founders, investors, and talent, facilitating warm introductions and managing the full lifecycle of professional relationships.

## Run & Operate

```bash
npm run dev # Starts frontend (5000) and backend (3001) concurrently
npm run build # Builds all packages and frontend for production
npm run start # Runs backend and frontend in production mode
npx ts-node apps/backend/scripts/seed-test-user.ts # Seed test user test@cleya.ai / test1234
npx ts-node apps/backend/scripts/preview-emails.ts # Render email previews to docs/email-previews/
```

**Required Environment Variables:**
- `DATABASE_URL`
- `JWT_SECRET`

**Git Notes:**
- `apps/backend/src/index.ts` might get deleted; restore with `git show d5dd882:apps/backend/src/index.ts > apps/backend/src/index.ts`
- `origin` remote might reset; re-set with `git remote set-url origin "https://x-access-token:$(printenv GITHUB_PAT)@github.com/visheshkhurana/cleya.ai.git"`
- Git identity for commits: `user.email "agent@cleya.ai"`, `user.name "Cleya Agent"`

## Stack

- **Frontend:** Next.js 14, React 18, Tailwind CSS, Framer Motion 11, @react-three/fiber
- **Mobile:** Expo SDK 52 (React Native 0.76), expo-router 4, React Query
- **Backend:** Express, TypeScript, WebSocket
- **Database:** PostgreSQL (Replit built-in), Prisma ORM, pgvector
- **Auth:** JWT (HTTP-only cookie/Bearer token), bcryptjs, Google/LinkedIn OAuth, Clerk integration (optional), TOTP MFA
- **RBAC:** ADMIN > MANAGER > USER > VIEWER (role-based access control)
- **Validation:** Zod schemas
- **AI:** Multi-model LLM routing (OpenAI, Anthropic, Google Gemini)
- **Build Tool:** Turborepo (monorepo setup)

## Where things live

- `apps/frontend/`: Next.js 14 web application
- `apps/backend/`: Express.js API server
- `apps/mobile/`: Expo React Native mobile application
- `packages/db/`: Prisma schema (`prisma/schema.prisma`), database seed scripts
- `packages/ai/`: LLM abstraction and model routing
- `packages/conversation-engine/`: JSON state machine for onboarding
- `packages/api/`: Shared API services (vector matching, embedding generation)
- `packages/matching/`: Core matching engine logic
- `packages/types/`: Shared TypeScript definitions
- **DB Schema:** `packages/db/prisma/schema.prisma`
- **Email Templates:** `apps/backend/src/services/email.ts` methods
- **API Contracts:** Zod schemas in `apps/backend/src/validation.ts`
- **Theme/Design Tokens:** `apps/frontend/tailwind.config.ts`, `apps/frontend/src/app/globals.css`
- **Frontend Routing:** `apps/frontend/src/app/` directory structure
- **Mobile Routing:** `apps/mobile/app/` directory structure

## Architecture decisions

- **Monorepo Structure:** Separates frontend, backend, mobile, and shared packages for clear boundaries and code reuse.
- **Hybrid Matching Engine:** Combines rule-based, intent, and semantic matching for robust and context-aware introductions.
- **Multi-Model LLM Routing:** Dynamically selects the optimal AI model per task/agent based on cost and capability.
- **Persistent Multi-Layer Agent Memory:** Implements working, short-term, long-term, episodic, and semantic memory layers for agents to retain context and learn.
- **Primary WhatsApp Communication:** Leverages WhatsApp as the main communication channel for users, driven by a bot service.
- **Founder Mode & Control Tower:** Provides a dedicated admin interface for founders to manage the platform, review AI decisions, and monitor operations.

## Product

- **AI-Powered Matching:** Connects users based on persona, industry, stage, and intent.
- **Personalized Onboarding:** Conversational onboarding flows tailored to six different user personas.
- **Warm Introductions:** Facilitates double opt-in introductions with AI-generated intro texts.
- **AI Secretary:** An OpenAI-powered assistant for scheduling, follow-ups, and daily digests.
- **Integrated Communication:** Supports in-app chat, WhatsApp, SMS, and email notifications.
- **Autonomous AI Agents:** Seven specialized agents (Nexus, Maven, Ledger, Sentinel, Ally, Catalyst, Closer) automate various business operations.
- **Subscription Paywall:** Implements a freemium model with a paywall for unlimited match access via Razorpay.
- **Admin Control Tower:** A comprehensive dashboard for founders to monitor platform activity, manage agents, and approve AI-generated content.

## User preferences

- Do not change individual user names – must be preserved exactly as entered from LinkedIn or signup.
- I like iterative development.
- I prefer clear and concise code with good documentation.
- I want detailed explanations of complex changes or new features.

## Gotchas

- **Prod DB schema drift:** `prisma db push --accept-data-loss` can wipe data.
- **Email architecture:** `hello@cleya.ai` is FROM address only, not an inbox. Use `env.REPLY_TO_EMAIL` for replies.
- **Auth-protected page testing:** Use `test@cleya.ai` / `test1234`.
- **Layout:** `.glass-header` is 52px tall. Viewport-filling pages need `height: 'calc(100dvh - 52px)'`.
- **Chat pages:** `/chat/PageClient.tsx` and `/secretary/PageClient.tsx` share layout concerns.
- **Webhook secrets:** `RESEND_WEBHOOK_SECRET`, `GUPSHUP_WEBHOOK_SECRET`, `META_WHATSAPP_APP_SECRET` are crucial for verification.
- **`/api/gupshup/test-send` is MANAGER-only.**
- **Empty Dashboard:** New users are redirected to `/matching` post-onboarding to avoid an empty dashboard experience.
- **Frontend build:** Handles Next.js 14 `_not-found` prerender bug and `_buildManifest.js` issues.

## Pointers

- **Prisma Documentation:** [https://www.prisma.io/docs/](https://www.prisma.io/docs/)
- **Next.js Documentation:** [https://nextjs.org/docs](https://nextjs.org/docs)
- **Tailwind CSS Documentation:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Framer Motion Documentation:** [https://www.framer.com/motion/](https://www.framer.com/motion/)
- **Expo Documentation:** [https://docs.expo.dev/](https://docs.expo.dev/)
- **Zod Documentation:** [https://zod.dev/](https://zod.dev/)
- **OpenAI API Documentation:** [https://platform.openai.com/docs/api-reference](https://platform.openai.com/docs/api-reference)
- **Resend Documentation:** [https://resend.com/docs](https://resend.com/docs)
- **Razorpay Documentation:** [https://razorpay.com/docs/](https://razorpay.com/docs/)
- **pgvector Documentation:** [https://github.com/pgvector/pgvector](https://github.com/pgvector/pgvector)
- **Replit Secrets:** _Populate as you build_
- **Security Audit:** `SECURITY_AUDIT_2026-04-20.md`