/**
 * useTimeEntries — Unified hook for time-entry operations.
 *
 * Follows the same three-layer pattern as the Spesen system:
 *   lib/db/indexeddb.ts  →  hooks/useTimeEntries.ts  →  store + components
 *
 * Bundles store subscription + mutation actions so components
 * don't need to destructure individual store actions.
 *
 * Usage:
 *   const { timeEntries, weekSummary, addEntry, ... } = useTimeEntries()
 */

import { useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { useShallow } from 'zustand/react/shallow'
import type { TimeEntry, WeekSummary } from '@/lib/types'

interface UseTimeEntriesReturn {
  /** All loaded time entries for the current week */
  timeEntries: TimeEntry[]

  /** Pre-computed week summary (per-day totals, validation, zones) */
  weekSummary: WeekSummary | null

  /** Loading state from the store */
  isLoading: boolean

  /** Add a new time entry (offline-first: IndexedDB → store → summary) */
  addEntry: (data: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'synced'>) => Promise<void>

  /** Update an existing time entry */
  updateEntry: (entry: TimeEntry) => Promise<void>

  /** Delete a time entry by ID */
  deleteEntry: (entryId: string) => Promise<void>

  /** Quick-add extra duration to an existing entry */
  quickAdd: (existingEntry: TimeEntry, extraHours: number) => Promise<void>

  /** Load the current week's entries from IndexedDB */
  loadWeek: () => Promise<void>

  /** Recalculate the week summary (totals, validation) */
  recalculate: () => Promise<void>
}

/**
 * Hook that bundles all TimeEntry operations into a single API.
 *
 * Components that need time-entry CRUD can use this hook instead of
 * reaching directly into the store for individual actions.
 */
export function useTimeEntries(): UseTimeEntriesReturn {
  const {
    timeEntries,
    weekSummary,
    isLoading,
    addTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    quickAddDuration,
    loadWeekEntries,
    calculateWeekSummary,
  } = useAppStore(
    useShallow((s) => ({
      timeEntries: s.timeEntries,
      weekSummary: s.weekSummary,
      isLoading: s.isLoading,
      addTimeEntry: s.addTimeEntry,
      updateTimeEntry: s.updateTimeEntry,
      deleteTimeEntry: s.deleteTimeEntry,
      quickAddDuration: s.quickAddDuration,
      loadWeekEntries: s.loadWeekEntries,
      calculateWeekSummary: s.calculateWeekSummary,
    })),
  )

  /** Memoised wrapper — same behaviour as the store action. */
  const addEntry = useCallback(
    async (data: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'synced'>) => {
      await addTimeEntry(data)
    },
    [addTimeEntry],
  )

  const updateEntry = useCallback(
    async (entry: TimeEntry) => {
      await updateTimeEntry(entry)
    },
    [updateTimeEntry],
  )

  const deleteEntry = useCallback(
    async (entryId: string) => {
      await deleteTimeEntry(entryId)
    },
    [deleteTimeEntry],
  )

  const quickAdd = useCallback(
    async (existingEntry: TimeEntry, extraHours: number) => {
      await quickAddDuration(existingEntry, extraHours)
    },
    [quickAddDuration],
  )

  const loadWeek = useCallback(async () => {
    await loadWeekEntries()
  }, [loadWeekEntries])

  const recalculate = useCallback(async () => {
    await calculateWeekSummary()
  }, [calculateWeekSummary])

  return {
    timeEntries,
    weekSummary,
    isLoading,
    addEntry,
    updateEntry,
    deleteEntry,
    quickAdd,
    loadWeek,
    recalculate,
  }
}
