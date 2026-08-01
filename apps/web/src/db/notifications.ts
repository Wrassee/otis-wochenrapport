/**
 * Notification scheduling service for OTIS Wochenrapport.
 *
 * Uses @capacitor/local-notifications for native Android notifications
 * and falls back to Service Worker Notification API for PWA.
 */
import { translations } from '@/lib/translations'
import { useAppStore } from '@/stores/appStore'

type ScheduleResult = { scheduled: boolean; error?: string }

/**
 * Translate a key in the CURRENT app language (notifications.ts is not a
 * React component, so it reads the language directly from the store).
 */
function tr(key: string): string {
  const lang = useAppStore.getState().language
  return translations[key]?.[lang] ?? translations[key]?.de ?? key
}

/** Guard: only re-schedule if last attempt was > 12h ago */
const STORAGE_KEY = 'otis_monday_reminder'
const LAST_SCHEDULED_KEY = 'otis_reminder_last_scheduled'

/**
 * Schedule the Monday 07:00 weekly reminder notification.
 * Tries Capacitor Local Notifications first, falls back to SW.
 */
export async function scheduleMondayReminder(): Promise<ScheduleResult> {
  // Guard: avoid re-scheduling if already done in the last 12 hours
  try {
    const lastScheduled = localStorage.getItem(LAST_SCHEDULED_KEY)
    if (lastScheduled) {
      const elapsed = Date.now() - new Date(lastScheduled).getTime()
      if (elapsed < 12 * 60 * 60 * 1000) {
        return { scheduled: true } // Already scheduled recently
      }
    }
  } catch { /* localStorage unavailable */ }

  // Try Capacitor Local Notifications (native Android)
  if (isCapacitorNative()) {
    return scheduleCapacitorNotification()
  }

  // Fallback: Service Worker Notification
  return scheduleSWNotification()
}

function isCapacitorNative(): boolean {
  try {
    const Cap = (window as any).Capacitor
    return !!(Cap?.isNativePlatform?.() || Cap?.getPlatform?.() === 'android')
  } catch {
    return false
  }
}

/**
 * Schedule via @capacitor/local-notifications (native Android).
 * Capacitor weekday numbering: 1=Sunday, 2=Monday, ..., 7=Saturday
 */
async function scheduleCapacitorNotification(): Promise<ScheduleResult> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    // Request permission
    const permResult = await LocalNotifications.requestPermissions()
    if (permResult.display !== 'granted') {
      return { scheduled: false, error: tr('notification.error.permission') }
    }

    // Cancel any existing weekly reminder (id=1)
    await LocalNotifications.cancel({ notifications: [{ id: 1 }] }).catch(() => {})

    // Schedule weekly on Monday at 07:00
    // weekday: 2 = Monday (Capacitor uses 1=Sunday, 2=Monday, ..., 7=Saturday)
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 1,
          title: tr('notification.title'),
          body: tr('notification.body'),
          schedule: {
            on: {
              weekday: 2, // Monday!
              hour: 7,
              minute: 0,
            },
            every: 'week',
          },
          sound: 'default',
          smallIcon: 'ic_stat_icon',
          largeBody: tr('notification.largeBody'),
          extra: {
            url: '/export',
          },
        },
      ],
    })

    // Persist the scheduled timestamp
    localStorage.setItem(STORAGE_KEY, 'true')
    localStorage.setItem(LAST_SCHEDULED_KEY, new Date().toISOString())

    console.log('[Notifications] Monday 07:00 reminder scheduled (Capacitor)')
    return { scheduled: true }
  } catch (err) {
    console.warn('[Notifications] Capacitor scheduling failed, trying SW fallback:', err)
    return scheduleSWNotification()
  }
}

/**
 * Schedule via Service Worker Notification API (PWA fallback).
 * Note: SW-based scheduling is less reliable than native because the
 * browser may terminate the SW, preventing the setInterval check from running.
 */
async function scheduleSWNotification(): Promise<ScheduleResult> {
  try {
    // Request permission
    if (!('Notification' in window)) {
      return { scheduled: false, error: tr('notification.error.unsupported') }
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { scheduled: false, error: tr('notification.error.denied') }
    }

    // Register with the Service Worker
    const registration = await navigator.serviceWorker.ready

    // Store the schedule config in the SW via postMessage
    registration.active?.postMessage({
      type: 'SCHEDULE_NOTIFICATION',
      payload: {
        days: [1], // Monday (JS convention: 0=Sunday, 1=Monday)
        hour: 7,
        minute: 0,
        title: tr('notification.title'),
        body: tr('notification.body'),
        url: '/export',
      },
    })

    // Persist
    localStorage.setItem(STORAGE_KEY, 'true')
    localStorage.setItem(LAST_SCHEDULED_KEY, new Date().toISOString())

    console.log('[Notifications] Monday 07:00 reminder scheduled (SW)')
    return { scheduled: true }
  } catch (err) {
    console.error('[Notifications] SW scheduling failed:', err)
    return { scheduled: false, error: tr('notification.error.setup') }
  }
}

/**
 * Cancel any scheduled Monday reminder.
 */
export async function cancelMondayReminder(): Promise<void> {
  if (isCapacitorNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.cancel({ notifications: [{ id: 1 }] })
    } catch { /* plugin not available */ }
  }

  // Cancel via SW
  try {
    const registration = await navigator.serviceWorker.ready
    registration.active?.postMessage({ type: 'CANCEL_NOTIFICATION' })
  } catch { /* SW not available */ }

  // Clear stored preference
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(LAST_SCHEDULED_KEY)
}

/**
 * Check if the Monday reminder is currently scheduled.
 */
export async function isReminderScheduled(): Promise<boolean> {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Persist the reminder preference.
 */
export async function setReminderPreference(enabled: boolean): Promise<void> {
  if (enabled) {
    localStorage.setItem(STORAGE_KEY, 'true')
  } else {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LAST_SCHEDULED_KEY)
  }
}
