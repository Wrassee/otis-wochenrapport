/**
 * useExpensesRefresh — Shared hook that loads the latest daily expenses
 * from IndexedDB into the zustand store.
 *
 * DRY replacement for the identical IndexedDB-refresh logic that was
 * duplicated across SpesenPage and ExpenseEditor.
 *
 * Usage:
 *   // SpesenPage — refresh all week dates once on mount
 *   useExpensesRefresh(dates, [])
 *
 *   // ExpenseEditor — refresh a single date each time the sheet opens
 *   useExpensesRefresh([date], [open, date])
 */

import { useEffect } from 'react'
import { useAppStore } from '@/stores/appStore'
import * as localDb from '@/db/indexeddb'

/**
 * @param dates  - Array of date strings (YYYY-MM-DD) to refresh.
 * @param deps   - Effect dependencies. Pass `[]` for mount-only,
 *                 or `[open, date]` for sheet-open / date-change.
 */
export function useExpensesRefresh(dates: string[], deps: React.DependencyList): void {
  const setDailyExpenses = useAppStore((s) => s.setDailyExpenses)

  useEffect(() => {
    localDb.getDailyExpenses().then((saved) => {
      if (Object.keys(saved).length === 0) return
      for (const date of dates) {
        const dayData = saved[date]
        if (dayData && dayData.length > 0) {
          setDailyExpenses(date, dayData)
        }
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
