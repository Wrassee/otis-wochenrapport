import type { TimeEntry } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { Clock, Plus, Zap } from 'lucide-react'
import { decimalToTime, formatOtisDuration } from '@/lib/utils'
import { useTranslation } from '@/lib/useTranslation'

interface QuickAddProps {
  entries: TimeEntry[]
  onQuickAdd: (entry: TimeEntry, extraHours: number) => Promise<void>
}

export function QuickAdd({ entries, onQuickAdd }: QuickAddProps) {
  const { t } = useTranslation()
  const eligibleEntries = entries.filter((e) => !e.is_lunch && e.synced !== undefined)

  if (eligibleEntries.length === 0) return null

  return (
    <Card>
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-otis-800 dark:text-white text-sm">{t('dashboard.quickadd.title')}</h3>
          <p className="text-[10px] text-gray-400">{t('dashboard.quickadd.subtitle')}</p>
        </div>
      </div>
      <div className="space-y-2">
        {eligibleEntries.slice(-3).reverse().map((entry) => (
          <div key={entry.id} className="flex items-center justify-between p-3.5 bg-otis-50/50 dark:bg-white/3 rounded-2xl border border-otis-200/20 dark:border-white/5 group hover:border-otis-300/30 transition-all duration-200">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-otis-800 dark:text-white">{entry.location_anlagenummer || '—'}</span>
                {entry.activity_code && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-otis-100/50 dark:bg-otis-800/50 text-otis-600 dark:text-otis-300 font-medium">{entry.activity_code}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Clock className="w-3 h-3 text-gray-400" />
                <p className="text-xs text-gray-500">
                  {decimalToTime(entry.start_time)} – {formatOtisDuration(entry.duration)}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5 flex-shrink-0 ml-3">
              <button
                onClick={() => onQuickAdd(entry, 0.5)}
                className="flex items-center gap-1 px-3 h-9 rounded-xl glass dark:glass-dark text-otis-600 dark:text-otis-300 font-semibold text-xs hover:bg-otis-100 dark:hover:bg-otis-800/30 transition-all active:scale-95"
              >
                <Plus className="w-3 h-3" />0.5h
              </button>
              <button
                onClick={() => onQuickAdd(entry, 1.0)}
                className="flex items-center gap-1 px-3 h-9 rounded-xl glass dark:glass-dark text-otis-600 dark:text-otis-300 font-semibold text-xs hover:bg-otis-100 dark:hover:bg-otis-800/30 transition-all active:scale-95"
              >
                <Plus className="w-3 h-3" />1h
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
