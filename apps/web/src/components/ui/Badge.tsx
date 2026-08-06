import { cn } from '@/lib/cn'
import type { HTMLAttributes } from 'react'

const variants = {
  default:
    'bg-white/50 text-gray-700 dark:bg-white/10 dark:text-gray-200 border border-otis-200/30 dark:border-white/10',
  success:
    'bg-emerald-50/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200/50',
  warning:
    'bg-amber-50/80 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200/50',
  danger: 'bg-red-50/80 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200/50',
  info: 'bg-otis-50/80 text-otis-700 dark:bg-otis-900/30 dark:text-otis-300 border border-otis-200/50',
  zone: 'glass text-otis-700 dark:text-otis-300 border-otis-200/30 dark:border-otis-700/30',
  premium: 'bg-gradient-to-r from-otis-600 to-otis-400 text-white shadow-sm',
}

const sizes = {
  sm: 'px-2 py-0.5 text-xs',
  default: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Badge({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center text-center font-semibold rounded-full backdrop-blur-sm',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}
