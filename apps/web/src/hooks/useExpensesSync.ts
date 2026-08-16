/**
 * useExpensesSync — React hook wrapping the pure syncExpenses function.
 *
 * Reads current expenses from the zustand store and passes them to
 * the standalone lib/syncExpenses utility.
 *
 * Usage in a component:
 *   const syncExpenses = useExpensesSync()
 *   // after mutating local state:
 *   syncExpenses()
 *
 * For usage outside React (e.g. store actions, event handlers),
 * import syncExpenses directly from '@/lib/syncExpenses'.
 */

import { useCallback, useRef } from 'react'
import { useAppStore } from '@/stores/appStore'
import { syncExpenses as doSync } from '@/lib/syncExpenses'

/**
 * Returns a memoised function that collects all daily expenses from the
 * current store state and queues a single background-sync operation.
 *
 * @param delayMs — debounce delay in ms (default 2000)
 */
export function useExpensesSync(delayMs = 2000): () => void {
  const delayRef = useRef(delayMs)
  delayRef.current = delayMs

  const sync = useCallback(() => {
    const state = useAppStore.getState()
    if (!state.user || !navigator.onLine) return

    const all: Array<{ date: string; expense_type: string; value: number }> = []
    for (const [date, exps] of Object.entries(state.dailyExpenses)) {
      for (const exp of exps) {
        all.push({ date, expense_type: exp.expense_type, value: exp.value })
      }
    }

    doSync(all, state.user.id, delayRef.current, Object.keys(state.dailyExpenses))
  }, [])

  return sync
}
