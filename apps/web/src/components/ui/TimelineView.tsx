import { useMemo, useRef, useEffect } from 'react'
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
  conflictEntryIds?: string[]
  /** Suppress the auto-scroll-to-conflict behaviour — used inside week day
   *  cards, where the red highlight should be visible without the page
   *  jumping to the entry on mount. */
  disableConflictScroll?: boolean
}

const ROW_HEIGHT = 52 // px — touch-friendly tap target
const MIN_BAR_WIDTH_PCT = 2.5 // minimum % width so 15-min bars are visible

export function TimelineView({
  entries,
  onEditEntry,
  onDeleteEntry,
  showActions = true,
  conflictEntryIds = [],
  disableConflictScroll = false,
}: TimelineViewProps) {
  const { t } = useTranslation()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevConflictRef = useRef<string[]>([])

  // Scroll to and highlight conflicting entries when conflictEntryIds changes
  useEffect(() => {
    // The highlight itself is pure render-time (isConflict below); the scroll
    // is optional (Dashboard wants it, week day cards don't).
    if (disableConflictScroll) return
    if (conflictEntryIds.length === 0) {
      prevConflictRef.current = []
      return
    }
    // Only act if the set of conflict IDs actually changed
    const sameIds =
      prevConflictRef.current.length === conflictEntryIds.length &&
      prevConflictRef.current.every((id) => conflictEntryIds.includes(id))
    if (sameIds) return

    prevConflictRef.current = conflictEntryIds

    // Small delay to let the DOM settle after re-render
    const timer = setTimeout(() => {
      const firstId = conflictEntryIds[0]
      const el = document.getElementById(`timeline-entry-${firstId}`)
      if (!el) return

      // Scroll the page so the entry row is visible
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Also scroll the horizontal container to show the time bar
      const scrollContainer = scrollContainerRef.current
      if (scrollContainer) {
        const rowEl = el.querySelector('[data-timeline-bar]')
        if (rowEl) {
          const rowRect = rowEl.getBoundingClientRect()
          const containerRect = scrollContainer.getBoundingClientRect()
          // If the time bar is outside the visible area, scroll to it
          if (rowRect.left < containerRect.left || rowRect.right > containerRect.right) {
            scrollContainer.scrollLeft += rowRect.left - containerRect.left - 16
          }
        }
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [conflictEntryIds, disableConflictScroll])

  // Calculate dynamic time range from entries (before the early return —
  // hooks must be called unconditionally or React crashes with "Rendered
  // fewer hooks than expected").
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

  if (entries.length === 0) return null

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
      {/* Single scrollable container: ruler + content scroll together */}{' '}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overscroll-x-contain timeline-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div style={{ minWidth: `${totalHours * 112}px` }}>
          {/* ⏱ Hour ruler */}
          <div className="h-7 flex items-end px-3 border-b border-otis-100/20 dark:border-white/5 flex-shrink-0">
            {hourLabels.map((hour) => (
              <div
                key={hour}
                className="flex-shrink-0 flex items-end pb-0.5"
                style={{ width: `${100 / totalHours}%`, minWidth: '112px' }}
              >
                <span className="text-[10px] font-semibold text-otis-500 dark:text-otis-300 tracking-tight">
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
                const isConflict = conflictEntryIds.includes(entry.id)
                return (
                  <div
                    key={entry.id}
                    id={`timeline-entry-${entry.id}`}
                    onClick={() => onEditEntry?.(entry)}
                    className={cn(
                      'relative flex items-center px-3 transition-colors duration-150 cursor-pointer',
                      !isLunch && 'hover:bg-otis-50/30 dark:hover:bg-white/[0.015]',
                      isLunch && 'hover:bg-amber-50/40 dark:hover:bg-amber-900/10',
                      isConflict && '!bg-red-50/50 dark:!bg-red-950/30',
                    )}
                    style={{ minHeight: ROW_HEIGHT }}
                  >
                    {/* Horizontal bar — positioned via percentage */}
                    <div
                      className={cn(
                        'absolute rounded-full transition-all duration-150 shadow-sm',
                        isLunch
                          ? 'bg-gradient-to-r from-amber-400/85 to-amber-500/70 dark:from-amber-500/55 dark:to-amber-600/45'
                          : 'bg-gradient-to-r from-otis-500 to-otis-600 dark:from-otis-400 dark:to-otis-500',
                        conflictEntryIds.includes(entry.id) &&
                          (isLunch
                            ? 'from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 ring-2 ring-red-300 dark:ring-red-600'
                            : 'from-red-500 to-red-600 dark:from-red-600 dark:to-red-700 ring-2 ring-red-300 dark:ring-red-600'),
                      )}
                      style={{
                        left: bar.left,
                        width: bar.width,
                        height: '30px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                      }}
                      data-timeline-bar
                    />

                    {/* Entry info: icon + label + time + duration + actions — all inline */}
                    <div
                      className="flex items-center gap-1.5 relative z-10"
                      style={{ marginLeft: bar.left }}
                    >
                      {/* Icon — prominent circle badge at the bar start */}
                      <div
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                          isLunch
                            ? 'bg-amber-100 dark:bg-amber-900/40'
                            : isConflict
                              ? 'bg-red-600'
                              : 'bg-otis-600',
                        )}
                      >
                        {isLunch ? (
                          <UtensilsCrossed className="w-4 h-4 text-amber-600 dark:text-amber-300" />
                        ) : (
                          <Building2 className="w-4 h-4 text-white" />
                        )}
                      </div>

                      {isLunch ? (
                        <>
                          {/* Text label — truncated */}
                          <span className="text-sm font-semibold truncate leading-none max-w-[80px] text-amber-700 dark:text-amber-200">
                            {t('timeline.lunch')}
                          </span>
                          {/* Time range — always visible */}
                          <span className="text-[11px] font-medium whitespace-nowrap ml-1 text-amber-600 dark:text-amber-300">
                            {decimalToTime(entry.start_time)}–{decimalToTime(endTime)}
                          </span>
                          {/* Duration badge */}
                          <span className="text-[11px] font-bold whitespace-nowrap px-2 py-0.5 rounded-md bg-amber-100/40 dark:bg-amber-900/20 text-amber-700 dark:text-amber-200">
                            {`${(entry.duration * 60).toFixed(0)} Min.`}
                          </span>
                        </>
                      ) : (
                        /* Solid pill — white text on the bar color, so entries
                           whose bar is shorter than the text (overflow) still
                           keep perfectly readable text in both themes */
                        <span
                          className={cn(
                            'flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1.5 text-white',
                            isConflict
                              ? 'bg-gradient-to-r from-red-500 to-red-600 dark:from-red-600 dark:to-red-700'
                              : 'bg-gradient-to-r from-otis-500 to-otis-600 dark:from-otis-400 dark:to-otis-500',
                          )}
                        >
                          <span className="text-sm font-semibold truncate leading-none max-w-[80px]">
                            {entry.location_anlagenummer || '—'}
                          </span>
                          <span className="text-[11px] font-medium whitespace-nowrap">
                            {decimalToTime(entry.start_time)}–{decimalToTime(endTime)}
                          </span>
                          <span className="text-[11px] font-bold whitespace-nowrap px-2 py-0.5 rounded-full bg-white/25">
                            {formatOtisDuration(entry.duration)}
                          </span>
                        </span>
                      )}

                      {/* Action buttons — for ALL entries including lunch */}
                      {showActions && (
                        <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                          {onEditEntry && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onEditEntry(entry)
                              }}
                              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-otis-100/50 dark:hover:bg-otis-800/30 transition-all active:scale-90"
                              title={t('timeline.edit')}
                            >
                              <Pencil className="w-3.5 h-3.5 text-otis-500" />
                            </button>
                          )}
                          {onDeleteEntry && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteEntry(entry.id)
                              }}
                              className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-red-50/50 dark:hover:bg-red-900/20 transition-all active:scale-90"
                              title={t('timeline.delete')}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
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
