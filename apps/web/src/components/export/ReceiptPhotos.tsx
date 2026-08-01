import { useState } from 'react'
import { useTranslation } from '@/lib/useTranslation'
import { Card } from '@/components/ui/Card'
import { Paperclip, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ExpensePhoto } from '@/lib/types'

interface ReceiptPhotosProps {
  photos: ExpensePhoto[]
  /** compact: renders only the thumbnail grid (no Card wrapper / header) */
  compact?: boolean
  /** grid columns for the thumbnail strip (default 4) */
  cols?: 2 | 3 | 4
}

/**
 * Receipt-photo strip with a fullscreen lightbox preview.
 *
 * Used by the Export page (card layout) and by Dashboard/Woche (compact
 * inline strip) — all read the same store-backed photos list.
 */
export function ReceiptPhotos({ photos, compact = false, cols = 4 }: ReceiptPhotosProps) {
  const { t } = useTranslation()
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  if (photos.length === 0) return null

  const current = previewIndex !== null ? photos[previewIndex] : null

  const showPrev = () => {
    if (previewIndex === null) return
    setPreviewIndex((previewIndex - 1 + photos.length) % photos.length)
  }
  const showNext = () => {
    if (previewIndex === null) return
    setPreviewIndex((previewIndex + 1) % photos.length)
  }

  const strip = (
    <div className={cn('grid gap-2', cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-4')}>
      {photos.map((photo, idx) => (
        <button
          key={photo.id}
          type="button"
          onClick={() => setPreviewIndex(idx)}
          className="relative w-full aspect-square min-h-0 rounded-lg overflow-hidden border border-otis-200/20 dark:border-white/10 bg-otis-100/30 dark:bg-otis-900/30 p-0 transition-transform active:scale-95"
          title={photo.note || photo.filename}
        >
          <img
            src={photo.dataUrl}
            alt={photo.filename}
            className="w-full h-full object-cover"
          />
          {photo.note && (
            <span className="absolute bottom-0 inset-x-0 px-1 py-0.5 bg-black/55 text-white text-[7px] leading-tight truncate">
              {photo.note}
            </span>
          )}
        </button>
      ))}
    </div>
  )

  return (
    <>
      {compact ? (
        strip
      ) : (
        <Card>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-rose-500" />
              <span className="text-sm font-semibold text-otis-800 dark:text-white">
                {t('export.attachments', { n: photos.length })}
              </span>
            </div>
          </div>
          {strip}
        </Card>
      )}

      {/* Fullscreen lightbox preview */}
      {current && previewIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-black/95 animate-fade-in"
          onClick={() => setPreviewIndex(null)}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 pt-4">
            <span className="text-xs font-medium text-white/60">
              {previewIndex + 1} / {photos.length}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setPreviewIndex(null) }}
              className="w-10 h-10 min-h-0 rounded-full bg-white/10 text-white flex items-center justify-center transition-colors hover:bg-white/20 active:scale-95"
              title={t('export.photo.close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center min-h-0 px-4 py-3">
            <img
              src={current.dataUrl}
              alt={current.filename}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Caption / note */}
          <div className="px-6 pb-8 text-center" onClick={(e) => e.stopPropagation()}>
            {current.note && (
              <p className="text-sm font-medium text-white/90 mb-1">{current.note}</p>
            )}
            <p className="text-[11px] text-white/50 truncate">{current.filename}</p>
          </div>

          {/* Prev / Next */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); showPrev() }}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 min-h-0 rounded-full bg-white/10 text-white flex items-center justify-center transition-colors hover:bg-white/20 active:scale-95"
                title={t('export.photo.prev')}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); showNext() }}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 min-h-0 rounded-full bg-white/10 text-white flex items-center justify-center transition-colors hover:bg-white/20 active:scale-95"
                title={t('export.photo.next')}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
