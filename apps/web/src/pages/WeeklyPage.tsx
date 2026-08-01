import { useEffect, useState, useCallback } from 'react'
import { WeekOverview } from '@/components/weekly/WeekOverview'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { OtisDurationSelect } from '@/components/ui/OtisDurationSelect'
import { ActivityPicker } from '@/components/daily/ActivityPicker'
import { useAppStore } from '@/stores/appStore'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from '@/lib/useTranslation'
import type { TimeEntry, ActivityCode } from '@/lib/types'
import {
  decimalToTime,
  timeToDecimal,
  otisToStandard,
  formatOtisDuration,
  snapToQuarter,
} from '@/lib/utils'
import { Save, Building2, ChevronDown } from 'lucide-react'
import { useTimeEntries } from '@/hooks/useTimeEntries'
import { useExpensePhotos } from '@/hooks/useExpensePhotos'
import { ReceiptPhotos } from '@/components/export/ReceiptPhotos'

export function WeeklyPage() {
  const { t } = useTranslation()
  const { currentWeek, setCurrentWeek, activityCodes } = useAppStore(
    useShallow((s) => ({
      currentWeek: s.currentWeek,
      setCurrentWeek: s.setCurrentWeek,
      activityCodes: s.activityCodes,
    })),
  )
  const { timeEntries, weekSummary, updateEntry, deleteEntry, loadWeek, recalculate } =
    useTimeEntries()
  // Week's receipt photos (Spesen Belege) — shared store data, compact strip.
  const { photos: weekPhotos } = useExpensePhotos(currentWeek.year, currentWeek.week)

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
  const [editStart, setEditStart] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editActivityCode, setEditActivityCode] = useState<ActivityCode | null>(null)
  const [showEditActivityPicker, setShowEditActivityPicker] = useState(false)
  const [editIsSaving, setEditIsSaving] = useState(false)

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
    setEditStart(decimalToTime(entry.start_time))
    setEditDuration(formatOtisDuration(entry.duration))
    const code = activityCodes.find((c) => c.code === entry.activity_code)
    setEditActivityCode(code || null)
  }

  const handleSaveEdit = async () => {
    if (!editEntry) return
    setEditIsSaving(true)
    try {
      const start = timeToDecimal(editStart)
      const otisVal = parseFloat(editDuration)
      const standardDur = isNaN(otisVal)
        ? editEntry.duration
        : Math.max(Math.round(otisToStandard(otisVal) * 4) / 4, 0.25)
      const updatedEntry: TimeEntry = {
        ...editEntry,
        start_time: start,
        duration: Math.max(standardDur, 0.25),
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
          <ReceiptPhotos photos={weekPhotos} compact />
        </div>
      )}

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
                    <span className="font-bold text-sm text-otis-700 dark:text-otis-300">
                      {editEntry.location_anlagenummer}
                    </span>
                  )}
                  {editEntry.location_project_id && (
                    <span className="text-[11px] text-gray-400 dark:text-stone-300 font-mono">
                      {editEntry.location_project_id}
                    </span>
                  )}
                  {editEntry.activity_code && (
                    <Badge variant="info" size="sm">
                      {editEntry.activity_code}
                    </Badge>
                  )}
                </div>
                {editEntry.location_address && (
                  <p className="text-[11px] text-gray-400 dark:text-stone-300 truncate mt-0.5">
                    {editEntry.location_address}
                  </p>
                )}
              </div>
            </div>

            {/* Start time */}
            <Input
              id="edit-start"
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

            {/* Activity code (not for lunch entries) */}
            {!editEntry.is_lunch && (
              <div>
                <label className="block text-sm font-semibold text-otis-700 dark:text-otis-200 mb-1.5">
                  {t('entry.activity')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowEditActivityPicker(true)}
                  className="w-full flex items-center justify-between h-14 px-4 rounded-2xl glass-input dark:glass-input-dark text-otis-900 dark:text-white hover:border-otis-400/40 transition-all"
                >
                  {editActivityCode ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="info">{editActivityCode.code}</Badge>
                      <span className="text-sm text-gray-500 dark:text-stone-300">
                        {editActivityCode.description_de}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400 dark:text-stone-300">
                      {t('entry.activity.select')}
                    </span>
                  )}
                  <ChevronDown className="w-5 h-5 text-gray-400 dark:text-stone-300" />
                </button>
              </div>
            )}

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
        {editEntry && (
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
        )}
      </BottomSheet>
    </>
  )
}
