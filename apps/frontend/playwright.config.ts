import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 5000);
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

const STORAGE_STATE_PATH =
  process.env.PLAYWRIGHT_STORAGE_STATE ??
  (process.env.CI ? path.resolve(__dirname, 'e2e/.auth/state.json') : undefined);

if (STORAGE_STATE_PATH && !process.env.PLAYWRIGHT_STORAGE_STATE) {
  process.env.PLAYWRIGHT_STORAGE_STATE = STORAGE_STATE_PATH;
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  globalSetup: require.resolve('./e2e/global-setup'),
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'off',
    ...devices['Desktop Chrome'],
    ...(STORAGE_STATE_PATH ? { storageState: STORAGE_STATE_PATH } : {}),
  },
  projects: [
    {
      name: 'mobile-layout',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: { PORT: String(PORT) },
      },
});
