import type { FavoriteLocation } from '@/lib/types'
import { MapPin, History, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/lib/useTranslation'
import { calculateZone, haversineDistance } from '@/lib/utils'
import { getZoneReference } from '@/lib/zoneReference'

interface FavoriteLiftsProps {
  favorites: FavoriteLocation[]
  onSelect: (favorite: FavoriteLocation) => void
}

export function FavoriteLifts({ favorites, onSelect }: FavoriteLiftsProps) {
  const { t } = useTranslation()
  // Zone origin (profile override or Dietlikon default) — constant per render.
  const zoneRef = getZoneReference()
  // Sort by use_count descending (most used first)
  const sorted = [...favorites].sort((a, b) => (b.use_count || 0) - (a.use_count || 0))

  if (sorted.length === 0) return null

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-otis-400 dark:text-otis-300 uppercase tracking-wider">
        <History className="w-3.5 h-3.5" />
        <span>{t('favorites.title')}</span>
        <div className="flex-1 h-px bg-gradient-to-r from-otis-200/50 to-transparent dark:from-white/5" />
      </div>

      {/* Scrollable container with fade overlay */}
      <div className="relative">
        {/* Fade gradient on the right edge */}
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-1 w-10 z-10"
          style={{
            background: 'linear-gradient(to left, rgba(255,255,255,0.85) 0%, transparent 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-1 w-10 z-10 hidden dark:block"
          style={{
            background: 'linear-gradient(to left, rgba(13,20,35,0.85) 0%, transparent 100%)',
          }}
        />

        <div
          className="flex gap-2.5 overflow-x-auto pb-1 snap-x snap-mandatory"
          style={{
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {sorted.map((fav, i) => (
            <button
              key={fav.anlagenummer}
              onClick={() => onSelect(fav)}
              className={cn(
                'flex-shrink-0 flex flex-col items-start gap-1.5 p-3.5 min-w-[150px] max-w-[200px] snap-start',
                'glass-card dark:glass-card-dark rounded-2xl',
                'hover:border-otis-400/40 dark:hover:border-otis-400/30',
                'active:scale-[0.97] transition-all duration-200',
                'relative overflow-hidden group',
              )}
            >
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-otis-50/50 to-transparent dark:from-otis-800/20 dark:to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Position indicator */}
              <div className="absolute top-1.5 right-2 text-[9px] font-bold text-otis-300/40 dark:text-otis-600/40">
                #{i + 1}
              </div>

              <span className="font-bold text-sm text-otis-700 dark:text-otis-300 relative z-10">
                {fav.anlagenummer}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-stone-300 truncate max-w-[160px] relative z-10 font-medium">
                {fav.project_id}
              </span>
              <div className="flex items-start gap-1 text-[10px] text-gray-400 dark:text-stone-400 relative z-10">
                <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span className="text-pretty break-words leading-snug max-w-[160px]">
                  {fav.full_address}
                </span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 relative z-10">
                <TrendingUp className="w-2.5 h-2.5 text-otis-400/50" />
                <span className="text-[9px] text-otis-400/50 font-medium">
                  {(() => {
                    // A stored zone is only trustworthy with a manual override
                    // — the auto zone is ALWAYS recomputed from the coordinates
                    // and the current reference point (a stale stored zone,
                    // e.g. a Z0→Z1 default leftover, is never shown).
                    const hasCoords = fav.latitude && fav.longitude
                    const zone =
                      fav.manual_zone !== undefined
                        ? fav.manual_zone
                        : hasCoords
                          ? calculateZone(
                              haversineDistance(
                                zoneRef.lat,
                                zoneRef.lon,
                                fav.latitude,
                                fav.longitude,
                              ),
                            )
                          // No coordinates → zone unknown; show 'Auto' rather
                          // than fabricating a misleading Z1.
                          : 0
                    return zone > 0 ? `Zone ${zone}` : t('lifts.zone.auto.short')
                  })()}
                  {fav.manual_zone !== undefined && (
                    <span className="text-[8px] ml-0.5 text-amber-500 font-bold">✦</span>
                  )}
                </span>
              </div>
              {/* Use count badge */}
              <div className="absolute bottom-1.5 right-2 text-[8px] font-semibold text-otis-400/40 dark:text-otis-600/40 z-10">
                {fav.use_count}x
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
