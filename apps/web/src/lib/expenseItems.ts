import { Clock, Bed, Car, RadioTower, Coins, Wrench, CarFront, type LucideIcon } from 'lucide-react'
import type { ExpenseType } from '@/lib/types'

/**
 * Per-type visual identity for Spesen items — one shared source so the
 * ExpenseEditor (bottom sheet) and SpesenPage render identical colorful
 * icons. Each type keeps its own hue (chip bg + icon color) in both light
 * and dark mode.
 */
export interface ExpenseItemStyle {
  icon: LucideIcon
  /** Tinted chip container classes (bg + icon color, light & dark). */
  chip: string
}

export const EXPENSE_ITEM_STYLES: Record<ExpenseType, ExpenseItemStyle> = {
  entschaedigung_10h: {
    icon: Clock,
    chip: 'bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  },
  hotel: {
    icon: Bed,
    chip: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  },
  transport: {
    icon: Car,
    chip: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  },
  pikettdienst: {
    icon: RadioTower,
    chip: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  },
  entschaedigung_pikett: {
    icon: Coins,
    chip: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400',
  },
  material: {
    icon: Wrench,
    chip: 'bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400',
  },
  privatfahrzeug: {
    icon: CarFront,
    chip: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
  },
}
