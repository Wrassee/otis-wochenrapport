import { useState, useEffect, useCallback } from 'react'
import type { ExpensePhoto } from '@/lib/types'
import * as localDb from '@/db/indexeddb'
import { fileToPhotoDataUrl } from '@/lib/photoUtils'
import { generateId } from '@/lib/utils'
import { useAppStore } from '@/stores/appStore'

/**
 * Weekly receipt photos (Spesen Belege).
 * Loads photos for the given year/week from IndexedDB, and provides
 * add (File → downscaled data URL → store) and remove actions.
 */
export function useExpensePhotos(year: number, week: number) {
  const user = useAppStore((s) => s.user)
  const [photos, setPhotos] = useState<ExpensePhoto[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    const list = await localDb.getExpensePhotos(year, week)
    setPhotos(list)
    setIsLoading(false)
  }, [year, week])

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
      await localDb.saveExpensePhoto(photo)
      setPhotos((prev) => [photo, ...prev])
      return photo
    },
    [user, year, week]
  )

  const removePhoto = useCallback(async (id: string) => {
    await localDb.deleteExpensePhoto(id)
    setPhotos((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return { photos, isLoading, addPhoto, removePhoto, reload: load }
}
