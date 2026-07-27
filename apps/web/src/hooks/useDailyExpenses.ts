/**
 * useDailyExpenses — Unified hook for daily expense operations.
 *
 * Consolidates three patterns that were duplicated across SpesenPage,
 * ExpenseEditor, and DashboardPage:
 *   1. Loading expenses from IndexedDB when dates/dependencies change
 *   2. Mutating expenses via the store (toggle, set value)
 *   3. Triggering background sync to Supabase
 *
 * Usage:
 *   // SpesenPage (whole week)
 *   const { dailyExpenses, syncExpenses } = useDailyExpenses(dates)
 *
 *   // ExpenseEditor (single day)
 *   const { dailyExpenses, syncExpenses } = useDailyExpenses([date])
 *
 *   // Dashboard (single day, no auto-refresh — opened via popup)
 *   const { refreshFromLocalDB, syncExpenses } = useDailyExpenses([currentDate], { refreshOnMount: false })
 */

import { useEffect, useCallback } from 'react'
import type { DailyExpense, DailyExpensesMap, ExpenseType } from '@/lib/types'
import { useAppStore } from '@/stores/appStore'
import { useExpensesSync } from '@/hooks/useExpensesSync'
import * as localDb from '@/db/indexeddb'

interface UseDailyExpensesOptions {
  /** Auto-refresh from IndexedDB when dates change (default: true) */
  refreshOnMount?: boolean
}

interface UseDailyExpensesReturn {
  /** All daily expenses from the store (subscribed, reactive) */
  dailyExpenses: DailyExpensesMap

  /** Get expenses for a specific date */
  getExpenses: (date: string) => DailyExpense[]

  /** Toggle an expense type on/off for a given date */
  toggleExpense: (date: string, type: ExpenseType) => void

  /** Set a numeric value for a given date/type (CHF for material, km for privatfahrzeug) */
  setExpenseValue: (date: string, type: ExpenseType, value: number) => void

  /** Manually reload expenses from IndexedDB for the given dates */
  refreshFromLocalDB: () => Promise<void>

  /** Trigger debounced sync to Supabase (2s debounce, batched) */
  syncExpenses: () => void
}

/**
 * Hook that bundles expense loading, mutation, and sync.
 *
 * @param dates   - Array of ISO date strings to manage (e.g. ['2026-07-27'] or week dates)
 * @param options - Optional configuration (refreshOnMount defaults to true)
 */
export function useDailyExpenses(
  dates: string[],
  options?: UseDailyExpensesOptions,
): UseDailyExpensesReturn {
  const { refreshOnMount = true } = options ?? {}

  const { dailyExpenses, setDailyExpenses, toggleExpense, setExpenseValue } = useAppStore()
  const syncExpensesFn = useExpensesSync()

  // Stable serialisation so the effect only fires when dates actually change.
  const datesKey = dates.join(',')

  // Auto-refresh from IndexedDB when dates change (or on mount).
  // Only active when refreshOnMount is true (default).
  useEffect(() => {
    if (!refreshOnMount) return

    localDb.getDailyExpenses().then((saved: Record<string, DailyExpense[]>) => {
      if (Object.keys(saved).length === 0) return
      const targetDates = datesKey ? datesKey.split(',') : []
      for (const date of targetDates) {
        const dayData = saved[date]
        if (dayData && dayData.length > 0) {
          setDailyExpenses(date, dayData)
        }
      }
    })
    // Use stable string key so the effect only runs when the set of dates changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshOnMount, datesKey, setDailyExpenses])

  /** Manually reload from IndexedDB — useful when opening a popup. */
  const refreshFromLocalDB = useCallback(async () => {
    const saved = await localDb.getDailyExpenses()
    if (Object.keys(saved).length === 0) return
    for (const date of datesKey.split(',')) {
      if (!date) continue
      const dayData = saved[date]
      if (dayData && dayData.length > 0) {
        setDailyExpenses(date, dayData)
      }
    }
  }, [datesKey, setDailyExpenses])

  /** Convenience helper to get expenses for a specific date. */
  const getExpenses = useCallback(
    (date: string): DailyExpense[] => dailyExpenses[date] ?? [],
    [dailyExpenses],
  )

  return {
    dailyExpenses,
    getExpenses,
    toggleExpense,
    setExpenseValue,
    refreshFromLocalDB,
    syncExpenses: syncExpensesFn,
  }
}
