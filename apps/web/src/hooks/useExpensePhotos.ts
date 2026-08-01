import { useState, useEffect, useCallback } from 'react'
import type { ExpensePhoto } from '@/lib/types'
import { useAppStore } from '@/stores/appStore'
import { getWeekKey } from '@/lib/utils'

/**
 * Weekly receipt photos (Spesen Belege) — thin store wrapper.
 *
 * Three-layer pattern (see ARCHITECTURE.md):
 *   Layer 1: lib/expensePhotos.ts      — pure merge/sync logic
 *   Layer 2: hooks/useExpensePhotos.ts — this hook, reads + mutates the store
 *   Layer 3: stores/appStore.ts        — state + actions (load/add/update/remove)
 *
 * The store keeps photos keyed by `${year}-${week}`, so Dashboard and Woche
 * can read the same data as the Spesen page without re-fetching.
 */
export function useExpensePhotos(year: number, week: number) {
  const user = useAppStore((s) => s.user)
  const photos = useAppStore((s) => s.expensePhotos[getWeekKey(year, week)] || [])
  const loadExpensePhotos = useAppStore((s) => s.loadExpensePhotos)
  const addExpensePhoto = useAppStore((s) => s.addExpensePhoto)
  const updateExpensePhotoNote = useAppStore((s) => s.updateExpensePhotoNote)
  const removeExpensePhoto = useAppStore((s) => s.removeExpensePhoto)

  const [isLoading, setIsLoading] = useState(true)

  const load = useCallback(async () => {
    setIsLoading(true)
    await loadExpensePhotos(year, week)
    setIsLoading(false)
  }, [loadExpensePhotos, year, week])

  useEffect(() => {
    load()
  }, [load])

  const addPhoto = useCallback(
    (file: File) => addExpensePhoto(file, year, week),
    [addExpensePhoto, year, week]
  )

  const updatePhotoNote = useCallback(
    (id: string, note: string) => updateExpensePhotoNote(year, week, id, note),
    [updateExpensePhotoNote, year, week]
  )

  const removePhoto = useCallback(
    (id: string) => removeExpensePhoto(year, week, id),
    [removeExpensePhoto, year, week]
  )

  return { photos, isLoading, addPhoto, removePhoto, updatePhotoNote, reload: load }
}
