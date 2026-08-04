import { useState } from 'react'
import type { ActivityCode } from '@/lib/types'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/lib/useTranslation'
import type { TranslationKey } from '@/lib/translations'
import { Wrench, XCircle, Clock, Check, ChevronDown } from 'lucide-react'

interface ActivityPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (code: ActivityCode) => void
  codes: ActivityCode[]
  selectedCode?: string | null
}

/** Activity code groups — merges similar codes into a single option */
const CODE_GROUPS: Record<string, Array<{ label: string; codeIds: string[] }>> = {
  productive: [
    { label: 'NK/S/T', codeIds: ['NK', 'S', 'T'] },
    { label: 'T Clot', codeIds: ['T_CLOT'] },
    { label: 'O', codeIds: ['O'] },
    { label: 'QI', codeIds: ['QI'] },
    { label: 'VM', codeIds: ['VM'] },
    { label: 'VP', codeIds: ['VP'] },
    { label: 'NM/NTC/NF/VC', codeIds: ['NM', 'NTC', 'NF', 'VC'] },
    { label: 'QI SCOTT', codeIds: ['QI_SCOTT'] },
  ],
  non_productive: [
    { label: 'I04', codeIds: ['I04'] },
    { label: 'I5S', codeIds: ['I5S'] },
    { label: 'I5Q', codeIds: ['I5Q'] },
    { label: 'I5T', codeIds: ['I5T'] },
    { label: 'I5A', codeIds: ['I5A'] },
  ],
  absence: [
    { label: 'A01', codeIds: ['A01'] },
    { label: 'A02', codeIds: ['A02'] },
    { label: 'A03', codeIds: ['A03'] },
    { label: 'A04', codeIds: ['A04'] },
    { label: 'A05', codeIds: ['A05'] },
    { label: 'A06', codeIds: ['A06'] },
    { label: 'A07', codeIds: ['A07'] },
  ],
}

function getCategoryConfig(t: (k: TranslationKey) => string) {
  return {
    productive: {
      label: t('activity.productive'),
      sublabel: t('activity.productive.sublabel'),
      icon: Wrench,
      color: 'text-otis-600 dark:text-otis-400',
      selectedBg: 'bg-otis-50/80 dark:bg-otis-900/40',
      selectedBorder: 'border-otis-300/60 dark:border-otis-600/40',
      selectedRing: 'ring-otis-400',
      highlight: 'bg-otis-500/10 dark:bg-otis-500/20 border-otis-300/30 dark:border-otis-600/30',
      gradient: 'from-otis-50 to-otis-100/50 dark:from-otis-900/30 dark:to-otis-800/20',
    },
    non_productive: {
      label: t('activity.nonproductive'),
      sublabel: t('activity.nonproductive.sublabel'),
      icon: XCircle,
      color: 'text-amber-600 dark:text-amber-400',
      selectedBg: 'bg-amber-50/80 dark:bg-amber-900/40',
      selectedBorder: 'border-amber-300/60 dark:border-amber-600/40',
      selectedRing: 'ring-amber-400',
      highlight:
        'bg-amber-500/10 dark:bg-amber-500/20 border-amber-300/30 dark:border-amber-600/30',
      gradient: 'from-amber-50 to-amber-100/50 dark:from-amber-900/30 dark:to-amber-800/20',
    },
    absence: {
      label: t('activity.absence'),
      sublabel: t('activity.absence.sublabel'),
      icon: Clock,
      color: 'text-purple-600 dark:text-purple-400',
      selectedBg: 'bg-purple-50/80 dark:bg-purple-900/40',
      selectedBorder: 'border-purple-300/60 dark:border-purple-600/40',
      selectedRing: 'ring-purple-400',
      highlight:
        'bg-purple-500/10 dark:bg-purple-500/20 border-purple-300/30 dark:border-purple-600/30',
      gradient: 'from-purple-50 to-purple-100/50 dark:from-purple-900/30 dark:to-purple-800/20',
    },
  }
}

export function ActivityPicker({
  open,
  onClose,
  onSelect,
  codes,
  selectedCode,
}: ActivityPickerProps) {
  const { t } = useTranslation()
  const categoryConfig = getCategoryConfig(t)
  const categories = ['productive', 'non_productive', 'absence'] as const

  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    productive: true,
    non_productive: false,
    absence: false,
  })

  const toggleCategory = (cat: string) => {
    setExpanded((prev) => ({ ...prev, [cat]: !prev[cat] }))
  }

  /** Check if any code in a group's IDs matches the currently selected code */
  const groupIsSelected = (codeIds: string[]): boolean => {
    if (!selectedCode) return false
    return codeIds.some((id) => {
      const codeObj = codes.find((c) => c.id === id)
      return codeObj?.code === selectedCode
    })
  }

  /** Handle selecting a group: find the first code in the group and select it */
  const handleGroupSelect = (codeIds: string[]) => {
    const firstCode = codes.find((c) => c.id === codeIds[0])
    if (firstCode) onSelect(firstCode)
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('entry.activity.picker.title')}>
      <div className="space-y-2 pb-8">
        {categories.map((category) => {
          const config = categoryConfig[category]
          const groups = CODE_GROUPS[category] || []
          const Icon = config.icon
          const isOpen = expanded[category]
          const hasAnySelected = groups.some((g) => groupIsSelected(g.codeIds))

          return (
            <div key={category} className="overflow-hidden">
              {/* Clickable header */}
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className={cn(
                  'w-full flex items-center gap-2.5 p-3 rounded-xl transition-all duration-150 border',
                  isOpen || hasAnySelected
                    ? `${config.highlight}`
                    : 'glass dark:glass-dark border-transparent hover:border-otis-300/20',
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br flex-shrink-0',
                    config.gradient,
                  )}
                >
                  <Icon className={cn('w-4 h-4', config.color)} />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className={cn('font-semibold text-sm', config.color)}>
                      {config.label}
                    </span>
                    <span className="text-[9px] text-gray-400 dark:text-stone-400 font-medium">
                      {config.sublabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-400 dark:text-stone-300">
                      {t('activity.options', { n: groups.length })}
                    </span>
                    {hasAnySelected && (
                      <span className="text-[9px] font-medium text-otis-500 bg-otis-500/10 px-1.5 py-0.5 rounded-full">
                        {selectedCode}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-gray-400 dark:text-stone-300 transition-transform duration-200 flex-shrink-0',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>

              {/* Collapsible content — renders groups instead of individual codes */}
              <div
                className={cn(
                  'transition-all duration-200 ease-in-out overflow-hidden',
                  isOpen ? 'max-h-[600px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0',
                )}
              >
                <div className="grid grid-cols-2 gap-1.5 px-0.5">
                  {groups.map((group) => {
                    const isSelected = groupIsSelected(group.codeIds)
                    // First letter of the group label for the icon badge
                    const badgeLetter = group.label.charAt(0)

                    return (
                      <button
                        key={group.label}
                        onClick={() => handleGroupSelect(group.codeIds)}
                        className={cn(
                          'flex items-center justify-between p-2.5 rounded-xl border transition-all duration-150',
                          'min-h-[44px] relative overflow-hidden group',
                          isSelected
                            ? `${config.selectedBg} ${config.selectedBorder} ring-2 ${config.selectedRing} ring-offset-1 dark:ring-offset-otis-900`
                            : 'glass dark:glass-dark border-otis-200/20 dark:border-white/5 hover:border-otis-300/30',
                        )}
                      >
                        <div className="flex items-center gap-2 relative z-10 min-w-0">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                              isSelected
                                ? `${config.color} bg-white dark:bg-white/20`
                                : 'bg-white/60 dark:bg-white/10 text-gray-500 dark:text-stone-400',
                            )}
                          >
                            {badgeLetter}
                          </div>
                          <span
                            className={cn(
                              'font-semibold text-xs truncate',
                              isSelected ? config.color : 'text-otis-800 dark:text-white/80',
                            )}
                          >
                            {group.label}
                          </span>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-otis-500 flex items-center justify-center relative z-10 shadow-sm flex-shrink-0">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </BottomSheet>
  )
}
