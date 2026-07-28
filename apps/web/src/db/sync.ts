import { getUnsyncedEntries, markEntrySynced, getSyncQueue, clearSyncQueue } from './indexeddb'
import { syncEntries, deleteEntry as deleteRemoteEntry, upsertLocation, deleteLocationByAnlagenummer, syncExpensesToSupabase } from './supabase'

let syncInterval: ReturnType<typeof setInterval> | null = null
let isSyncing = false

export type SyncListener = (status: { online: boolean; syncing: boolean; pending: number; lastSync: string | null }) => void

const listeners: Set<SyncListener> = new Set()

export function onSyncStatusChange(listener: SyncListener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function notifyListeners(status: { online: boolean; syncing: boolean; pending: number; lastSync: string | null }) {
  listeners.forEach((l) => l(status))
}

/**
 * Start background sync that runs periodically
 */
export function startBackgroundSync(intervalMs = 30000) {
  // Check immediately
  performSync()

  // Set up periodic check
  syncInterval = setInterval(performSync, intervalMs)

  // Also listen for online/offline events
  window.addEventListener('online', performSync)
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
          // Ignore errors for deletes - entry might not exist on server
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
      }
    }

    // Clear sync queue
    await clearSyncQueue()

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
    isSyncing = false
  }
}

/**
 * Force an immediate sync
 */
export async function forceSync() {
  await performSync()
}
