import { type ReactNode, useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { X } from 'lucide-react'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  className?: string
}

export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-otis-900/30 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet — responsive: bottom on mobile, centered + rounded on desktop */}
      <div
        ref={sheetRef}
        className={cn(
          'relative w-full max-w-lg',
          'glass-card dark:glass-card-dark',
          'sm:rounded-2xl sm:max-h-[85vh] sm:mx-4',
          'rounded-t-3xl shadow-2xl animate-slide-up flex flex-col',
          'max-h-[90vh] overflow-hidden',
          className
        )}
      >
        {/* Handle bar + Title — always visible at top */}
        <div className="flex-shrink-0">
          <div className="sticky top-0 z-10 pt-3 pb-2 px-6 flex items-center justify-between glass dark:glass-dark rounded-t-3xl">
            <div className="flex-1" />
            <div className="w-10 h-1.5 rounded-full mx-auto bg-otis-200/50 dark:bg-white/20" />
            <button
              onClick={onClose}
              className="flex-1 flex justify-end"
              aria-label="Close"
            >
              <X className="w-6 h-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors" />
            </button>
          </div>

          {title && (
            <div className="px-6 pt-2 pb-3">
              <h2 className="text-xl font-bold text-otis-800 dark:text-white">{title}</h2>
            </div>
          )}
        </div>

        {/* Scrollable content area — min-h-0 is required so flex-1 can shrink below content height */}
        <div className="flex-1 overflow-y-auto px-6 min-h-0" style={{ paddingBottom: 'env(safe-area-inset-bottom, 48px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
