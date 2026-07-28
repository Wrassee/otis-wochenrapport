import { useTranslation } from '@/lib/useTranslation'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { useDailyExpenses } from '@/hooks/useDailyExpenses'
import { getWeekDates, getToday, getWeekInfo } from '@/lib/utils'
import { Euro, Check, X } from 'lucide-react'

const EXPENSE_ITEMS = [
  { type: 'entschaedigung_10h' as const, labelKey: 'spesen.10h', icon: '⏰' },
  { type: 'hotel' as const, labelKey: 'spesen.hotel', icon: '🏨' },
  { type: 'transport' as const, labelKey: 'spesen.transport', icon: '🚗' },
  { type: 'pikettdienst' as const, labelKey: 'spesen.pikett', icon: '📟' },
  { type: 'entschaedigung_pikett' as const, labelKey: 'spesen.pikett.ent', icon: '💰' },
  { type: 'material' as const, labelKey: 'spesen.material', icon: '🔧', hasValue: true, valueUnit: 'CHF' },
  { type: 'privatfahrzeug' as const, labelKey: 'spesen.privat', icon: '🚙', hasValue: true, valueUnit: 'km' },
]

export function SpesenPage() {
  const { t } = useTranslation()

  const today = getToday()
  const weekInfo = getWeekInfo(today)
  const dates = getWeekDates(weekInfo.year, weekInfo.week)
  const dayNames = t('week.days').split(' | ')

  const { dailyExpenses, toggleExpense, setExpenseValue, syncExpenses } = useDailyExpenses(dates)

  const totalActive = Object.values(dailyExpenses).reduce((sum, exps) => sum + exps.length, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Euro className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-otis-800 dark:text-white">{t('day.spesen')}</h2>
          <p className="text-xs text-gray-400">
            {t('week.title', { number: weekInfo.week })} — {t('day.spesen.count', { n: totalActive })}
          </p>
        </div>
        <Badge variant="info" size="sm">{totalActive}</Badge>
      </div>

      {/* Info banner */}
      <div className="p-3.5 bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur rounded-2xl border border-amber-200/40 dark:border-amber-700/30">
        <p className="text-xs text-amber-600 dark:text-amber-300 font-medium">
          {t('day.spesen.editor.hint')}
        </p>
      </div>

      {/* Per-day expense cards */}
      {dates.map((date, idx) => {
        const dayExp = dailyExpenses[date] || []
        const dayName = dayNames[idx]

        return (
          <Card key={date}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold',
                  dayExp.length > 0
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'bg-otis-100/50 dark:bg-otis-800/30 text-gray-400 dark:text-gray-500'
                )}>
                  {dayName}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-otis-800 dark:text-white">{dayName}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{date.slice(5)}</span>
                  </div>
                  {dayExp.length > 0 && (
                    <p className="text-[10px] text-amber-500 font-medium">
                      {t('day.spesen.count', { n: dayExp.length })}
                    </p>
                  )}
                </div>
              </div>
              {dayExp.length > 0 && (
                <Badge variant="info" size="sm">
                  <Check className="w-3 h-3 mr-0.5" />
                  {t('spesen.active')}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {EXPENSE_ITEMS.map((item) => {
                const exp = dayExp.find((e) => e.expense_type === item.type)
                const isActive = !!exp

                const handleToggle = () => {
                  toggleExpense(date, item.type)
                  syncExpenses()
                }

                const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                  const val = item.valueUnit === 'CHF'
                    ? parseFloat(e.target.value) || 0
                    : parseInt(e.target.value) || 0
                  setExpenseValue(date, item.type, Math.max(0, val))
                  syncExpenses()
                }

                return (
                  <div key={item.type} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggle}
                      className={cn(
                        'flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150 border min-h-[48px]',
                        'flex-1 text-left',
                        isActive
                          ? 'bg-otis-50 dark:bg-otis-900/30 border-otis-300/60 dark:border-otis-600/40 text-otis-700 dark:text-otis-300 shadow-sm'
                          : 'bg-white/50 dark:bg-white/5 border-gray-200/50 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-otis-200/50 hover:text-otis-600'
                      )}
                    >
                      <span className="text-lg">{item.icon}</span>
                      <span className="flex-1">{t(item.labelKey as any)}</span>
                      {isActive ? (
                        <Check className="w-4 h-4 text-otis-500" />
                      ) : (
                        <X className="w-4 h-4 text-gray-200 dark:text-gray-700" />
                      )}
                    </button>

                    {/* Value input for Material / Privatfahrzeug */}
                    {isActive && item.hasValue && (
                      <div className="w-24 flex-shrink-0">
                        <input
                          type="number"
                          min="0"
                          step={item.valueUnit === 'CHF' ? '0.50' : '1'}
                          value={exp?.value ?? (item.valueUnit === 'km' ? 10 : 0)}
                          onChange={handleValueChange}
                          className="w-full h-[48px] px-3 rounded-xl text-sm glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none text-center font-mono"
                          placeholder={item.valueUnit === 'CHF' ? '0.00' : '0'}
                        />
                        <p className="text-[9px] text-gray-400 text-center mt-0.5">{item.valueUnit}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {dayExp.length === 0 && (
              <p className="text-[11px] text-gray-400 text-center mt-3">
                {t('day.spesen.none')}
              </p>
            )}
          </Card>
        )
      })}
    </div>
  )
}
