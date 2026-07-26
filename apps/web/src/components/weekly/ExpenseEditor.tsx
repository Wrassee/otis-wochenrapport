import { useState, useEffect, useRef } from 'react'
import type { DailyExpensesMap, ExpenseType } from '@/lib/types'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/lib/useTranslation'
import { cn } from '@/lib/cn'
import { Euro, CheckCircle2 } from 'lucide-react'

const SAVE_DEBOUNCE_MS = 500
const SAVED_VISIBLE_MS = 2000

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

  // Local value buffers for Material (CHF) and Privatfahrzeug (km)
  // so typing is instant — the debounced save syncs back to the store.
  const localValuesRef = useRef<Record<string, string>>({})
  const dateRef = useRef(date)
  dateRef.current = date
  const [localValues, setLocalValues] = useState<Record<string, string>>({})
  const [saveStatus, setSaveStatus] = useState<'saved' | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reset local state when the sheet opens or date changes
  // The cleanup function captures the OLD date, so pending values
  // are saved to the correct day before the transition.
  useEffect(() => {
    return () => {
      flushLocalValues()
      if (saveTimer.current) clearTimeout(saveTimer.current)
      setLocalValues({})
      setSaveStatus(null)
    }
  }, [open, date])

  // Debounced auto-save: whenever localValues changes, wait 600ms then flush
  useEffect(() => {
    const keys = Object.keys(localValues)
    if (keys.length === 0) return

    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus(null)

    saveTimer.current = setTimeout(() => {
      for (const [key, raw] of Object.entries(localValues)) {
        const [expType, valueUnit] = key.split('::')
        const val = valueUnit === 'CHF' ? parseFloat(raw) || 0 : parseInt(raw) || 0
        setExpenseValue(date, expType as ExpenseType, Math.max(0, val))
      }
      setLocalValues({})
      setSaveStatus('saved')

      // Clear the "saved" indicator after a moment
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => {
        setSaveStatus(null)
      }, SAVED_VISIBLE_MS)
    }, SAVE_DEBOUNCE_MS)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [localValues, date, setExpenseValue])

  // Flush pending values on unmount + cleanup timers
  // Uses refs to always have the latest values, even with [] closure
  useEffect(() => {
    return () => {
      flushLocalValues()
      if (saveTimer.current) clearTimeout(saveTimer.current)
      if (savedTimer.current) clearTimeout(savedTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Flush any pending local values to the store immediately. */
  const flushLocalValues = () => {
    const vals = localValuesRef.current
    const keys = Object.keys(vals)
    if (keys.length === 0) return
    const targetDate = dateRef.current
    for (const [key, raw] of Object.entries(vals)) {
      const [expType, valueUnit] = key.split('::')
      const val = valueUnit === 'CHF' ? parseFloat(raw) || 0 : parseInt(raw) || 0
      setExpenseValue(targetDate, expType as ExpenseType, Math.max(0, val))
    }
    localValuesRef.current = {}
    setLocalValues({})
  }

  const handleClose = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    flushLocalValues()
    onClose()
  }

  const handleToggle = (itemType: ExpenseType) => {
    toggleExpense(date, itemType)
    setSaveStatus(null)
  }

  const handleValueChange = (itemType: string, valueUnit: string | undefined, raw: string) => {
    const key = `${itemType}::${valueUnit}`
    localValuesRef.current[key] = raw
    setLocalValues((prev) => ({ ...prev, [key]: raw }))
  }

  const getValue = (itemType: string): string => {
    const exp = dayExp.find((e: any) => e.expense_type === itemType)
    const localKey = `${itemType}::${itemType === 'material' ? 'CHF' : 'km'}`
    if (localValues[localKey] !== undefined) return localValues[localKey]
    return exp?.value !== undefined ? String(exp.value) : ''
  }

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
    <BottomSheet open={open} onClose={handleClose} title={t('day.spesen.editor.title', { day: dayName })}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
          <Euro className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-400">{date}</p>
          <p className="text-[11px] text-gray-500">{t('day.spesen.count', { n: dayExp.length })}</p>
        </div>

        {/* Auto-save indicator */}
        <div className={cn(
          'flex items-center gap-1.5 transition-all duration-300',
          saveStatus === 'saved'
            ? 'opacity-100 translate-x-0'
            : 'opacity-0 translate-x-2 pointer-events-none'
        )}>
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            {t('common.saved')}
          </span>
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
                onClick={() => handleToggle(item.type)}
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
                    value={getValue(item.type)}
                    onChange={(e) => handleValueChange(item.type, item.valueUnit, e.target.value)}
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
