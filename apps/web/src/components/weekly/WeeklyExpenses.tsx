import type { DailyExpensesMap } from '@/lib/types'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getWeekDates } from '@/lib/utils'
import { cn } from '@/lib/cn'
import { Euro } from 'lucide-react'
import { useTranslation } from '@/lib/useTranslation'

interface WeeklyExpensesProps {
  year: number
  weekNumber: number
  dailyExpenses: DailyExpensesMap
}

export function WeeklyExpenses({ year, weekNumber, dailyExpenses }: WeeklyExpensesProps) {
  const { t } = useTranslation()

  const EXPENSE_LABELS: Record<string, { label: string; icon: string; unit?: string }> = {
    entschaedigung_10h: { label: t('spesen.10h'), icon: '⏰' },
    hotel: { label: t('spesen.hotel'), icon: '🏨' },
    transport: { label: t('spesen.transport'), icon: '🚗' },
    pikettdienst: { label: t('spesen.pikett'), icon: '📟' },
    entschaedigung_pikett: { label: t('spesen.pikett.ent'), icon: '💰' },
    material: { label: t('spesen.material'), icon: '🔧', unit: 'CHF' },
    privatfahrzeug: { label: t('spesen.privat'), icon: '🚙', unit: 'km' },
  }
  const dates = getWeekDates(year, weekNumber)
  const dayNames = t('week.days').split(' | ')

  // Collect active expenses grouped by date
  const activeDays = dates
    .map((date, idx) => ({ date, dayName: dayNames[idx], dayIdx: idx, expenses: dailyExpenses[date] || [] }))
    .filter((d) => d.expenses.length > 0)

  const totalActive = activeDays.reduce((sum, d) => sum + d.expenses.length, 0)

  if (totalActive === 0) return null

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
          <Euro className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm text-otis-800 dark:text-white">{t('day.spesen')}</h3>
          <p className="text-[11px] text-gray-400">{t('day.spesen.count', { n: totalActive })}</p>
        </div>
        <Badge variant="info" size="sm">{totalActive}</Badge>
      </div>

      <div className="space-y-2">
        {activeDays.map((day) => (
          <div key={day.date} className="bg-white/40 dark:bg-white/[0.02] rounded-xl p-3 border border-otis-100/20 dark:border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">{day.dayName}</span>
              </div>
              <span className="text-xs text-gray-400">{day.date.slice(5)}</span>
              <Badge variant="info" size="sm">{day.expenses.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {day.expenses.map((exp: any) => {
                const cfg = EXPENSE_LABELS[exp.expense_type]
                if (!cfg) return null
                return (
                  <span
                    key={exp.expense_type}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-otis-50 dark:bg-otis-900/30 border border-otis-300/60 dark:border-otis-600/40 text-otis-700 dark:text-otis-300"
                  >
                    <span>{cfg.icon}</span>
                    <span>{cfg.label}</span>
                    {cfg.unit && (
                      <span className="ml-0.5 text-[10px] text-otis-500 font-mono">
                        {exp.value}{cfg.unit === 'CHF' ? '' : cfg.unit}
                        {cfg.unit === 'CHF' ? ` CHF` : ''}
                      </span>
                    )}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
