import { useState, useEffect, useCallback } from 'react'
import type { ExpensePhoto } from '@/lib/types'
import * as localDb from '@/db/indexeddb'
import { upsertExpensePhoto, deleteExpensePhotoFromSupabase } from '@/db/supabase'
import { fileToPhotoDataUrl } from '@/lib/photoUtils'
import {
  loadWeekExpensePhotos,
  markPhotoDeleted,
  clearPhotoDeleted,
} from '@/lib/expensePhotos'
import { generateId } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'

/**
 * Weekly receipt photos (Spesen Belege), synced across devices.
 *
 * - load: merges local IndexedDB with the Supabase cloud copy (remote wins)
 * - add:  saves locally first (offline-first), then best-effort upserts to cloud
 * - remove: deletes locally first, then best-effort deletes from cloud
 */
export function useExpensePhotos(year: number, week: number) {
  const user = useAppStore((s) => s.user)
  const [photos, setPhotos] = useState<ExpensePhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const list = await loadWeekExpensePhotos(user?.id, year, week)
    setPhotos(list)
    setIsLoading(false)
  }, [user?.id, year, week])

  useEffect(() => {
    load()
  }, [load])

  const addPhoto = useCallback(
    async (file: File): Promise<ExpensePhoto | null> => {
      if (!user) return null
      const dataUrl = await fileToPhotoDataUrl(file)
      const photo: ExpensePhoto = {
        id: generateId(),
        user_id: user.id,
        year,
        week,
        filename: `Beleg_KW${week}_${Date.now()}.jpg`,
        dataUrl,
        created_at: new Date().toISOString(),
      }
      // Offline-first: persist locally, then best-effort sync to cloud
      await localDb.saveExpensePhoto(photo)
      setPhotos((prev) => [photo, ...prev])
      if (navigator.onLine) {
        try {
          await upsertExpensePhoto({
            id: photo.id,
            user_id: photo.user_id,
            year: photo.year,
            week: photo.week,
            filename: photo.filename,
            data_url: photo.dataUrl,
            created_at: photo.created_at,
          })
        } catch (err) {
          console.warn('Failed to sync receipt photo to Supabase:', err)
        }
      }
      return photo
    },
    [user, year, week]
  )

  const removePhoto = useCallback(
    async (id: string) => {
      if (!user) return
      // Offline-first: tombstone + local delete, then best-effort cloud delete.
      // The tombstone prevents the photo from resurrecting on the next merge
      // if the cloud delete fails (offline). It is purged once the cloud
      // delete succeeds (see lib/expensePhotos.ts).
      markPhotoDeleted(user.id, id)
      await localDb.deleteExpensePhoto(id)
      setPhotos((prev) => prev.filter((p) => p.id !== id))
      if (navigator.onLine) {
        try {
          await deleteExpensePhotoFromSupabase(id)
          clearPhotoDeleted(user.id, id)
        } catch (err) {
          console.warn('Failed to delete receipt photo from Supabase:', err)
        }
      }
    },
    [user]
  )

  return { photos, isLoading, addPhoto, removePhoto, reload: load }
}
