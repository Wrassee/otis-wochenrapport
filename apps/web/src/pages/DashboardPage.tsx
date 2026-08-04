import { useEffect, useMemo, useState } from 'react'
import { TimeEntryForm } from '@/components/daily/TimeEntryForm'
import { EditEntrySheet } from '@/components/daily/EditEntrySheet'
import { QuickAdd } from '@/components/daily/QuickAdd'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/appStore'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from '@/lib/useTranslation'
import type { TimeEntry } from '@/lib/types'
import { getWeekInfo } from '@/lib/utils'
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  UtensilsCrossed,
  Building2,
  Euro,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { TimelineView } from '@/components/ui/TimelineView'
import { useExpensesSync } from '@/hooks/useExpensesSync'
import { useTimeEntries } from '@/hooks/useTimeEntries'
import { useExpensePhotos } from '@/hooks/useExpensePhotos'
import { ReceiptPhotos } from '@/components/export/ReceiptPhotos'
import { ExpenseEditor } from '@/components/weekly/ExpenseEditor'

export function DashboardPage() {
  const { t } = useTranslation()
  const { currentDate, setCurrentDate, currentWeek, language } = useAppStore(
    useShallow((s) => ({
      currentDate: s.currentDate,
      setCurrentDate: s.setCurrentDate,
      currentWeek: s.currentWeek,
      language: s.language,
    })),
  )
  const { timeEntries, addEntry, updateEntry, deleteEntry, quickAdd, loadWeek } = useTimeEntries()
  const info = getWeekInfo(currentDate)
  // Week's receipt photos (Spesen Belege) — shared store data, compact strip.
  // Single week source of truth: the store's currentWeek (kept in sync with
  // the day via setCurrentDate), so all pages address the same week.
  const { photos: weekPhotos, removePhoto: removeWeekPhoto } = useExpensePhotos(
    currentWeek.year,
    currentWeek.week,
  )
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [conflictEntryIds, setConflictEntryIds] = useState<string[]>([])
  const [showExpenseEditor, setShowExpenseEditor] = useState(false)
  const syncExpensesOnClose = useExpensesSync()

  useEffect(() => {
    loadWeek()
    // Reset conflict highlights when day changes
    setConflictEntryIds([])
  }, [currentDate, loadWeek])

  const todayEntries = useMemo(
    () =>
      timeEntries.filter((e) => e.date === currentDate).sort((a, b) => a.start_time - b.start_time),
    [timeEntries, currentDate],
  )
  const workEntries = todayEntries.filter((e) => !e.is_lunch)
  const lunchEntries = todayEntries.filter((e) => e.is_lunch)
  const totalHours = workEntries.reduce((sum, e) => sum + e.duration, 0)
  const lunchMinutes = lunchEntries.reduce((sum, e) => sum + e.duration * 60, 0)
  const dayOfWeek = info.dayOfWeek
  const requiredHours = dayOfWeek === 5 ? 8.0 : 8.5
  const progress = Math.min(totalHours / requiredHours, 1)
  const isComplete = totalHours >= requiredHours

  // Determine next start time (chained from last entry)
  const lastEntry = todayEntries[todayEntries.length - 1]
  const defaultStartTime = lastEntry ? lastEntry.start_time + lastEntry.duration : 7.5

  const handlePrevDay = () => {
    const d = new Date(currentDate + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setCurrentDate(d.toISOString().split('T')[0])
  }

  const handleNextDay = () => {
    const d = new Date(currentDate + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    setCurrentDate(d.toISOString().split('T')[0])
  }

  const handleSaveEntry = async (entry: any) => {
    await addEntry(entry)
    await loadWeek()
  }

  const handleQuickAdd = async (entry: any, extraHours: number) => {
    await quickAdd(entry, extraHours)
    await loadWeek()
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

  const dateObj = new Date(currentDate + 'T12:00:00')
  const dayName = dateObj.toLocaleDateString(language, { weekday: 'long' })
  const dateFormatted = dateObj.toLocaleDateString(language, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-4">
      {/* Day navigation */}
      <Card>
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevDay}
            className="flex items-center justify-center w-12 h-12 rounded-2xl glass dark:glass-dark hover:bg-white/20 transition-all active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 text-otis-600 dark:text-otis-400" />
          </button>

          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-2">
              <Building2 className="w-4 h-4 text-otis-400" />
              <span className="font-bold text-lg text-otis-800 dark:text-white">{dayName}</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-stone-300 mt-0.5">{dateFormatted}</p>
          </div>

          <button
            onClick={handleNextDay}
            className="flex items-center justify-center w-12 h-12 rounded-2xl glass dark:glass-dark hover:bg-white/20 transition-all active:scale-95"
          >
            <ChevronRight className="w-5 h-5 text-otis-600 dark:text-otis-400" />
          </button>
        </div>
      </Card>

      {/* Daily progress */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'w-10 h-10 rounded-2xl flex items-center justify-center',
                isComplete
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20'
                  : 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20',
              )}
            >
              {isComplete ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <Clock className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <span className="font-bold text-2xl text-otis-800 dark:text-white">
                {totalHours.toFixed(1)}h
              </span>
              <span className="text-sm text-gray-400 dark:text-stone-300 ml-1">
                / {requiredHours}h
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isComplete ? (
              <Badge variant="success">{t('dashboard.progress')}</Badge>
            ) : (
              <Badge variant="warning">
                {t('dashboard.missing', { hours: (requiredHours - totalHours).toFixed(1) })}
              </Badge>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 rounded-full bg-otis-200/30 dark:bg-white/5 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500 ease-out',
              isComplete
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                : 'bg-gradient-to-r from-amber-400 to-amber-500',
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Lunch info */}
        {lunchMinutes > 0 && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500 dark:text-stone-300">
            <UtensilsCrossed className="w-3.5 h-3.5 text-amber-500" />
            <span>{t('dashboard.lunch', { min: Math.round(lunchMinutes) })}</span>
          </div>
        )}

        {/* Spesen quick button */}
        <button
          type="button"
          onClick={() => setShowExpenseEditor(true)}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all duration-150 mt-3 bg-white/50 dark:bg-white/5 border-amber-200/30 dark:border-amber-700/20 hover:border-amber-300/50 hover:bg-amber-50/30 dark:hover:bg-amber-900/10"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
              <Euro className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-medium text-gray-600 dark:text-stone-300">
              {t('entry.spesen')}
            </span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 dark:text-stone-300" />
        </button>

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400 dark:text-stone-300">
            {t('dashboard.entries', { count: todayEntries.length })}
          </span>
          {lunchEntries.length > 0 && (
            <span className="text-xs text-emerald-500">{t('dashboard.pause.recorded')}</span>
          )}
        </div>
      </Card>

      {/* Existing entries for today — Timeline View */}
      {todayEntries.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-otis-400 dark:text-otis-300 uppercase tracking-wider mb-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{t('dashboard.today')}</span>
            <div className="flex-1 h-px bg-gradient-to-r from-otis-200/50 to-transparent dark:from-white/5" />
          </div>
          <div className="bg-white/40 dark:bg-otis-900/30 rounded-2xl border border-otis-100/20 dark:border-otis-700/30">
            <TimelineView
              entries={todayEntries}
              onEditEntry={handleEditEntry}
              onDeleteEntry={handleDeleteEntry}
              showActions={true}
              conflictEntryIds={conflictEntryIds}
            />
          </div>
        </div>
      )}

      {/* Week's receipt photos (Spesen Belege) — compact strip */}
      {weekPhotos.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400 dark:text-rose-300 uppercase tracking-wider mb-1">
            <span className="w-1 h-3 rounded-full bg-gradient-to-b from-rose-400 to-rose-600" />
            <span>{t('spesen.photos.title')}</span>
            <div className="flex-1 h-px bg-gradient-to-r from-rose-200/50 to-transparent dark:from-white/5" />
          </div>
          <ReceiptPhotos photos={weekPhotos} compact onDelete={removeWeekPhoto} />
        </div>
      )}

      {/* Quick Add for today */}
      <QuickAdd entries={todayEntries} onQuickAdd={handleQuickAdd} />

      {/* Edit Entry Bottom Sheet */}
      <EditEntrySheet
        open={editEntry !== null}
        entry={editEntry}
        onClose={() => setEditEntry(null)}
        onSave={handleSaveEdit}
      />

      {/* Spesen ExpenseEditor */}
      {showExpenseEditor && (
        <ExpenseEditor
          open={showExpenseEditor}
          onClose={() => {
            syncExpensesOnClose()
            setShowExpenseEditor(false)
          }}
          date={currentDate}
          dayName={dayName}
        />
      )}

      {/* Time Entry Form */}
      <TimeEntryForm
        date={currentDate}
        defaultStartTime={defaultStartTime}
        existingEntries={todayEntries}
        onSave={handleSaveEntry}
        onOverlapClick={(ids) => setConflictEntryIds(ids)}
      />
    </div>
  )
}
