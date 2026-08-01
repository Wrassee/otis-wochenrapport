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
// This line is replaced at build time with the precache manifest
// eslint-disable-next-line @typescript-eslint/no-unused-expressions
;(self as unknown as { __WB_MANIFEST: unknown[] }).__WB_MANIFEST

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
