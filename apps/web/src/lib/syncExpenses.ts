/**
 * syncExpenses — Pure debounced sync function for daily expenses.
 *
 * Extracted from appStore.ts so the sync logic can be used
 * anywhere without depending on zustand internals.
 *
 * Usage:
 *   import { syncExpenses } from '@/lib/syncExpenses'
 *   syncExpenses(expenseData, userId)
 */

import { addToSyncQueue } from '@/db/indexeddb'

// Module-level debounce timer — shared across all call sites so
// rapid toggles from multiple sources batch into one sync payload.
let timer: ReturnType<typeof setTimeout> | null = null

/**
 * Queue a background sync of the given expenses, debounced 2 s.
 *
 * Safe to call from anywhere (store, hook, component, module init).
 * Only the last call in a burst actually pushes to the sync queue.
 *
 * @param all    - Flat array of { date, expense_type, value } triples.
 * @param userId - Owner of the expenses.
 * @param ms     - Debounce delay (default 2000).
 * @param dates  - Every date key the device manages (including days that just
 *                 became empty) so the cloud full-replace deletes them too.
 */
export function syncExpenses(
  all: Array<{ date: string; expense_type: string; value: number }>,
  userId: string,
  ms = 2000,
  dates?: string[],
): void {
  if (timer) clearTimeout(timer)

  timer = setTimeout(() => {
    timer = null

    addToSyncQueue({
      type: 'expenses_sync',
      userId,
      expenses: all,
      dates,
      timestamp: Date.now(),
    }).catch((e) => {
      console.warn('Failed to add expense sync to queue:', e)
    })
  }, ms)
}
