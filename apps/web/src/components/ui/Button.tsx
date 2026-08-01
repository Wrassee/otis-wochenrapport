import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const variants = {
  default:
    'bg-otis-800 text-white hover:bg-otis-700 active:bg-otis-900 shadow-lg shadow-otis-800/20',
  primary:
    'bg-otis-600 text-white hover:bg-otis-500 active:bg-otis-700 shadow-lg shadow-otis-600/25',
  secondary: 'glass hover:glass-hover text-gray-800 dark:text-white/90 active:scale-[0.98]',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 shadow-lg shadow-emerald-600/20',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 shadow-lg shadow-red-600/20',
  warning:
    'bg-amber-500 text-white hover:bg-amber-600 active:bg-amber-700 shadow-lg shadow-amber-500/20',
  ghost: 'bg-transparent hover:bg-white/10 text-gray-700 dark:text-gray-300',
  outline:
    'border-2 border-otis-400/50 text-otis-600 dark:text-otis-300 dark:border-otis-400/30 bg-transparent hover:bg-otis-50 dark:hover:bg-otis-800/30 active:scale-[0.98]',
}

const sizes = {
  sm: 'h-10 px-3 text-sm rounded-xl gap-1.5',
  default: 'h-14 px-5 text-base rounded-2xl gap-2',
  lg: 'h-16 px-6 text-lg rounded-2xl gap-2',
  xl: 'h-20 px-8 text-xl rounded-3xl gap-3',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  fullWidth?: boolean
  glow?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'default',
      size = 'default',
      fullWidth,
      glow,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center font-semibold transition-all duration-200 select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-otis-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-otis-900',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
          'active:scale-[0.97]',
          variants[variant],
          sizes[size],
          fullWidth && 'w-full',
          glow && 'animate-pulse-glow',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
