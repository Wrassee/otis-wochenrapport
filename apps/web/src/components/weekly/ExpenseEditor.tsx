import type { DailyExpensesMap, ExpenseType } from '@/lib/types'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/lib/useTranslation'
import { cn } from '@/lib/cn'
import { Euro } from 'lucide-react'

interface ExpenseEditorProps {
  open: boolean
  onClose: () => void
  date: string
  dayName: string
  dailyExpenses: DailyExpensesMap
}

export function ExpenseEditor({ open, onClose, date, dayName, dailyExpenses }: ExpenseEditorProps) {
  const { t } = useTranslation()
  const { toggleExpense, setExpenseValue } = useAppStore()
  const dayExp = dailyExpenses[date] || []

  const EXPENSE_ITEMS: { type: ExpenseType; label: string; icon: string; hasValue?: boolean; valueUnit?: string }[] = [
    { type: 'entschaedigung_10h', label: t('spesen.10h'), icon: '⏰' },
    { type: 'hotel', label: t('spesen.hotel'), icon: '🏨' },
    { type: 'transport', label: t('spesen.transport'), icon: '🚗' },
    { type: 'pikettdienst', label: t('spesen.pikett'), icon: '📟' },
    { type: 'entschaedigung_pikett', label: t('spesen.pikett.ent'), icon: '💰' },
    { type: 'material', label: t('spesen.material'), icon: '🔧', hasValue: true, valueUnit: 'CHF' },
    { type: 'privatfahrzeug', label: t('spesen.privat'), icon: '🚙', hasValue: true, valueUnit: 'km' },
  ]

  return (
    <BottomSheet open={open} onClose={onClose} title={t('day.spesen.editor.title', { day: dayName })}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
          <Euro className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-xs text-gray-400">{date}</p>
          <p className="text-[11px] text-gray-500">{t('day.spesen.count', { n: dayExp.length })}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {EXPENSE_ITEMS.map((item) => {
          const exp = dayExp.find((e: any) => e.expense_type === item.type)
          const isActive = !!exp
          return (
            <div key={item.type} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleExpense(date, item.type)}
                className={cn(
                  'flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150 border min-h-[48px]',
                  'flex-1 text-left',
                  isActive
                    ? 'bg-otis-50 dark:bg-otis-900/30 border-otis-300/60 dark:border-otis-600/40 text-otis-700 dark:text-otis-300 shadow-sm'
                    : 'bg-white/50 dark:bg-white/5 border-gray-200/50 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-otis-200/50 hover:text-otis-600'
                )}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {isActive ? (
                  <Badge variant="info" size="sm">{t('spesen.active')}</Badge>
                ) : (
                  <span className="text-[11px] text-gray-300 dark:text-gray-600">{t('spesen.inactive')}</span>
                )}
              </button>

              {/* Value input for expenses that need it (Material, Privatfahrzeug) */}
              {isActive && item.hasValue && (
                <div className="w-24 flex-shrink-0">
                  <input
                    type="number"
                    min="0"
                    step={item.valueUnit === 'CHF' ? '0.50' : '1'}
                    value={exp?.value ?? (item.valueUnit === 'km' ? 10 : 0)}
                    onChange={(e) => {
                      const val = item.valueUnit === 'CHF' ? parseFloat(e.target.value) || 0 : parseInt(e.target.value) || 0
                      setExpenseValue(date, item.type, Math.max(0, val))
                    }}
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

      <p className="text-[10px] text-gray-400 mt-4 text-center">
        {t('day.spesen.editor.hint')}
      </p>
    </BottomSheet>
  )
}
