import { useEffect, useState, useCallback } from 'react'
import { WeekOverview } from '@/components/weekly/WeekOverview'
import { EditEntrySheet } from '@/components/daily/EditEntrySheet'
import { useAppStore } from '@/stores/appStore'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from '@/lib/useTranslation'
import type { TimeEntry } from '@/lib/types'
import { useTimeEntries } from '@/hooks/useTimeEntries'
import { useExpensePhotos } from '@/hooks/useExpensePhotos'
import { ReceiptPhotos } from '@/components/export/ReceiptPhotos'

export function WeeklyPage() {
  const { t } = useTranslation()
  const { currentWeek, setCurrentWeek } = useAppStore(
    useShallow((s) => ({
      currentWeek: s.currentWeek,
      setCurrentWeek: s.setCurrentWeek,
    })),
  )
  const { timeEntries, weekSummary, updateEntry, deleteEntry, loadWeek, recalculate } =
    useTimeEntries()
  // Week's receipt photos (Spesen Belege) — shared store data, compact strip.
  const { photos: weekPhotos, removePhoto: removeWeekPhoto } = useExpensePhotos(
    currentWeek.year,
    currentWeek.week,
  )

  // Page-local loading state — independent from the app-wide initialize()
  // flag, so the spinner reflects only THIS page's week load (not the whole
  // app's init). If the store's global isLoading ever gets stuck, the Woche
  // page can no longer be frozen by it.
  const [weekLoading, setWeekLoading] = useState(false)

  const handleLoadWeek = useCallback(async () => {
    setWeekLoading(true)
    try {
      await loadWeek()
    } finally {
      setWeekLoading(false)
    }
  }, [loadWeek])

  // Edit state
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)

  useEffect(() => {
    handleLoadWeek()
  }, [currentWeek, handleLoadWeek])

  useEffect(() => {
    recalculate()
  }, [timeEntries, recalculate])

  const handlePrevWeek = () => {
    let { year, week } = currentWeek
    if (week <= 1) {
      year--
      week = 52
    } else {
      week--
    }
    setCurrentWeek(year, week)
  }

  const handleNextWeek = () => {
    let { year, week } = currentWeek
    if (week >= 52) {
      year++
      week = 1
    } else {
      week++
    }
    setCurrentWeek(year, week)
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (window.confirm(t('timeline.confirm.delete'))) {
      await deleteEntry(entryId)
      await loadWeek()
    }
  }

  const handleEditEntry = (entry: TimeEntry) => {
    setEditEntry(entry)
  }

  const handleSaveEdit = async (entry: TimeEntry) => {
    await updateEntry(entry)
    await loadWeek()
  }

  // Keep the spinner through both the week load AND the summary recalc, so no
  // blank frame flashes between them (calculateWeekSummary always sets the
  // summary, so this can never get stuck).
  if (weekLoading || !weekSummary) {
    return (
      <div className="flex items-center justify-center min-h-[50dvh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-stone-400">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <WeekOverview
        weekSummary={weekSummary}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onDeleteEntry={handleDeleteEntry}
        onEditEntry={handleEditEntry}
      />

      {/* Week's receipt photos (Spesen Belege) — compact strip */}
      {weekPhotos.length > 0 && (
        <div className="space-y-1.5 mt-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 dark:text-rose-300 uppercase tracking-wider mb-1">
            <span className="w-1 h-3 rounded-full bg-gradient-to-b from-rose-400 to-rose-600" />
            <span>{t('spesen.photos.title')}</span>
            <div className="flex-1 h-px bg-gradient-to-r from-rose-200/50 to-transparent dark:from-white/5" />
          </div>
          <ReceiptPhotos photos={weekPhotos} compact onDelete={removeWeekPhoto} />
        </div>
      )}

      {/* Edit Entry Bottom Sheet */}
      <EditEntrySheet
        open={editEntry !== null}
        entry={editEntry}
        onClose={() => setEditEntry(null)}
        onSave={handleSaveEdit}
      />
    </>
  )
}
