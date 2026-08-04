import { useState } from 'react'
import type { WeekSummary, TimeEntry } from '@/lib/types'
import { DayCard } from './DayCard'
import { ExpenseEditor } from './ExpenseEditor'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/lib/useTranslation'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
} from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { cn } from '@/lib/cn'

interface WeekOverviewProps {
  weekSummary: WeekSummary
  onPrevWeek: () => void
  onNextWeek: () => void
  onDeleteEntry?: (entryId: string) => void
  onEditEntry?: (entry: TimeEntry) => void
}

export function WeekOverview({
  weekSummary,
  onPrevWeek,
  onNextWeek,
  onDeleteEntry,
  onEditEntry,
}: WeekOverviewProps) {
  const { t } = useTranslation()
  const dailyExpenses = useAppStore((s) => s.dailyExpenses)
  const [expenseEditor, setExpenseEditor] = useState<{ date: string; dayName: string } | null>(null)
  const validDays = weekSummary.days.filter((d) => d.isValid).length
  const totalDays = weekSummary.days.length
  const allValid = validDays === totalDays

  const getExpenseCount = (date: string): number => {
    return dailyExpenses[date]?.length || 0
  }

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <Card>
        <div className="flex items-center justify-between">
          <button
            onClick={onPrevWeek}
            className="flex items-center justify-center w-12 h-12 rounded-2xl glass dark:glass-dark hover:bg-white/20 transition-all active:scale-95"
          >
            <ChevronLeft className="w-5 h-5 text-otis-600 dark:text-otis-400" />
          </button>

          <div className="text-center flex-1">
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-otis-500 to-otis-700 flex items-center justify-center shadow-lg shadow-otis-500/20">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-otis-800 dark:text-white">
                {' '}
                {t('week.title', { number: weekSummary.weekNumber })}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-stone-300 mt-0.5">
              {formatDateShort(weekSummary.startDate)} – {formatDateShort(weekSummary.endDate)}
            </p>
          </div>

          <button
            onClick={onNextWeek}
            className="flex items-center justify-center w-12 h-12 rounded-2xl glass dark:glass-dark hover:bg-white/20 transition-all active:scale-95"
          >
            <ChevronRight className="w-5 h-5 text-otis-600 dark:text-otis-400" />
          </button>
        </div>
      </Card>

      {/* Overall status */}
      <Card variant={allValid ? 'success' : 'warning'}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={cn(
                'w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0',
                allValid
                  ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/20'
                  : 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/20',
              )}
            >
              {allValid ? (
                <CheckCircle2 className="w-6 h-6 text-white" />
              ) : (
                <BarChart3 className="w-6 h-6 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-2xl text-otis-800 dark:text-white">
                  {weekSummary.totalHours.toFixed(1)}h
                </span>
                <span className="text-sm text-gray-400 dark:text-stone-300">{t('week.total')}</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-stone-300 truncate">
                {t('week.days.complete', { valid: validDays, total: totalDays })}
              </p>
            </div>
          </div>
          <Badge
            variant={allValid ? 'success' : 'warning'}
            size="lg"
            className="flex-shrink-0 whitespace-nowrap"
          >
            {allValid ? t('week.complete') : t('week.incomplete')}
          </Badge>
        </div>

        {!allValid && (
          <div className="flex items-start gap-2.5 mt-4 p-3 bg-amber-500/10 backdrop-blur rounded-xl border border-amber-400/20">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-amber-600 dark:text-amber-300">
              {t('week.incomplete.hint')}
            </span>
          </div>
        )}

        <div className="w-full h-2 rounded-full bg-otis-200/30 dark:bg-white/5 mt-4 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700 ease-out',
              allValid
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                : 'bg-gradient-to-r from-amber-400 to-amber-500',
            )}
            style={{ width: `${(validDays / totalDays) * 100}%` }}
          />
        </div>
      </Card>

      {/* Day cards with Spesen button */}
      <div className="space-y-3">
        {weekSummary.days.map((day) => (
          <DayCard
            key={day.date}
            day={day}
            onDeleteEntry={onDeleteEntry}
            onEditEntry={onEditEntry}
            onOpenExpenses={(date, dayName) => setExpenseEditor({ date, dayName })}
            expenseCount={getExpenseCount(day.date)}
          />
        ))}
      </div>

      {/* Expense editor bottom sheet */}
      {expenseEditor && (
        <ExpenseEditor
          open={expenseEditor !== null}
          onClose={() => setExpenseEditor(null)}
          date={expenseEditor.date}
          dayName={expenseEditor.dayName}
        />
      )}
    </div>
  )
}
