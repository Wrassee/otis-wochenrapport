import {
  getUnsyncedEntries,
  markEntrySynced,
  getSyncQueue,
  removeSyncQueueItems,
  getAllLocations as getLocalLocations,
} from './indexeddb'
import {
  syncEntries,
  deleteEntry as deleteRemoteEntry,
  upsertLocation,
  getLocationByAnlagenummer,
  deleteLocationByAnlagenummer,
  syncExpensesToSupabase,
  updateProfileLanguage,
  deleteFavorite,
} from './supabase'
import { isValidUuid, uuidFromString } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'

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
 * Remap every entry's `location_id` to a stable cloud UUID before pushing.
 *
 * Local lifts can carry non-UUID ids: manual entries use `manual_…` and
 * favorites picked from "Letzte Anlagen" may use the anlagenummer as id. The
 * cloud `locations.id` column is UUID and `time_entries.location_id` is a
 * foreign key, so sending those ids fails with 22P02 and kills the whole
 * batch. This helper upserts the referenced lift to the cloud under a
 * deterministic UUID (uuidFromString(anlagenummer)) and rewrites the entry's
 * reference to that UUID, so the FK resolves and the same lift links across
 * devices. If the lift can't be found locally, the reference is nulled and the
 * entry still syncs (syncEntries also guards defensively).
 */
async function prepareEntriesForPush(entries: any[]): Promise<any[]> {
  const localLocations = await getLocalLocations()
  // Cache of already-upserted lifts (by anlagenummer → cloud UUID) so a lift
  // referenced by many entries is only upserted once per sync batch.
  const upserted = new Map<string, string>()
  const prepared: any[] = []
  for (const entry of entries) {
    const copy = { ...entry }
    const lid = copy.location_id
    // Manual/typed lifts have location_id = null but carry the anlagenummer on
    // the entry itself — without a cloud link the lift disappears after the
    // round-trip (the pull joins locations by location_id). Link EVERY entry
    // that references a lift, not just the non-UUID ones.
    const nr = copy.location_anlagenummer
      ? String(copy.location_anlagenummer).trim().toUpperCase()
      : ''
    const needsLink = (!lid || !isValidUuid(lid)) && nr
    if (needsLink) {
      // Find the lift by its local id, or by the anlagenummer stored on the
      // entry (manual entries don't always carry a resolvable location_id).
      const loc =
        (lid ? localLocations.find((l) => l.id === lid) : undefined) ||
        localLocations.find((l) => l.anlagenummer.toUpperCase() === nr)
      const key = (loc?.anlagenummer || nr).toUpperCase()
      let cloudId: string | null = upserted.get(key) ?? null
      if (!cloudId) {
        // Only CREATE the cloud row when the lift doesn't exist there yet.
        // Linking an entry may run on a device that lacks the cached location
        // row (loc === undefined) — upserting blindly would overwrite the
        // cloud's full project/address/coordinates with empty placeholders
        // (upsertLocation is merge-safe now, but the row should not be
        // re-created empty in the first place).
        try {
          let newId: string
          const existingCloud = await getLocationByAnlagenummer(key)
          if (existingCloud) {
            newId = existingCloud.id
          } else {
            newId = uuidFromString(key)
            await upsertLocation({
              id: newId,
              anlagenummer: key,
              project_id: loc?.project_id ?? copy.location_project_id ?? '',
              full_address: loc?.full_address ?? copy.location_address ?? '',
              latitude: loc?.latitude ?? 0,
              longitude: loc?.longitude ?? 0,
              zone: loc?.zone ?? copy.location_zone ?? 0,
              manual_zone: loc?.manual_zone,
            })
          }
          cloudId = newId
          upserted.set(key, newId)
        } catch (e) {
          console.warn('Lift upsert failed; entry will sync without lift link:', key, e)
          cloudId = null
        }
      }
      copy.location_id = cloudId
    }
    prepared.push(copy)
  }
  return prepared
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
    // Only the signed-in user's rows are pushed — rows from a previous account
    // in the same IndexedDB would fail the RLS check and abort the batch.
    const userId = useAppStore.getState().user?.id
    const unsyncedEntries = await getUnsyncedEntries(userId)
    const queue = await getSyncQueue()
    if (userId && unsyncedEntries.length > 0) {
      // Manual/offline lifts have non-UUID local ids (manual_…, anlagenummer)
      // but the cloud `locations.id` column is UUID and `time_entries.location_id`
      // is a foreign key — pushing those ids fails with 22P02 and the whole
      // batch dies silently. Remap each such reference to a stable cloud UUID
      // (upserting the lift first) so entries actually reach the cloud.
      const prepared = await prepareEntriesForPush(unsyncedEntries)

      // Sync entries to Supabase (per-row, resilient)
      const synced = await syncEntries(prepared, userId)

      // Mark as synced locally
      for (const entry of synced || []) {
        await markEntrySynced(entry.id)
      }
    }

    // Process queue: delete + location ops. Only items that succeed are
    // removed — a failed item (offline, network hiccup) stays queued so the
    // next sync retries it. A blanket clear would silently drop a failed
    // delete (resurrecting the row on the next merge) or a failed expense /
    // language sync (losing the change). Unhandled 'upsert' no-ops (the synced
    // flag drives entry pushes) count as done so the queue never accumulates.
    const processed: number[] = []
    for (const item of queue) {
      try {
        if (item.type === 'delete') {
          await deleteRemoteEntry(item.entryId)
        } else if (item.type === 'location_upsert' && item.locationData) {
          await upsertLocation(item.locationData)
        } else if (item.type === 'location_delete' && item.locationDeleteAnlagenummer) {
          // Delete BOTH the shared locations row and the user's favorite row
          // independently: the favorite is the half that resurrects the lift in
          // "Meine Lifte"/"Letzte Anlagen" on the next getFavorites() pull, and
          // a failing locations DELETE (e.g. missing RLS policy) must not block
          // the favorite from being removed. If either fails, keep the item
          // queued so both retry on the next sync.
          const ownerId = item.userId || userId
          const results = await Promise.allSettled([
            deleteLocationByAnlagenummer(item.locationDeleteAnlagenummer),
            ownerId ? deleteFavorite(ownerId, item.locationDeleteAnlagenummer) : Promise.resolve(),
          ])
          const failed = results.find((r) => r.status === 'rejected') as
            PromiseRejectedResult | undefined
          if (failed) throw failed.reason
        } else if (item.type === 'expenses_sync' && item.expenses && item.userId) {
          await syncExpensesToSupabase(item.userId, item.expenses, item.dates)
        } else if (item.type === 'language_sync' && item.language && item.userId) {
          await updateProfileLanguage(item.userId, item.language)
        }
        processed.push(item.id)
      } catch (e) {
        console.warn(`Sync failed for queue item ${item.type} (${item.entryId ?? ''}):`, e)
      }
    }

    // Remove the successfully processed items; failed ones stay queued for retry.
    await removeSyncQueueItems(processed)

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
