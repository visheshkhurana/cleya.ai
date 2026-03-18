# Cleo.ai — Deployment Guide

## Prerequisites

- **Node.js** 18+ (LTS recommended)
- **PostgreSQL** 14+ with the `pgvector` extension enabled
- **npm** 9+ (comes with Node.js 18+)

## Quick Start (Development)

```bash
# 1. Clone the repository
git clone <repo-url> && cd boardy-ai

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env — at minimum set DATABASE_URL and JWT_SECRET

# 4. Push the database schema
npx prisma db push --schema=packages/db/prisma/schema.prisma

# 5. Seed the database (optional — creates admin account if ADMIN_EMAIL + ADMIN_PASSWORD are set)
npm run db:seed

# 6. Start the development server
npm run dev
```

The frontend runs on port 5000 and the backend on port 3001.

## Production Deployment

```bash
# 1. Install dependencies
npm install

# 2. Build all packages and apps
npm run build

# 3. Start production servers
npm start
```

### Build Details

The `npm run build` command builds in order:
1. Prisma client generation
2. Shared packages: `types` → `db` → `ai` → `matching` → `conversation-engine` → `api`
3. Backend (TypeScript → JavaScript via `tsc`)
4. Frontend (Next.js production build via `build.js` wrapper)

The frontend build wrapper (`apps/frontend/build.js`) handles known Next.js 14 App Router prerender warnings for `_not-found` and `_error` pages gracefully.

## Environment Variables

Copy `.env.example` to `.env` and configure:

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (e.g., `postgresql://user:pass@host:5432/cleo`) |
| `JWT_SECRET` | Minimum 32 characters. Used for signing JWTs and CSRF tokens |

### Optional — Features degrade gracefully when absent

| Variable | Feature |
|----------|---------|
| `OPENAI_API_KEY` | AI chat — without it, chat returns friendly fallback responses |
| `ADMIN_EMAIL` | Email for auto-seeded admin account (both EMAIL + PASSWORD must be set) |
| `ADMIN_PASSWORD` | Password for the admin account |
| `TWILIO_ACCOUNT_SID` | Outbound calls and SMS |
| `TWILIO_AUTH_TOKEN` | Twilio authentication |
| `TWILIO_PHONE_NUMBER` | Twilio phone number for outbound calls/SMS |
| `SMTP_HOST` | Transactional email — without it, emails are logged to console |
| `SMTP_PORT` | SMTP port (default: 587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `FROM_EMAIL` | Sender address (default: hello@cleo.ai) |
| `GOOGLE_CLIENT_ID` | Google OAuth — without it, the Google login button is hidden |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `SENTRY_DSN` | Sentry error tracking (backend only) |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog analytics (frontend, loaded from CDN) |
| `POSTHOG_KEY` | PostHog analytics (backend) |
| `CORS_ORIGIN` | Allowed CORS origin (defaults to frontend URL) |

## Replit-Specific Notes

- The app is configured as an npm workspace monorepo (`apps/*` + `packages/*`)
- A single workflow (`Start application`) runs `npm run dev` which starts both frontend and backend via `concurrently`
- PostgreSQL is available via the `DATABASE_URL` environment variable (auto-provisioned by Replit)
- Secrets are managed through the Replit Secrets pane — never commit `.env` files
- The frontend uses relative API paths (`/api/*`) so no hardcoded backend URLs are needed
- Publishing uses Replit's built-in deployment which runs `npm run build` then `npm start`
- The preview pane proxies through an iframe, so the dev server is configured with `allowedHosts: true`

## Database

The app uses Prisma ORM with PostgreSQL and the `pgvector` extension for AI-powered matching.

```bash
# Push schema changes (development)
npx prisma db push --schema=packages/db/prisma/schema.prisma

# Generate Prisma client after schema changes
npx prisma generate --schema=packages/db/prisma/schema.prisma

# Seed database
npm run db:seed
```

## Uptime Monitoring

The backend exposes a health endpoint for uptime monitoring:

```
GET /health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-03-18T12:00:00.000Z",
  "version": "1.0.0",
  "uptime": 3600,
  "env": "production"
}
```

Set up [UptimeRobot](https://uptimerobot.com) or [Better Uptime](https://betteruptime.com) to ping `/health` every 5 minutes. Alert on any non-200 response or timeout.

## Backup & Recovery

### Replit PostgreSQL

Replit manages PostgreSQL automatically. For manual backups:

```bash
# Export entire database
pg_dump "$DATABASE_URL" > backup_$(date +%Y%m%d_%H%M%S).sql

# Export specific tables
pg_dump "$DATABASE_URL" -t users -t profiles -t matches > partial_backup.sql

# Compressed backup
pg_dump "$DATABASE_URL" | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore

```bash
# Restore from a backup file
psql "$DATABASE_URL" < backup_20260318_120000.sql

# Restore from compressed backup
gunzip -c backup_20260318.sql.gz | psql "$DATABASE_URL"

# Restore specific tables from a backup
pg_restore --data-only -t users backup_20260318_120000.sql -d "$DATABASE_URL"
```

### Automated Backup Script

A backup script is provided at `scripts/backup.sh`:

```bash
# Run manually
bash scripts/backup.sh

# Set up a cron job (daily at 2 AM)
0 2 * * * cd /path/to/project && bash scripts/backup.sh
```

The script creates timestamped backups in a `backups/` directory and retains the last 7 days.

### GDPR Data Export

Users can export their personal data from the Settings page (Export My Data). The backend endpoint `GET /api/users/export` returns all user data in JSON or CSV format, satisfying GDPR Article 20 data portability requirements.

## Troubleshooting

### Build fails with TypeScript errors
- Ensure all workspace dependencies are installed: `npm install` from the project root
- Build packages in order: `npm run build` handles this automatically
- If a specific package fails, rebuild from that point

### "prerender error" for `_not-found` or `_error` pages
- This is a known Next.js 14 App Router issue and is handled by the `build.js` wrapper
- The build still succeeds — these are non-critical warnings

### Frontend shows blank page
- Check that the workflow is running
- Ensure `allowedHosts` is set to `true` in `next.config.js` (already configured)
- Try a hard refresh in the browser

### API returns 401 Unauthorized
- The app uses JWT authentication stored in a cookie (`cleo_token`)
- CSRF protection is enabled — requests need the `x-csrf-token` header matching the `cleo_csrf` cookie
- Auth routes (`/api/auth/*`) are exempt from CSRF

### Database connection errors
- Verify `DATABASE_URL` is set and the PostgreSQL server is reachable
- For pgvector features, ensure the `vector` extension is enabled: `CREATE EXTENSION IF NOT EXISTS vector`

### Optional services not working
- Each optional service (AI chat, email, Twilio, Google OAuth, Sentry, PostHog) checks for its environment variable at startup
- Missing variables are logged in the startup status table — check the console output
- No optional service causes a crash when unconfigured

### Admin panel access
- Set `ADMIN_EMAIL` and `ADMIN_PASSWORD`, then run `npm run db:seed`
- Log in with those credentials
- Admin routes return 403 for non-admin users
