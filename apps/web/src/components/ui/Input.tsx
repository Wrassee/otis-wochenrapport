import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-semibold text-otis-700 dark:text-otis-200 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full h-14 px-4 rounded-2xl text-base',
            'glass-input dark:glass-input-dark',
            'text-otis-900 dark:text-white',
            'placeholder:text-gray-500 dark:placeholder:text-stone-300',
            'focus:outline-none',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && '!border-red-400 !shadow-red-500/10',
            className,
          )}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-sm text-red-500 dark:text-red-400 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
            {error}
          </p>
        )}
        {hint && !error && <p className="mt-1 text-xs text-gray-500 dark:text-stone-300">{hint}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
