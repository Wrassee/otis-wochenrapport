import { openDB, type IDBPDatabase } from 'idb'
import type {
  TimeEntry,
  Location,
  Profile,
  ActivityCode,
  FavoriteLocation,
  ExpensePhoto,
} from '@/lib/types'

const DB_NAME = 'otis-rapport-db'
const DB_VERSION = 2

let dbPromise: Promise<IDBPDatabase> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Time entries store
        if (!db.objectStoreNames.contains('time_entries')) {
          const store = db.createObjectStore('time_entries', { keyPath: 'id' })
          store.createIndex('date', 'date', { unique: false })
          store.createIndex('user_date', ['user_id', 'date'], { unique: false })
          store.createIndex('synced', 'synced', { unique: false })
        }

        // Locations cache (elevators)
        if (!db.objectStoreNames.contains('locations')) {
          const store = db.createObjectStore('locations', { keyPath: 'id' })
          store.createIndex('anlagenummer', 'anlagenummer', { unique: true })
        }

        // User profile
        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' })
        }

        // Activity codes
        if (!db.objectStoreNames.contains('activity_codes')) {
          db.createObjectStore('activity_codes', { keyPath: 'id' })
        }

        // Favorite/recent locations
        if (!db.objectStoreNames.contains('favorites')) {
          const store = db.createObjectStore('favorites', { keyPath: 'anlagenummer' })
          store.createIndex('last_used', 'last_used', { unique: false })
        }

        // Pending sync queue
        if (!db.objectStoreNames.contains('sync_queue')) {
          db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true })
        }

        // Expense receipt photos (v2)
        if (!db.objectStoreNames.contains('expense_photos')) {
          const store = db.createObjectStore('expense_photos', { keyPath: 'id' })
          store.createIndex('week', ['year', 'week'], { unique: false })
        }
      },
    })
  }
  return dbPromise
}

// ===================== TIME ENTRIES =====================

export async function getAllEntriesForWeek(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<TimeEntry[]> {
  const db = await getDb()
  const tx = db.transaction('time_entries', 'readonly')
  const store = tx.objectStore('time_entries')
  const index = store.index('user_date')
  const range = IDBKeyRange.bound([userId, startDate], [userId, endDate])
  return index.getAll(range)
}

export async function getEntriesForDate(userId: string, date: string): Promise<TimeEntry[]> {
  const db = await getDb()
  const tx = db.transaction('time_entries', 'readonly')
  const store = tx.objectStore('time_entries')
  const index = store.index('user_date')
  const range = IDBKeyRange.bound([userId, date], [userId, date])
  return index.getAll(range)
}

export async function saveEntry(entry: TimeEntry): Promise<void> {
  const db = await getDb()
  await db.put('time_entries', { ...entry, synced: false })

  // Also add to sync queue
  await db.add('sync_queue', {
    type: 'upsert',
    entryId: entry.id,
    timestamp: Date.now(),
  })
}

export async function saveEntries(entries: TimeEntry[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('time_entries', 'readwrite')
  const syncTx = db.transaction('sync_queue', 'readwrite')

  for (const entry of entries) {
    await tx.store.put({ ...entry, synced: false })
    await syncTx.store.add({
      type: 'upsert',
      entryId: entry.id,
      timestamp: Date.now(),
    })
  }
}

/**
 * Write entries to IndexedDB WITHOUT flipping the `synced` flag or touching
 * the sync queue. Used by the cross-device merge in loadWeekEntries: rows
 * pulled from Supabase are already synced (they must NOT be re-uploaded or
 * re-queued), and locally-unsynced rows keep their flag so the background
 * sync still pushes them.
 */
export async function saveEntriesPreservingSync(entries: TimeEntry[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('time_entries', 'readwrite')
  for (const entry of entries) {
    await tx.store.put(entry)
  }
  await tx.done
}

/**
 * Delete entries locally WITHOUT touching the sync queue. Used by the
 * cross-device merge: a row that is synced here but missing from Supabase was
 * deleted on another device — it must be dropped locally so it can't
 * resurrect, and no delete needs to be queued (the cloud already removed it).
 */
export async function removeEntriesLocally(entryIds: string[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('time_entries', 'readwrite')
  for (const id of entryIds) {
    await tx.store.delete(id)
  }
  await tx.done
}

export async function deleteEntry(entryId: string): Promise<void> {
  const db = await getDb()
  await db.delete('time_entries', entryId)
  await db.add('sync_queue', {
    type: 'delete',
    entryId,
    timestamp: Date.now(),
  })
}

export async function markEntrySynced(entryId: string): Promise<void> {
  const db = await getDb()
  const entry = await db.get('time_entries', entryId)
  if (entry) {
    entry.synced = true
    await db.put('time_entries', entry)
  }
}

// ===================== LOCATIONS =====================

export async function getAllLocations(): Promise<Location[]> {
  const db = await getDb()
  return db.getAll('locations')
}

export async function cacheLocations(locations: Location[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('locations', 'readwrite')
  const syncTx = db.transaction('sync_queue', 'readwrite')
  for (const loc of locations) {
    await tx.store.put(loc)
    // Mark for sync — only if it looks like a manual entry, not bulk-loaded
    // from Supabase on init (those use Server-issued IDs, while manual ones
    // use the 'manual_' prefix, so we check for that).
    if (loc.id?.startsWith('manual_')) {
      await syncTx.store.add({
        type: 'location_upsert',
        entryId: loc.id,
        locationData: loc,
        timestamp: Date.now(),
      })
    }
  }
}

export async function searchLocations(query: string): Promise<Location[]> {
  const db = await getDb()
  const all = await db.getAll('locations')
  const q = query.toLowerCase()
  return all.filter(
    (loc) =>
      loc.anlagenummer.toLowerCase().includes(q) ||
      loc.project_id.toLowerCase().includes(q) ||
      loc.full_address.toLowerCase().includes(q),
  )
}

// ===================== PROFILE =====================

export async function getLocalProfile(): Promise<Profile | undefined> {
  const db = await getDb()
  const all = await db.getAll('profile')
  // The 'profile' object store also holds non-profile payloads (e.g. the daily
  // expenses record saved under the EXPENSES_KEY). Only return a real profile
  // record — relying on all[0] could return the wrong entry depending on key
  // sort order, which made the Settings profile fields appear empty.
  return all.find(
    (p: any) => p && typeof p.full_name === 'string' && typeof p.email === 'string',
  ) as Profile | undefined
}

export async function saveLocalProfile(profile: Profile): Promise<void> {
  const db = await getDb()
  await db.put('profile', profile)
}

// ===================== ZONE MANAGEMENT =====================

/**
 * Update the zone (and optionally manual_zone) for a single location + its favorite counterpart.
 */
export async function updateLocationZone(
  anlagenummer: string,
  zone: number,
  manualZone?: number,
): Promise<void> {
  const db = await getDb()

  // Update in locations store
  const allLocs = await db.getAll('locations')
  const loc = allLocs.find(
    (l: Location) => l.anlagenummer.toUpperCase() === anlagenummer.toUpperCase(),
  )
  if (loc) {
    const updated = { ...loc, zone, manual_zone: manualZone }
    await db.put('locations', updated)

    // Queue sync
    await db.add('sync_queue', {
      type: 'location_upsert',
      entryId: updated.id,
      locationData: updated,
      timestamp: Date.now(),
    })
  }

  // Update in favorites store
  const existing = await db.get('favorites', anlagenummer.toUpperCase())
  if (existing) {
    const updated = {
      ...existing,
      zone,
      manual_zone: manualZone,
      last_used: new Date().toISOString(),
    }
    await db.put('favorites', updated)
  }
}

// ===================== FAVORITES =====================

export async function getFavoriteLocations(): Promise<FavoriteLocation[]> {
  const db = await getDb()
  const all = await db.getAll('favorites')
  return all.sort((a, b) => new Date(b.last_used).getTime() - new Date(a.last_used).getTime())
}

export async function addFavoriteLocation(loc: {
  anlagenummer: string
  project_id: string
  full_address: string
  latitude: number
  longitude: number
  zone: number
  manual_zone?: number
}): Promise<void> {
  const db = await getDb()
  const existing = await db.get('favorites', loc.anlagenummer)
  await db.put('favorites', {
    ...loc,
    last_used: new Date().toISOString(),
    use_count: (existing?.use_count || 0) + 1,
  })
}

/**
 * Write a favorite with explicit values — used by the favorites merge /
 * realtime reload. Unlike addFavoriteLocation this does NOT increment
 * use_count and does not overwrite last_used with the current time, so a
 * remote row can be applied exactly as-is (offline-first safe).
 */
export async function saveFavoriteLocation(fav: {
  anlagenummer: string
  project_id: string
  full_address: string
  latitude: number
  longitude: number
  zone: number
  manual_zone?: number
  use_count: number
  last_used?: string
}): Promise<void> {
  const db = await getDb()
  await db.put('favorites', { ...fav, last_used: fav.last_used || new Date().toISOString() })
}

/**
 * Remove a favorite locally by anlagenummer (case-insensitive) — used by
 * the realtime DELETE handler so a remote delete can't resurrect via the
 * local-preserving merge.
 */
export async function removeFavoriteLocation(anlagenummer: string): Promise<void> {
  const db = await getDb()
  const all = await db.getAll('favorites')
  const target = all.find((f) => f.anlagenummer?.toUpperCase() === anlagenummer.toUpperCase())
  if (target) {
    await db.delete('favorites', target.anlagenummer)
  }
}

// ===================== LOCATION CRUD =====================

/**
 * Delete a location (and its favorite counterpart) by anlagenummer.
 */
export async function deleteLocation(anlagenummer: string): Promise<void> {
  const db = await getDb()
  const key = anlagenummer.toUpperCase()

  // Find and delete from locations store
  const allLocs = await db.getAll('locations')
  const loc = allLocs.find((l: Location) => l.anlagenummer.toUpperCase() === key)
  if (loc) {
    await db.delete('locations', loc.id)
  }

  // Delete from favorites store (keyed by anlagenummer)
  await db.delete('favorites', key)

  // Queue sync — only if the location existed
  await db.add('sync_queue', {
    type: 'location_delete',
    entryId: key, // anlagenummer as the identifier for delete
    locationDeleteAnlagenummer: key,
    timestamp: Date.now(),
  })
}

/**
 * Update project_id and/or full_address for a location + its favorite counterpart.
 */
export async function updateLocationDetails(
  anlagenummer: string,
  updates: { project_id?: string; full_address?: string },
): Promise<void> {
  const db = await getDb()
  const key = anlagenummer.toUpperCase()

  // Update in locations store
  const allLocs = await db.getAll('locations')
  const loc = allLocs.find((l: Location) => l.anlagenummer.toUpperCase() === key)
  if (loc) {
    const updated = {
      ...loc,
      ...(updates.project_id !== undefined && { project_id: updates.project_id }),
      ...(updates.full_address !== undefined && { full_address: updates.full_address }),
    }
    await db.put('locations', updated)

    // Queue sync
    await db.add('sync_queue', {
      type: 'location_upsert',
      entryId: updated.id,
      locationData: updated,
      timestamp: Date.now(),
    })
  }

  // Update in favorites store
  const existing = await db.get('favorites', key)
  if (existing) {
    const updated = {
      ...existing,
      ...(updates.project_id !== undefined && { project_id: updates.project_id }),
      ...(updates.full_address !== undefined && { full_address: updates.full_address }),
      last_used: new Date().toISOString(),
    }
    await db.put('favorites', updated)
  }
}

// ===================== ACTIVITY CODES =====================

export async function cacheActivityCodes(codes: ActivityCode[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('activity_codes', 'readwrite')
  for (const code of codes) {
    await tx.store.put(code)
  }
}

export async function getActivityCodes(): Promise<ActivityCode[]> {
  const db = await getDb()
  return db.getAll('activity_codes')
}

// ===================== SYNC QUEUE =====================

export async function getSyncQueue(): Promise<any[]> {
  const db = await getDb()
  return db.getAll('sync_queue')
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getDb()
  await db.clear('sync_queue')
}

/**
 * Add an arbitrary item to the sync queue.
 * Used by the standalone syncExpenses lib to queue expense-sync operations.
 */
export async function addToSyncQueue(item: {
  type: string
  userId?: string
  entryId?: string
  expenses?: Array<{ date: string; expense_type: string; value: number }>
  locationData?: any
  locationDeleteAnlagenummer?: string
  language?: string
  timestamp: number
}): Promise<void> {
  const db = await getDb()
  await db.add('sync_queue', item)
}

export async function getUnsyncedEntries(userId?: string): Promise<TimeEntry[]> {
  const db = await getDb()
  const all = await db.getAll('time_entries')
  // Filter to the current user: IndexedDB may hold rows from a previous
  // account, and pushing those would fail the RLS check server-side.
  return all.filter((e) => !e.synced && (!userId || e.user_id === userId))
}

// ===================== DAILY EXPENSES =====================

const EXPENSES_KEY = 'daily_expenses'

export async function saveDailyExpenses(expenses: Record<string, any[]>): Promise<void> {
  const db = await getDb()
  await db.put('profile', { id: EXPENSES_KEY, data: expenses })
}

export async function getDailyExpenses(): Promise<Record<string, any[]>> {
  const db = await getDb()
  const entry = await db.get('profile', EXPENSES_KEY)
  return entry?.data || {}
}

export async function getSyncStatus(): Promise<{ pendingSync: number; lastSync: string | null }> {
  const db = await getDb()
  const queue = await db.count('sync_queue')
  const unsynced = await db.count('time_entries')

  // Also get last sync from profile store - we'll store it as a special entry
  return {
    pendingSync: queue + (unsynced > 0 ? 1 : 0),
    lastSync: null,
  }
}

// ===================== EXPENSE PHOTOS =====================

export async function saveExpensePhoto(photo: ExpensePhoto): Promise<void> {
  const db = await getDb()
  await db.put('expense_photos', photo)
}

export async function getExpensePhotos(year: number, week: number): Promise<ExpensePhoto[]> {
  const db = await getDb()
  const all = await db.getAll('expense_photos')
  return all
    .filter((p) => p.year === year && p.week === week)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export async function deleteExpensePhoto(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('expense_photos', id)
}
