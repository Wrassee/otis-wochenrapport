import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'warning' | 'success' | 'danger' | 'glass' | 'dark'
  noPadding?: boolean
}

export function Card({ className, variant = 'default', noPadding, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl transition-all duration-200',
        variant === 'default' && 'glass-card dark:glass-card-dark',
        variant === 'glass' && 'glass dark:glass-dark',
        variant === 'dark' &&
          'bg-otis-800/10 dark:bg-white/5 border border-otis-200/20 dark:border-white/5',
        variant === 'outline' && 'bg-transparent border-2 border-otis-200/40 dark:border-white/10',
        variant === 'warning' &&
          'bg-amber-50/80 dark:bg-amber-950/70 backdrop-blur border-2 border-amber-300/60 dark:border-amber-700/50',
        variant === 'success' &&
          'bg-emerald-50/80 dark:bg-emerald-950/70 backdrop-blur border-2 border-emerald-300/60 dark:border-emerald-700/50',
        variant === 'danger' &&
          'bg-red-50/80 dark:bg-red-950/70 backdrop-blur border-2 border-red-300/60 dark:border-red-700/50',
        noPadding ? 'p-0' : 'p-5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between mb-3', className)} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-lg font-bold text-otis-800 dark:text-white', className)} {...props}>
      {children}
    </h3>
  )
}

export function CardContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  )
}
