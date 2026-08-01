import { useEffect, useMemo, useState } from 'react'
import { TimeEntryForm } from '@/components/daily/TimeEntryForm'
import { QuickAdd } from '@/components/daily/QuickAdd'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { OtisDurationSelect } from '@/components/ui/OtisDurationSelect'
import { ActivityPicker } from '@/components/daily/ActivityPicker'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/lib/useTranslation'
import type { TimeEntry, ActivityCode } from '@/lib/types'
import { getWeekInfo, decimalToTime, timeToDecimal, formatOtisDuration, otisToStandard, snapToQuarter } from '@/lib/utils'
import { Clock, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, UtensilsCrossed, Building2, Save, Euro, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { TimelineView } from '@/components/ui/TimelineView'
import { useExpensesSync } from '@/hooks/useExpensesSync'
import { useTimeEntries } from '@/hooks/useTimeEntries'
import { useExpensePhotos } from '@/hooks/useExpensePhotos'
import { ReceiptPhotos } from '@/components/export/ReceiptPhotos'
import { ExpenseEditor } from '@/components/weekly/ExpenseEditor'

export function DashboardPage() {
  const { t } = useTranslation()
  const {
    currentDate,
    setCurrentDate,
    syncStatus,
    setSyncStatus,
    activityCodes,
  } = useAppStore()
  const { timeEntries, addEntry, updateEntry, deleteEntry, quickAdd, loadWeek } = useTimeEntries()
  const info = getWeekInfo(currentDate)
  // Week's receipt photos (Spesen Belege) — shared store data, compact strip.
  const { photos: weekPhotos } = useExpensePhotos(info.year, info.week)
  const handleSync = async () => {
    const { forceSync } = await import('@/db/sync')
    setSyncStatus({ syncing: true })
    await forceSync()
  }
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editIsSaving, setEditIsSaving] = useState(false)
  const [editActivityCode, setEditActivityCode] = useState<ActivityCode | null>(null)
  const [showEditActivityPicker, setShowEditActivityPicker] = useState(false)
  const [conflictEntryIds, setConflictEntryIds] = useState<string[]>([])
  const [showExpenseEditor, setShowExpenseEditor] = useState(false)
  const syncExpensesOnClose = useExpensesSync()

  useEffect(() => {
    loadWeek()
    // Reset conflict highlights when day changes
    setConflictEntryIds([])
  }, [currentDate, loadWeek])

  const todayEntries = useMemo(
    () => timeEntries
      .filter((e) => e.date === currentDate)
      .sort((a, b) => a.start_time - b.start_time),
    [timeEntries, currentDate]
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
    setEditStart(decimalToTime(entry.start_time))
    setEditDuration(formatOtisDuration(entry.duration))
    const foundCode = activityCodes.find((c) => c.code === entry.activity_code)
    setEditActivityCode(foundCode || null)
  }

  const handleSaveEdit = async () => {
    if (!editEntry) return
    setEditIsSaving(true)
    try {
      const start = timeToDecimal(editStart)
      const otisVal = parseFloat(editDuration)
      const standardDur = isNaN(otisVal) ? editEntry.duration : Math.max(Math.round(otisToStandard(otisVal) * 4) / 4, 0.25)
      const updatedEntry: TimeEntry = {
        ...editEntry,
        start_time: start,
        duration: standardDur,
        activity_code: editActivityCode?.code || editEntry.activity_code,
        activity_code_id: editActivityCode?.id || editEntry.activity_code_id,
      }
      await updateEntry(updatedEntry)
      await loadWeek()
      setEditEntry(null)
    } catch (err) {
      console.warn('Failed to update entry:', err)
    } finally {
      setEditIsSaving(false)
    }
  }

  const dateObj = new Date(currentDate + 'T12:00:00')
  const dayName = dateObj.toLocaleDateString('de-DE', { weekday: 'long' })
  const dateFormatted = dateObj.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4">
      {/* Sync status card */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center shadow-lg',
              syncStatus.online
                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/20'
                : 'bg-gradient-to-br from-red-400 to-red-600 shadow-red-500/20'
            )}>
              {syncStatus.online
                ? <Wifi className="w-4 h-4 text-white" />
                : <WifiOff className="w-4 h-4 text-white" />
              }
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={cn(
                  'text-xs font-bold',
                  syncStatus.online ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
                )}>
                  {syncStatus.online ? t('settings.online') : t('settings.offline')}
                </span>
                {syncStatus.lastSync && (
                  <span className="text-[10px] text-gray-400">
                    {new Date(syncStatus.lastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-gray-400">
                {syncStatus.pendingSync > 0
                  ? t('settings.pending.count', { n: syncStatus.pendingSync })
                  : t('settings.pending.none')
                }
              </span>
            </div>
          </div>
          <Button
            onClick={handleSync}
            variant="primary"
            size="sm"
            disabled={syncStatus.syncing}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', syncStatus.syncing && 'animate-spin')} />
            {syncStatus.syncing ? t('settings.syncing') : t('settings.sync.now')}
          </Button>
        </div>
      </Card>

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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{dateFormatted}</p>
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
            <div className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center',
              isComplete
                ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20'
                : 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20'
            )}>
              {isComplete
                ? <CheckCircle2 className="w-5 h-5 text-white" />
                : <Clock className="w-5 h-5 text-white" />
              }
            </div>
            <div>
              <span className="font-bold text-2xl text-otis-800 dark:text-white">{totalHours.toFixed(1)}h</span>
              <span className="text-sm text-gray-400 ml-1">/ {requiredHours}h</span>
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
                : 'bg-gradient-to-r from-amber-400 to-amber-500'
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Lunch info */}
        {lunchMinutes > 0 && (
          <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500 dark:text-gray-400">
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
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{t('entry.spesen')}</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </button>

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{t('dashboard.entries', { count: todayEntries.length })}</span>
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
          <ReceiptPhotos photos={weekPhotos} compact />
        </div>
      )}

      {/* Quick Add for today */}
      <QuickAdd entries={todayEntries} onQuickAdd={handleQuickAdd} />

      {/* Edit Entry Bottom Sheet */}
      <BottomSheet
        open={editEntry !== null}
        onClose={() => setEditEntry(null)}
        title={t('edit.title')}
      >
        {editEntry && (
          <div className="space-y-4">
            {/* Entry info */}
            <div className="flex items-center gap-2.5 p-3.5 bg-otis-50/80 dark:bg-otis-900/30 backdrop-blur rounded-2xl border border-otis-200/30 dark:border-otis-700/30">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-otis-500 to-otis-700 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {editEntry.location_anlagenummer && (
                    <span className="font-bold text-sm text-otis-700 dark:text-otis-300">{editEntry.location_anlagenummer}</span>
                  )}
                  {editEntry.location_project_id && (
                    <span className="text-[11px] text-gray-400 font-mono">{editEntry.location_project_id}</span>
                  )}
                  {editEntry.activity_code && (
                    <Badge variant="info" size="sm">{editEntry.activity_code}</Badge>
                  )}
                </div>
                {editEntry.location_address && (
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">{editEntry.location_address}</p>
                )}
              </div>
            </div>

            {/* Tätigkeit — Activity code picker */}
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-otis-700 dark:text-otis-200">
                {t('entry.activity')}
              </label>
              <button
                type="button"
                onClick={() => setShowEditActivityPicker(true)}
                className="w-full flex items-center justify-between p-3.5 rounded-xl border transition-all duration-150 bg-white/50 dark:bg-white/5 border-otis-200/30 dark:border-white/10 hover:border-otis-300/50"
              >
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-otis-100/50 dark:bg-otis-800/30 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-otis-500 dark:text-otis-400" />
                  </div>
                  <span className={`text-sm font-medium ${editActivityCode ? 'text-otis-800 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
                    {editActivityCode ? editActivityCode.code : t('entry.activity.select')}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Start time */}
            <Input
              id="dash-edit-start"
              label={t('entry.beginn')}
              type="time"
              value={editStart}
              onChange={(e) => {
                const decimal = timeToDecimal(e.target.value)
                const snapped = snapToQuarter(decimal)
                setEditStart(decimalToTime(snapped))
              }}
              step="900"
              required
              hint={t('entry.beginn.hint')}
            />

            {/* Duration (OTIS) */}
            <OtisDurationSelect
              label={t('entry.dauer')}
              value={editDuration}
              onChange={(value) => setEditDuration(value)}
              required
            />

            {/* Action buttons */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                onClick={() => setEditEntry(null)}
                className="flex-1"
                size="lg"
              >
                {t('edit.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveEdit}
                className="flex-1"
                size="lg"
                disabled={editIsSaving}
              >
                <Save className="w-4 h-4" />
                {editIsSaving ? t('edit.saving') : t('edit.save')}
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Edit Activity Picker */}
      <ActivityPicker
        open={showEditActivityPicker}
        onClose={() => setShowEditActivityPicker(false)}
        onSelect={(code) => {
          setEditActivityCode(code)
          setShowEditActivityPicker(false)
        }}
        codes={activityCodes}
        selectedCode={editActivityCode?.code}
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
