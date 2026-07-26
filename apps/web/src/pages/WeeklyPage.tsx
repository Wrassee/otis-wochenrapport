import { useEffect, useState } from 'react'
import { WeekOverview } from '@/components/weekly/WeekOverview'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { OtisDurationSelect } from '@/components/ui/OtisDurationSelect'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/lib/useTranslation'
import type { TimeEntry } from '@/lib/types'
import { decimalToTime, timeToDecimal, otisToStandard, formatOtisDuration, snapToQuarter } from '@/lib/utils'
import { Save, Building2 } from 'lucide-react'

export function WeeklyPage() {
  const { t } = useTranslation()
  const {
    currentWeek,
    setCurrentWeek,
    weekSummary,
    loadWeekEntries,
    calculateWeekSummary,
    deleteTimeEntry,
    updateTimeEntry,
    isLoading,
  } = useAppStore()

  // Edit state
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null)
  const [editStart, setEditStart] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editIsSaving, setEditIsSaving] = useState(false)

  useEffect(() => {
    loadWeekEntries()
  }, [currentWeek])

  useEffect(() => {
    calculateWeekSummary()
  }, [useAppStore.getState().timeEntries])

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
      await deleteTimeEntry(entryId)
      await loadWeekEntries()
    }
  }

  const handleEditEntry = (entry: TimeEntry) => {
    setEditEntry(entry)
    setEditStart(decimalToTime(entry.start_time))
    setEditDuration(formatOtisDuration(entry.duration))
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
        duration: Math.max(standardDur, 0.25),
      }
      await updateTimeEntry(updatedEntry)
      await loadWeekEntries()
      setEditEntry(null)
    } catch (err) {
      console.warn('Failed to update entry:', err)
    } finally {
      setEditIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  if (!weekSummary) return null

  return (
    <>
      <WeekOverview
        weekSummary={weekSummary}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onDeleteEntry={handleDeleteEntry}
        onEditEntry={handleEditEntry}
      />

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
    </>
  )
}
