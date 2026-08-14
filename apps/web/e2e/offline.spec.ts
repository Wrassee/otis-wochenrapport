import { test, expect } from '@playwright/test'
import { forceGerman, loginAsTestUser } from './helpers'

test.describe('Offline PWA', () => {
  test('app shell loads without a network connection', async ({ page, context }) => {
    forceGerman(page)
    await loginAsTestUser(page)

    // Let the service worker install and precache the app shell.
    await page.evaluate(() => navigator.serviceWorker.ready)
    const shellEntries = await page.evaluate(async () => {
      const cache = await caches.open('otis-shell-v1')
      const keys = await cache.keys()
      return keys.map((r) => new URL(r.url).pathname)
    })
    // The shell must contain at least the HTML + a hashed JS bundle.
    expect(shellEntries).toContain('/index.html')
    expect(shellEntries.some((p) => p.startsWith('/assets/index-') && p.endsWith('.js'))).toBe(true)

    // Simulate true offline. context.setOffline(true) cuts the network but —
    // unlike a real browser — it does NOT flip navigator.onLine, so the app
    // would still walk its cloud path and hang on the 8s-timeout calls.
    // Override the property (addInitScript applies on the next navigation)
    // so the app takes its real offline route: skip the cloud, serve
    // IndexedDB, let the SW serve the cached shell.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true })
    })
    await context.setOffline(true)

    // Reload — the SW serves the cached shell, the app boots from IndexedDB,
    // so the signed-in dashboard renders without any network traffic.
    await page.goto('/dashboard', { timeout: 30_000 })
    await expect(page.getByText('Rapport Assistent').first()).toBeVisible({ timeout: 20_000 })
  })
})
