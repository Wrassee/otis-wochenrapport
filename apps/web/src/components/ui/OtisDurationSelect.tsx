import { useRef } from 'react'
import { cn } from '@/lib/cn'
import { formatOtisDuration } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface OtisDurationSelectProps {
  value: string
  onChange: (value: string) => void
  label?: string
  disabled?: boolean
  required?: boolean
}

/**
 * All valid OTIS duration values from 0.15 (15 min) to 24.00 (24 h) in 15-min steps.
 * Generated once at module scope with an integer counter to avoid float drift.
 */
const DURATION_OPTIONS: Array<{ otis: string; standard: number; display: string }> = []
for (let i = 1; i <= 96; i++) {
  const standard = i * 0.25
  const otis = formatOtisDuration(standard)
  if (standard >= 1) {
    const h = Math.floor(standard)
    const m = Math.round((standard - h) * 60)
    DURATION_OPTIONS.push({ otis, standard, display: `${h}h${m > 0 ? ` ${Math.round(m)}min` : ''}` })
  } else {
    DURATION_OPTIONS.push({ otis, standard, display: `${Math.round(standard * 60)}min` })
  }
}

/** Most frequently selected OTIS durations shown as quick chips */
const COMMON_CHIPS = ['0.30', '1.00', '1.30', '2.00', '4.00', '4.30']

export function OtisDurationSelect({ value, onChange, label, disabled, required }: OtisDurationSelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value)
  }

  const handleOpenPicker = () => {
    if (selectRef.current && typeof selectRef.current.showPicker === 'function') {
      selectRef.current.showPicker()
    } else {
      // Fallback: focus will show picker on mobile
      selectRef.current?.focus()
    }
  }

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-semibold text-otis-700 dark:text-otis-200 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        {/* Native <select> with appearance:none — styled like a glass input.
            On Android WebView the native picker still opens on tap even with appearance:none. */}
        <select
          ref={selectRef}
          value={value}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          className={cn(
            'appearance-none w-full h-14 pl-4 pr-12 rounded-2xl text-base',
            'glass-input dark:glass-input-dark',
            'text-otis-900 dark:text-white',
            'focus:outline-none focus:ring-2 focus:ring-otis-400/50',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'cursor-pointer'
          )}
        >
          {DURATION_OPTIONS.map((opt) => (
            <option key={opt.otis} value={opt.otis}>
              {opt.display}
            </option>
          ))}
        </select>

        {/* Custom chevron + current value overlay (pointer-events: none so taps pass through to <select>) */}
        <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <span className="text-sm font-bold text-otis-600 dark:text-otis-300 tabular-nums">{value}</span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Common-duration chips — tap to set instantly */}
      <div className="flex flex-wrap gap-1.5 mt-2">
        {COMMON_CHIPS.map((otis) => (
          <button
            key={otis}
            type="button"
            onClick={() => onChange(otis)}
            className={cn(
              'px-3 py-1 text-xs font-semibold rounded-lg border transition-all duration-150 active:scale-90',
              value === otis
                ? 'bg-otis-500/20 border-otis-400/40 text-otis-700 dark:text-otis-300'
                : 'bg-otis-50/50 dark:bg-white/5 border-otis-200/30 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-otis-300/40 dark:hover:border-white/20'
            )}
          >
            {otis}
          </button>
        ))}
        <button
          type="button"
          onClick={handleOpenPicker}
          className="px-3 py-1 text-xs font-semibold rounded-lg border border-otis-200/30 dark:border-white/10 text-otis-500 dark:text-otis-400 hover:border-otis-400/40 transition-all active:scale-90 bg-transparent"
        >
          + alle
        </button>
      </div>
    </div>
  )
}
