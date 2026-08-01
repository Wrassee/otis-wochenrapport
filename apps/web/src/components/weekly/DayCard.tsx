import type { DaySummary, TimeEntry } from '@/lib/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UtensilsCrossed,
  Clock,
  MapPin,
  Euro,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { TimelineView } from '@/components/ui/TimelineView'
import { useTranslation } from '@/lib/useTranslation'

interface DayCardProps {
  day: DaySummary
  onDeleteEntry?: (entryId: string) => void
  onEditEntry?: (entry: TimeEntry) => void
  onOpenExpenses?: (date: string, dayName: string) => void
  expenseCount?: number
}

export function DayCard({
  day,
  onDeleteEntry,
  onEditEntry,
  onOpenExpenses,
  expenseCount,
}: DayCardProps) {
  const { t } = useTranslation()
  return (
    <Card variant={day.isValid ? 'default' : 'danger'}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="flex items-center gap-2">
            <div
              className={cn(
                'w-6 h-6 rounded-lg flex items-center justify-center',
                day.isValid
                  ? 'bg-emerald-100 dark:bg-emerald-900/30'
                  : 'bg-red-100 dark:bg-red-900/30',
              )}
            >
              {day.isValid ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-500" />
              )}
            </div>
            {day.dayName}
          </CardTitle>
          <span className="text-xs text-gray-400 dark:text-stone-400 font-medium">
            {day.date.slice(5)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={day.totalHours >= day.requiredHours ? 'success' : 'danger'} size="sm">
            {day.totalHours >= day.requiredHours ? t('day.fulfilled') : t('day.open')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        {/* Hours summary */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className={cn(
              'w-10 h-10 rounded-2xl flex items-center justify-center',
              day.isValid
                ? 'bg-emerald-50 dark:bg-emerald-900/20'
                : 'bg-amber-50 dark:bg-amber-900/20',
            )}
          >
            <Clock
              className={cn(
                'w-5 h-5',
                day.isValid
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400',
              )}
            />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-bold text-xl text-otis-800 dark:text-white">
                {day.totalHours.toFixed(1)}h
              </span>
              <span className="text-sm text-gray-400 dark:text-stone-300">
                / {day.requiredHours}h
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-32 h-1.5 rounded-full bg-otis-200/30 dark:bg-white/5 mt-1 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  day.isValid
                    ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
                    : 'bg-gradient-to-r from-amber-400 to-amber-500',
                )}
                style={{ width: `${Math.min(day.totalHours / day.requiredHours, 1) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Lunch info */}
        <div className="flex items-center gap-1.5 mb-3">
          <UtensilsCrossed
            className={cn(
              'w-4 h-4',
              day.hasLunch && day.lunchMinutes >= 30 && day.lunchMinutes <= 60
                ? 'text-emerald-500'
                : 'text-red-400',
            )}
          />
          <span
            className={cn(
              'text-sm',
              day.hasLunch ? 'text-gray-600 dark:text-stone-300' : 'text-red-500',
            )}
          >
            {day.hasLunch
              ? t('day.pause', { min: Math.round(day.lunchMinutes) })
              : t('day.no.pause')}
          </span>
          {day.hasLunch && (day.lunchMinutes < 30 || day.lunchMinutes > 60) && (
            <span className="text-xs text-amber-500 font-medium">
              ({day.lunchMinutes < 30 ? t('day.too.short') : t('day.too.long')})
            </span>
          )}
        </div>

        {/* Zone info */}
        {day.maxZone > 0 && (
          <div className="flex items-center gap-1.5 mb-3">
            <MapPin className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">
              {t('day.zone', { n: day.maxZone })}
            </span>
          </div>
        )}

        {/* Spesen button */}
        {onOpenExpenses && (
          <button
            type="button"
            onClick={() => onOpenExpenses(day.date, day.dayName)}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border transition-all duration-150 mb-3 bg-white/50 dark:bg-white/5 border-amber-200/30 dark:border-amber-700/20 hover:border-amber-300/50 hover:bg-amber-50/30 dark:hover:bg-amber-900/10"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <Euro className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-600 dark:text-stone-300">
                {t('day.spesen')}
              </span>
              {expenseCount !== undefined && expenseCount > 0 && (
                <Badge variant="info" size="sm">
                  {expenseCount}
                </Badge>
              )}
              {expenseCount !== undefined && expenseCount === 0 && (
                <span className="text-[10px] text-gray-400 dark:text-stone-300">
                  {t('day.spesen.none')}
                </span>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-stone-300" />
          </button>
        )}

        {/* Entries timeline */}
        {day.entries.length > 0 && (
          <div className="mt-3">
            <div className="bg-white/40 dark:bg-otis-900/30 rounded-xl border border-otis-100/20 dark:border-otis-700/30">
              <TimelineView
                entries={day.entries}
                onEditEntry={onEditEntry}
                onDeleteEntry={onDeleteEntry}
                showActions={true}
              />
            </div>
          </div>
        )}

        {/* Errors/Warnings */}
        {day.errors.length > 0 && (
          <div className="mt-3 space-y-1 bg-red-50/50 dark:bg-red-900/10 rounded-xl p-3 border border-red-200/30 dark:border-red-700/20">
            {day.errors.map((error, i) => (
              <div
                key={i}
                className="flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400"
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{t(error.key, error.params)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
