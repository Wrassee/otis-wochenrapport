import type { TranslationKey } from './translations'

export interface Profile {
  id: string
  email: string
  full_name: string
  personnel_number: string
  supervisor_email: string
  language: string
  created_at: string
  updated_at: string
}

export interface Location {
  id: string
  anlagenummer: string
  project_id: string
  full_address: string
  latitude: number
  longitude: number
  zone: number
  /** Manually overridden zone (set in Settings). Takes priority over auto-calculated zone. */
  manual_zone?: number
  created_at: string
}

export interface ActivityCode {
  id: string
  code: string
  category: 'productive' | 'non_productive' | 'absence'
  description_de: string
  description_fr: string
  description_it: string
  excel_column: string // J, K, L, M, N, O, P, Q, R
  sort_order: number
  created_at?: string
}

export interface TimeEntry {
  id: string
  user_id: string
  date: string // YYYY-MM-DD
  start_time: number // decimal hours (e.g. 7.3 = 07:30)
  duration: number // decimal hours (e.g. 4.3 = 4h30min)
  location_id: string | null
  activity_code_id: string | null
  activity_code: string | null // denormalized for quick access
  is_lunch: boolean
  notes: string
  synced: boolean
  created_at: string
  updated_at: string
  // Joined fields for display
  location_anlagenummer?: string
  location_project_id?: string
  location_address?: string
  location_zone?: number
}

export interface UserSettings {
  id: string
  user_id: string
  default_start_time: number // decimal hours
  supervisor_email: string
  created_at: string
  updated_at: string
}

export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'

/** A localized day-validation error: translation key + params (see week.error.*). */
export interface DayError {
  key: TranslationKey
  params?: Record<string, string | number>
}

export interface DaySummary {
  date: string
  dayName: string
  dayNumber: number // 1-5 for Mon-Fri
  totalHours: number
  lunchMinutes: number
  hasLunch: boolean
  entries: TimeEntry[]
  requiredHours: number // 8.5 for Mon-Thu, 8.0 for Fri
  isValid: boolean
  errors: DayError[]
  maxZone: number // highest zone for the day (Spesenrapport)
}

export interface WeekSummary {
  year: number
  weekNumber: number
  days: DaySummary[]
  totalHours: number
  startDate: string
  endDate: string
}

export interface FavoriteLocation {
  id?: string
  user_id?: string
  anlagenummer: string
  project_id: string
  full_address: string
  latitude: number
  longitude: number
  zone: number
  /** Manually overridden zone (set in Settings). Takes priority over auto-calculated zone. */
  manual_zone?: number
  last_used: string
  use_count: number
  created_at?: string
  updated_at?: string
}

/** Expense types available in the Spesenrapport */
export type ExpenseType =
  | 'entschaedigung_10h'
  | 'hotel'
  | 'transport'
  | 'pikettdienst'
  | 'entschaedigung_pikett'
  | 'material'
  | 'privatfahrzeug'

/** A single expense entry for a given date */
export interface DailyExpense {
  date: string // YYYY-MM-DD
  expense_type: ExpenseType
  value: number // 1 for most, km count for privatfahrzeug
}

/** Expenses grouped by date */
export type DailyExpensesMap = Record<string, DailyExpense[]>

export interface SyncStatus {
  online: boolean
  syncing: boolean
  pendingSync: number
  lastSync: string | null
}

/** A photographed receipt/invoice attached to the weekly report */
export interface ExpensePhoto {
  id: string
  user_id: string
  year: number
  week: number
  filename: string
  /** Downscaled base64 JPEG data URL */
  dataUrl: string
  /** Optional note (e.g. hotel name, km reading) shown in the Spesenrapport */
  note?: string
  created_at: string
}
