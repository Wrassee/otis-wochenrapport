/// <reference lib="webworker" />

/**
 * OTIS Wochenrapport Service Worker
 *
 * Handles push notification scheduling for the Monday 07:00 weekly reminder.
 * Receives SCHEDULE_NOTIFICATION and CANCEL_NOTIFICATION messages from the app.
 *
 * CRITICAL: self.__WB_MANIFEST is required by vite-plugin-pwa's injectManifest
 * strategy. It gets replaced at build time with the precache manifest array.
 */

declare const self: ServiceWorkerGlobalScope

// InjectManifest injection point — DO NOT REMOVE
// This line is replaced at build time with the precache manifest. Workbox
// matches the COMPILED `self.__WB_MANIFEST` (the TS type assertion is erased
// at build time) and must find it EXACTLY once — so this is the ONLY place
// in the file that touches __WB_MANIFEST; everything else reads WB_MANIFEST.
const WB_MANIFEST: unknown[] = (self as unknown as { __WB_MANIFEST: unknown[] }).__WB_MANIFEST

// ── Offline app shell (precache + cache-first) ─────────────────────────────
// The app's data lives in IndexedDB (offline-first), so the SW only needs to
// serve the SHELL — index.html + the hashed JS/CSS bundles + the Excel
// template — from cache when the network is down. API calls (Supabase, the
// Render backend) are deliberately NEVER cached: the app has its own sync
// layer and would show stale data otherwise.
const SHELL_CACHE = 'otis-shell-v1'

interface ManifestEntry {
  url: string
  revision?: string
}

function manifestUrls(): string[] {
  if (!Array.isArray(WB_MANIFEST)) return []
  return (WB_MANIFEST as (string | ManifestEntry)[]).map((m) => (typeof m === 'string' ? m : m.url))
}

self.addEventListener('install', (event) => {
  const urls = manifestUrls()
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        // The manifest urls are root-relative (e.g. "/assets/index-xxx.js");
        // cache.addAll handles a failed asset gracefully (it rejects the whole
        // install only on 4xx/5xx, which never happens for hashed build files).
        cache.addAll(urls.map((url) => new Request(url, { credentials: 'same-origin' }))),
      )
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  // Navigations (page loads): network-first, fall back to the cached shell
  // when offline — a fresh deploy should win as soon as there is network.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Refresh the cached shell in the background.
          const copy = response.clone()
          caches
            .open(SHELL_CACHE)
            .then((cache) => cache.put('/index.html', copy))
            .catch(() => {})
          return response
        })
        .catch(() => caches.match('/index.html').then((cached) => cached || Response.error())),
    )
    return
  }

  // Same-origin static assets (JS/CSS/icons): cache-first, then network.
  // Match by URL (not by the Request object) — the Cache API's Request-keyed
  // match can miss for browser-originated requests whose mode/destination
  // differ from the stored key, which would fall through to the network and
  // break offline loads.
  if (request.method === 'GET' && url.origin === self.location.origin) {
    event.respondWith(
      caches.match(url.href).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches
              .open(SHELL_CACHE)
              .then((cache) => cache.put(url.href, copy))
              .catch(() => {})
          }
          return response
        })
      }),
    )
    return
  }

  // Everything else (Supabase API, Render backend, …) — network only.
})

// ── Notification Scheduling ─────────────────────────────────────────────────

interface ScheduleConfig {
  days: number[] // 0=Sunday, 1=Monday, ..., 6=Saturday
  hour: number
  minute: number
  title: string
  body: string
  url: string
}

let scheduleConfig: ScheduleConfig | null = null
let checkInterval: ReturnType<typeof setInterval> | null = null
let lastNotifiedDate: string | null = null

/**
 * Start periodic check for scheduled notifications (every 30 seconds).
 * Note: The SW may be terminated by the browser at any time, making this
 * scheduling less reliable than native (Capacitor Local Notifications).
 * For production Android use, prefer the Capacitor path.
 */
function startScheduler(config: ScheduleConfig) {
  scheduleConfig = config
  lastNotifiedDate = null

  if (checkInterval) {
    clearInterval(checkInterval)
  }

  checkInterval = setInterval(() => {
    checkAndNotify()
  }, 30_000)

  // Also check immediately
  checkAndNotify()
}

function stopScheduler() {
  scheduleConfig = null
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
}

function checkAndNotify() {
  if (!scheduleConfig) return

  const now = new Date()
  const today = formatDateString(now)
  const dayOfWeek = now.getDay()
  const hours = now.getHours()
  const minutes = now.getMinutes()

  // Check if today is a scheduled day and time is within window
  const isScheduledDay = scheduleConfig.days.includes(dayOfWeek)
  const targetMinutes = scheduleConfig.hour * 60 + scheduleConfig.minute
  const currentMinutes = hours * 60 + minutes
  const isTimeWindow = currentMinutes >= targetMinutes && currentMinutes < targetMinutes + 5
  const alreadyNotified = lastNotifiedDate === today

  if (isScheduledDay && isTimeWindow && !alreadyNotified) {
    showNotification(scheduleConfig)
    lastNotifiedDate = today
  }
}

function showNotification(config: ScheduleConfig) {
  // Use type assertion for NotificationOptions which supports vibrate/
  // requireInteraction in the spec but TS types may not include them in SW scope
  const options: Record<string, unknown> = {
    body: config.body,
    icon: '/pwa-192x192.png',
    badge: '/favicon.svg',
    tag: 'weekly-rapport',
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      url: config.url,
      date: new Date().toISOString(),
    },
    actions: [
      {
        action: 'open',
        title: 'Rapport senden',
      },
      {
        action: 'dismiss',
        title: 'Später',
      },
    ],
  }
  self.registration.showNotification(config.title, options as NotificationOptions)
}

function formatDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// ── Message Handler ─────────────────────────────────────────────────────────

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const { type, payload } = event.data || {}
  const source = event.source as (WindowProxy & typeof globalThis) | null

  switch (type) {
    case 'SCHEDULE_NOTIFICATION':
      startScheduler(payload as ScheduleConfig)
      source?.postMessage({ type: 'NOTIFICATION_SCHEDULED', success: true }, { targetOrigin: '*' })
      break

    case 'CANCEL_NOTIFICATION':
      stopScheduler()
      source?.postMessage({ type: 'NOTIFICATION_CANCELLED', success: true }, { targetOrigin: '*' })
      break

    case 'STATUS':
      source?.postMessage(
        {
          type: 'NOTIFICATION_STATUS',
          scheduled: !!scheduleConfig,
          config: scheduleConfig,
          lastNotified: lastNotifiedDate,
        },
        { targetOrigin: '*' },
      )
      break
  }
})

// ── Notification Click Handler ──────────────────────────────────────────────

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()

  const data = event.notification.data as { url?: string } | undefined
  const urlToOpen = data?.url || '/export'

  if (event.action === 'dismiss') {
    return
  }

  // Open or focus the app on the export page
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // The app.tsx handles this message to navigate via React Router
          client.postMessage({ type: 'NAVIGATE', url: urlToOpen })
          return client.focus()
        }
      }
      // Open new window
      return self.clients.openWindow(self.location.origin + urlToOpen)
    }),
  )
})
