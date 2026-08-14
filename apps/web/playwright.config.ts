import { defineConfig, devices } from '@playwright/test'

/**
 * E2E tests for the OTIS Wochenrapport app.
 *
 * The tests run against the REAL hosted Supabase project using a dedicated
 * throwaway user (created/removed by e2e/global-setup.ts / global-teardown.ts
 * through the Supabase admin API with the service key). This keeps the app's
 * full stack — auth, data, sync — under test without any mocks.
 *
 * Environment needed (reads apps/web/.env, apps/backend/.env or process env):
 *   SUPABASE_URL, SUPABASE_SERVICE_KEY   (admin API for the test user)
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_RENDER_URL (the app)
 *
 * The frontend runs against the PRODUCTION build (vite preview) on port 5199
 * — never collides with the dev default 5173 — because the production bundle
 * is what actually ships (SW, PWA, code-splitting) and the service worker
 * only exists there. The local backend runs on 8000, so the export flow can
 * use the real /generate-excel endpoint (it falls back to offline otherwise).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  use: {
    baseURL: 'http://localhost:5199',
    acceptDownloads: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'de-DE',
  },
  webServer: [
    {
      command: 'cd ../backend && python -m uvicorn src.main:app --port 8000',
      url: 'http://localhost:8000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run build && npm run preview -- --port 5199 --strictPort',
      url: 'http://localhost:5199',
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
