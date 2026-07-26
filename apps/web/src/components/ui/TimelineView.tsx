import { useMemo } from 'react'
import type { TimeEntry } from '@/lib/types'
import { decimalToTime, formatOtisDuration } from '@/lib/utils'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/lib/useTranslation'
import { UtensilsCrossed, Building2, Pencil, Trash2 } from 'lucide-react'

interface TimelineViewProps {
  entries: TimeEntry[]
  onEditEntry?: (entry: TimeEntry) => void
  onDeleteEntry?: (entryId: string) => void
  showActions?: boolean
}

const ROW_HEIGHT = 52 // px — touch-friendly tap target
const MIN_BAR_WIDTH_PCT = 2.5 // minimum % width so 15-min bars are visible

export function TimelineView({ entries, onEditEntry, onDeleteEntry, showActions = true }: TimelineViewProps) {
  const { t } = useTranslation()
  if (entries.length === 0) return null

  // Calculate dynamic time range from entries
  const { rangeStart, totalHours, hourLabels } = useMemo(() => {
    const allStarts = entries.map((e) => e.start_time)
    const allEnds = entries.map((e) => e.start_time + e.duration)
    const minS = Math.min(...allStarts)
    const maxE = Math.max(...allEnds)

    let start = Math.max(4, Math.floor(minS))
    let end = Math.min(20, Math.ceil(maxE))

    // Ensure at least 4 hours of range
    if (end - start < 4) {
      const mid = (start + end) / 2
      start = Math.max(4, Math.floor(mid - 2))
      end = Math.min(20, Math.ceil(mid + 2))
    }

    const hours = end - start
    const labels = Array.from({ length: hours }, (_, i) => start + i)

    return { rangeStart: start, totalHours: hours, hourLabels: labels }
  }, [entries])

  // Bar position calculator
  const barStyle = (startTime: number, duration: number) => {
    const left = ((startTime - rangeStart) / totalHours) * 100
    const width = (duration / totalHours) * 100
    return {
      left: `${left}%`,
      width: `${Math.max(width, MIN_BAR_WIDTH_PCT)}%`,
    }
  }

  return (
    <div className="select-none overflow-hidden">
      {/* Single scrollable container: ruler + content scroll together */}
      <div
        className="overflow-x-auto overscroll-x-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div style={{ minWidth: `${totalHours * 112}px` }}>
          {/* ⏱ Hour ruler */}
          <div className="h-7 flex items-end px-3 border-b border-otis-100/20 dark:border-white/5">
            {hourLabels.map((hour) => (
              <div
                key={hour}
                className="flex-shrink-0 flex items-end pb-0.5"
                style={{ width: `${100 / totalHours}%`, minWidth: '112px' }}
              >
                <span className="text-[10px] font-semibold text-otis-400 dark:text-otis-500 tracking-tight">
                  {hour.toString().padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>

          {/* Content area with grid lines and entries */}
          <div className="relative">
            {/* Vertical grid lines */}
            <div className="absolute inset-0 flex pointer-events-none px-3">
              {hourLabels.map((hour) => (
                <div
                  key={hour}
                  className="h-full border-l border-otis-100/15 dark:border-white/[0.04] flex-shrink-0"
                  style={{ width: `${100 / totalHours}%`, minWidth: '112px' }}
                />
              ))}
              <div className="border-r border-otis-100/15 dark:border-white/[0.04]" />
            </div>

            {/* Entry rows */}
            <div className="relative">
              {entries.map((entry) => {
                const isLunch = entry.is_lunch
                const endTime = entry.start_time + entry.duration
                const bar = barStyle(entry.start_time, entry.duration)
                return (
                <div
                  key={entry.id}
                  className={cn(
                    'relative flex items-center px-3 transition-colors duration-150',
                    !isLunch && 'hover:bg-otis-50/30 dark:hover:bg-white/[0.015]',
                    isLunch && 'hover:bg-amber-50/40 dark:hover:bg-amber-900/10'
                  )}
                  style={{ minHeight: ROW_HEIGHT }}
                >
                  {/* Horizontal bar — positioned via percentage */}
                  <div
                    className={cn(
                      'absolute rounded-full transition-all duration-150 shadow-sm',
                      isLunch
                        ? 'bg-gradient-to-r from-amber-400/85 to-amber-500/70 dark:from-amber-500/55 dark:to-amber-600/45'
                        : 'bg-gradient-to-r from-otis-500/85 to-otis-400/75 dark:from-otis-400/65 dark:to-otis-500/55'
                    )}
                    style={{
                      left: bar.left,
                      width: bar.width,
                      height: '30px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  />

                  {/* Entry info: icon + label + time + duration + actions — all inline */}
                  <div
                    className="flex items-center gap-1.5 relative z-10"
                    style={{ marginLeft: bar.left }}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        'w-6 h-6 rounded-xl flex items-center justify-center flex-shrink-0',
                        isLunch
                          ? 'bg-amber-100/80 dark:bg-amber-900/30'
                          : 'bg-otis-100/80 dark:bg-otis-800/30'
                      )}
                    >
                      {isLunch ? (
                        <UtensilsCrossed className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      ) : (
                        <Building2 className="w-3 h-3 text-otis-600 dark:text-otis-400" />
                      )}
                    </div>

                    {/* Text label — truncated */}
                    <span
                      className={cn(
                        'text-sm font-semibold truncate leading-none max-w-[80px]',
                        isLunch
                          ? 'text-amber-700 dark:text-amber-300'
                          : 'text-otis-700 dark:text-otis-300'
                      )}
                    >
                      {isLunch ? t('timeline.lunch') : (entry.location_anlagenummer || '—')}
                    </span>

                    {/* Time range — always visible */}
                    <span className={cn(
                      'text-[11px] font-medium whitespace-nowrap ml-1',
                      isLunch
                        ? 'text-amber-500 dark:text-amber-400'
                        : 'text-gray-400 dark:text-gray-500'
                    )}>
                      {decimalToTime(entry.start_time)}–{decimalToTime(endTime)}
                    </span>

                    {/* Duration badge */}
                    <span className={cn(
                      'text-[11px] font-bold whitespace-nowrap px-2 py-0.5 rounded-md',
                      isLunch
                        ? 'bg-amber-100/40 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                        : 'bg-otis-100/40 dark:bg-otis-800/20 text-otis-500 dark:text-otis-400'
                    )}>
                      {isLunch ? `${(entry.duration * 60).toFixed(0)} Min.` : formatOtisDuration(entry.duration)}
                    </span>

                    {/* Action buttons — for ALL entries including lunch */}
                    {showActions && (
                      <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                        {onEditEntry && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onEditEntry(entry) }}
                            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-otis-100/50 dark:hover:bg-otis-800/30 transition-all active:scale-90"
                            title={t('timeline.edit')}
                          >
                            <Pencil className="w-3.5 h-3.5 text-otis-400" />
                          </button>
                        )}
                        {onDeleteEntry && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id) }}
                            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-all active:scale-90"
                            title={t('timeline.delete')}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-400" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
