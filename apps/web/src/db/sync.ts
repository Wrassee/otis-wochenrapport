import { getUnsyncedEntries, markEntrySynced, getSyncQueue, clearSyncQueue } from './indexeddb'
import {
  syncEntries,
  deleteEntry as deleteRemoteEntry,
  upsertLocation,
  deleteLocationByAnlagenummer,
  syncExpensesToSupabase,
  updateProfileLanguage,
} from './supabase'

let syncInterval: ReturnType<typeof setInterval> | null = null
let isSyncing = false

export type SyncListener = (status: {
  online: boolean
  syncing: boolean
  pending: number
  lastSync: string | null
}) => void

const listeners: Set<SyncListener> = new Set()

export function onSyncStatusChange(listener: SyncListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners(status: {
  online: boolean
  syncing: boolean
  pending: number
  lastSync: string | null
}) {
  listeners.forEach((l) => l(status))
}

/**
 * Start background sync that runs periodically.
 *
 * @param intervalMs   Sync interval in ms (default 30 s)
 * @param onAfterSync  Optional callback fired after EACH sync completes
 *                     (success or failure) — lets the caller pull fresh
 *                     cloud data (e.g. the current week) so entries recorded
 *                     on another device appear without a manual reload.
 */
export function startBackgroundSync(intervalMs = 30000, onAfterSync?: () => void) {
  const runSync = async () => {
    await performSync()
    onAfterSync?.()
  }

  // Check immediately
  runSync()

  // Set up periodic check
  syncInterval = setInterval(runSync, intervalMs)

  // Also listen for online/offline events
  window.addEventListener('online', runSync)
  window.addEventListener('offline', () => {
    notifyListeners({
      online: false,
      syncing: false,
      pending: 0,
      lastSync: null,
    })
  })
}

/**
 * Stop background sync
 */
export function stopBackgroundSync() {
  if (syncInterval) {
    clearInterval(syncInterval)
    syncInterval = null
  }
}

/**
 * Perform the actual sync operation
 */
export async function performSync() {
  if (isSyncing) return
  if (!navigator.onLine) {
    notifyListeners({
      online: false,
      syncing: false,
      pending: 0,
      lastSync: null,
    })
    return
  }

  isSyncing = true
  notifyListeners({
    online: true,
    syncing: true,
    pending: 0,
    lastSync: null,
  })

  // Timeout guard: if sync takes longer than 25s, force-reset isSyncing
  const timeoutId = setTimeout(() => {
    isSyncing = false
    notifyListeners({
      online: navigator.onLine,
      syncing: false,
      pending: 0,
      lastSync: null,
    })
  }, 25000)

  try {
    const unsyncedEntries = await getUnsyncedEntries()
    const queue = await getSyncQueue()
    if (unsyncedEntries.length > 0) {
      // Sync entries to Supabase
      const synced = await syncEntries(unsyncedEntries)

      // Mark as synced locally
      for (const entry of synced || []) {
        await markEntrySynced(entry.id)
      }
    }

    // Process queue: delete + location ops
    for (const item of queue) {
      if (item.type === 'delete') {
        try {
          await deleteRemoteEntry(item.entryId)
        } catch (e) {
          console.warn('Delete sync failed for', item.entryId, e)
        }
      } else if (item.type === 'location_upsert' && item.locationData) {
        try {
          await upsertLocation(item.locationData)
        } catch (e) {
          console.warn('Location upsert sync failed for', item.locationData?.anlagenummer, e)
        }
      } else if (item.type === 'location_delete' && item.locationDeleteAnlagenummer) {
        try {
          await deleteLocationByAnlagenummer(item.locationDeleteAnlagenummer)
        } catch (e) {
          console.warn('Location delete sync failed for', item.locationDeleteAnlagenummer, e)
        }
      } else if (item.type === 'expenses_sync' && item.expenses && item.userId) {
        try {
          await syncExpensesToSupabase(item.userId, item.expenses)
        } catch (e) {
          console.warn('Expenses sync to Supabase failed:', e)
        }
      } else if (item.type === 'language_sync' && item.language && item.userId) {
        try {
          await updateProfileLanguage(item.userId, item.language)
        } catch (e) {
          console.warn('Language sync to Supabase failed:', e)
        }
      }
    }

    // Clear sync queue
    await clearSyncQueue()

    clearTimeout(timeoutId)
    const now = new Date().toISOString()
    notifyListeners({
      online: true,
      syncing: false,
      pending: 0,
      lastSync: now,
    })
  } catch (error) {
    console.error('Sync failed:', error)
    notifyListeners({
      online: true,
      syncing: false,
      pending: 0,
      lastSync: null,
    })
  } finally {
    clearTimeout(timeoutId)
    isSyncing = false
  }
}

/**
 * Force an immediate sync
 */
export async function forceSync() {
  await performSync()
}
