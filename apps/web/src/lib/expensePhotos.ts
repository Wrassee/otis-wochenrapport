import type { ExpensePhoto } from '@/lib/types'
import * as localDb from '@/db/indexeddb'
import {
  getExpensePhotosFromSupabase,
  deleteExpensePhotoFromSupabase,
} from '@/db/supabase'

/**
 * Deletion tombstones.
 *
 * When a photo is deleted while offline, the cloud copy would otherwise
 * resurrect it on the next merge. We keep a small per-user set of deleted
 * photo IDs in localStorage; on the next online load the tombstones are
 * purged from the cloud (best-effort) and the merge hides them until then.
 */
const DELETED_KEY = (userId: string) => `otis_deleted_photos_${userId}`

export function getDeletedPhotoIds(userId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(DELETED_KEY(userId)) || '[]') as string[]
  } catch {
    return []
  }
}

export function markPhotoDeleted(userId: string, id: string) {
  try {
    const ids = new Set(getDeletedPhotoIds(userId))
    ids.add(id)
    localStorage.setItem(DELETED_KEY(userId), JSON.stringify([...ids]))
  } catch {
    /* localStorage unavailable — tombstone is best-effort */
  }
}

export function clearPhotoDeleted(userId: string, id: string) {
  try {
    const ids = getDeletedPhotoIds(userId).filter((x) => x !== id)
    localStorage.setItem(DELETED_KEY(userId), JSON.stringify(ids))
  } catch {
    /* ignore */
  }
}

/**
 * Load the week's receipt photos (Spesen Belege) merging the local IndexedDB
 * copy with the Supabase cloud copy — remote wins per photo, local-only photos
 * are preserved, offline-deleted photos are purged, and the merged list is
 * written back locally so the next offline start sees everything.
 *
 * No store / React dependency. Falls back to local-only when offline or when
 * the cloud fetch fails.
 */
export async function loadWeekExpensePhotos(
  userId: string | undefined,
  year: number,
  week: number
): Promise<ExpensePhoto[]> {
  const local = await localDb.getExpensePhotos(year, week)

  if (!userId || !navigator.onLine) {
    return local
  }

  try {
    // Purge cloud copies of photos that were deleted offline (best-effort).
    const tombstoned = getDeletedPhotoIds(userId)
    if (tombstoned.length > 0) {
      await Promise.allSettled(
        tombstoned.map((id) =>
          deleteExpensePhotoFromSupabase(id).then(() => clearPhotoDeleted(userId, id))
        )
      )
    }

    const remote = await getExpensePhotosFromSupabase(userId, year, week)
    if (remote.length === 0) {
      return local
    }

    // Merge by id — remote wins, local-only preserved.
    const byId = new Map<string, ExpensePhoto>()
    for (const p of local) byId.set(p.id, p)
    for (const r of remote) {
      byId.set(r.id, {
        id: r.id,
        user_id: r.user_id || userId,
        year: r.year ?? year,
        week: r.week ?? week,
        filename: r.filename || `Beleg_${week}.jpg`,
        dataUrl: r.data_url || '',
        note: r.note || undefined,
        created_at: r.created_at || new Date().toISOString(),
      })
    }

    // Hide anything still tombstoned (e.g. a purge that failed mid-flight).
    const tombstone = new Set(getDeletedPhotoIds(userId))
    const merged = [...byId.values()]
      .filter((p) => !tombstone.has(p.id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))

    // Persist merged set back to IndexedDB for offline-first reads.
    for (const p of merged) {
      await localDb.saveExpensePhoto(p)
    }
    return merged
  } catch (err) {
    console.warn('Failed to sync receipt photos from Supabase:', err)
    return local
  }
}
