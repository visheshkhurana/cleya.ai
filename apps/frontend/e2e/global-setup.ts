import { request, type FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Logs in a real seeded test user against the running backend (proxied via
 * the Next.js dev server) and writes the resulting browser state to the path
 * provided in PLAYWRIGHT_STORAGE_STATE.
 *
 * Driven by env vars:
 *   PLAYWRIGHT_STORAGE_STATE - target file path (required to enable login)
 *   TEST_USER_EMAIL          - login email (defaults to seeded persona)
 *   TEST_USER_PASSWORD       - login password (defaults to seeded persona)
 *   PLAYWRIGHT_BASE_URL      - frontend base URL (defaults to localhost:5000)
 *
 * If the target file already exists we trust it and skip the login round-trip
 * (useful when developers prebuild a state file locally). When CI=true we
 * require a successful login so missing auth coverage cannot silently slip
 * through CI.
 */
export default async function globalSetup(config: FullConfig) {
  const storagePath = process.env.PLAYWRIGHT_STORAGE_STATE;
  if (!storagePath) {
    if (process.env.CI) {
      throw new Error(
        'PLAYWRIGHT_STORAGE_STATE must be set in CI so authenticated mobile-layout tests can run against /dashboard, /matches and /messages.',
      );
    }
    return;
  }

  if (fs.existsSync(storagePath)) {
    return;
  }

  const baseURL =
    process.env.PLAYWRIGHT_BASE_URL ??
    config.projects[0]?.use?.baseURL ??
    'http://localhost:5000';
  const email = process.env.TEST_USER_EMAIL ?? 'arjun.mehta@example.com';
  const password = process.env.TEST_USER_PASSWORD ?? 'Cleo2024!seed';

  const ctx = await request.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', {
    data: { email, password },
    headers: { 'content-type': 'application/json' },
  });

  if (!res.ok()) {
    const body = await res.text().catch(() => '<unreadable>');
    throw new Error(
      `Test user login failed (${res.status()} ${res.statusText()}): ${body.slice(0, 500)}`,
    );
  }

  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  await ctx.storageState({ path: storagePath });
  await ctx.dispose();
}
