import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, addDays, getISOWeek, getYear } from 'date-fns'
import { de } from 'date-fns/locale'
import type { TimeEntry } from '@/lib/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Convert HH:MM string to decimal hours (e.g., "07:30" -> 7.5)
 */
export function timeToDecimal(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours + minutes / 60
}

/**
 * Convert decimal hours to HH:MM string (e.g., 7.5 -> "07:30")
 */
export function decimalToTime(decimal: number): string {
  const hours = Math.floor(decimal)
  const minutes = Math.round((decimal - hours) * 60)
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

/**
 * Convert standard decimal hours to OTIS decimal format.
 * Standard: 7.5 = 7h30m  →  OTIS: 7.3 = 7h30m
 * Rule: OTIS = hours + minutes/10 (minutes as single decimal digit 0-5)
 * For 15-min precision we use two decimal digits: .15 = 15min, .30 = 30min, .45 = 45min
 */
export function standardToOtis(standardDecimal: number): number {
  const hours = Math.floor(standardDecimal)
  const minutes = Math.round((standardDecimal - hours) * 60)
  // Minutes as two decimal digits: 15min = 0.15, 30min = 0.30, 45min = 0.45
  return hours + minutes / 100
}

/**
 * Convert OTIS decimal format back to standard decimal hours.
 * OTIS: 4.3 = 4h30m  →  Standard: 4.5 = 4h30m
 */
export function otisToStandard(otisDecimal: number): number {
  const hours = Math.floor(otisDecimal)
  // Extract two decimal digits for minutes
  const minutesStr = otisDecimal.toFixed(2).split('.')[1] || '00'
  const minutes = parseInt(minutesStr, 10)
  return hours + minutes / 60
}

/**
 * Format standard decimal hours as an OTIS display string (e.g., 4.5 -> "4.30")
 */
export function formatOtisDuration(decimal: number): string {
  const otis = standardToOtis(decimal)
  return otis.toFixed(2)
}

/**
 * Snap a decimal time value to the nearest 15-minute (0.25h) increment.
 */
export function snapToQuarter(decimal: number): number {
  return Math.round(decimal * 4) / 4
}

/**
 * Get the ISO week number for a given date
 */
export function getWeekInfo(dateStr: string): { year: number; week: number; dayOfWeek: number } {
  const date = parseISO(dateStr)
  return {
    year: getYear(date),
    week: getISOWeek(date),
    dayOfWeek: date.getDay(),
  }
}

/**
 * Get Monday-Friday dates for a given ISO week
 */
export function getWeekDates(year: number, week: number): string[] {
  // January 4th is always in week 1
  const jan4 = new Date(year, 0, 4)
  const dayOffset = jan4.getDay() === 0 ? 6 : jan4.getDay() - 1 // Monday = 0
  const monday = addDays(jan4, (week - 1) * 7 - dayOffset)

  return Array.from({ length: 5 }, (_, i) => format(addDays(monday, i), 'yyyy-MM-dd'))
}

/**
 * Format a date short (e.g., "13.07.")
 */
export function formatDateShort(dateStr: string): string {
  return format(parseISO(dateStr), 'dd.MM.', { locale: de })
}

/**
 * Validate time overlap between entries
 */
export function hasOverlap(
  start1: number,
  duration1: number,
  start2: number,
  duration2: number,
): boolean {
  const end1 = start1 + duration1
  const end2 = start2 + duration2
  return start1 < end2 && start2 < end1
}

/** A time span in decimal hours (e.g. 7.5 = 07:30, duration 1.5 = 1h30min). */
export interface TimeRange {
  start: number
  duration: number
}

/**
 * Find the FIRST pair of overlapping ranges in a list. Half-open intervals:
 * an item starting exactly where another ends is NOT an overlap (e.g.
 * 07:30–11:30 followed by 11:30–15:00 is valid).
 *
 * @returns The two conflicting items, or null when the list is clean.
 * @example findFirstOverlap(entries, (e) => ({ start: e.start_time, duration: e.duration }))
 */
export function findFirstOverlap<T>(
  items: T[],
  getRange: (item: T) => TimeRange,
): [T, T] | null {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = getRange(items[i])
      const b = getRange(items[j])
      if (hasOverlap(a.start, a.duration, b.start, b.duration)) return [items[i], items[j]]
    }
  }
  return null
}

/**
 * The items whose ranges overlap the given probe range (half-open intervals).
 *
 * @example findOverlappingRanges({ start: 7, duration: 8.5 }, entries, (e) => ({
 *   start: e.start_time,
 *   duration: e.duration,
 * }))
 */
export function findOverlappingRanges<T>(
  probe: TimeRange,
  items: T[],
  getRange: (item: T) => TimeRange,
): T[] {
  return items.filter((item) => {
    const r = getRange(item)
    return hasOverlap(probe.start, probe.duration, r.start, r.duration)
  })
}

/**
 * Find the most recently updated time entry that used a given lift.
 *
 * Shared fallback for resolving a lift's project number / address when the
 * source row (favorite or location cache) holds empty values: the last time
 * the lift was recorded usually carries its full details.
 *
 * @returns The newest matching entry, or undefined when the lift was never used.
 * @example findLatestLiftEntry(timeEntries, 'H2957')?.location_project_id
 */
export function findLatestLiftEntry(
  timeEntries: TimeEntry[],
  anlagenummer: string,
): TimeEntry | undefined {
  return timeEntries
    .filter(
      (e) =>
        e.location_anlagenummer &&
        e.location_anlagenummer.toUpperCase() === anlagenummer.toUpperCase(),
    )
    .sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0]
}

/**
 * Check if a total hours value meets the daily requirement
 */
export function meetsDailyRequirement(
  totalHours: number,
  dayOfWeek: number,
): { meets: boolean; required: number } {
  // dayOfWeek: 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday
  const required = dayOfWeek === 5 ? 8.0 : 8.5
  return { meets: totalHours >= required, required }
}

/**
 * Calculate zone based on distance from the reference point.
 *
 *   Z1: 0–10 km        Z2: 10–30 km
 *   Z3: 30–60 km       Z4: 60+ km
 *   Z5: 60+ km with an overnight stay (only ever chosen manually / explicitly,
 *       auto-computed zones never assume an overnight stay)
 */
export function calculateZone(distanceKm: number, overnightStay = false): number {
  if (distanceKm < 10) return 1
  if (distanceKm < 30) return 2
  if (distanceKm < 60) return 3
  return overnightStay ? 5 : 4
}

/**
 * Haversine distance in km
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function getToday(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Single shared week key (e.g. "2026-31") — used to group per-week data
 * (receipt photos, etc.) so every page addresses the same week identically.
 */
export function getWeekKey(year: number, week: number): string {
  return `${year}-${week}`
}

/**
 * Generate a simple UUID v4
 */
export function generateId(): string {
  return crypto.randomUUID()
}

/**
 * True if the value is a valid UUID (as stored in Supabase UUID columns).
 */
export function isValidUuid(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

/**
 * Deterministic UUID-format hash of a string — the same input always yields
 * the same UUID on every device. Used to give offline/manual lifts a stable
 * cloud `locations.id` (the column is UUID, local manual ids are not), so time
 * entries can reference the same lift across devices without FK failures.
 */
export function uuidFromString(input: string): string {
  // FNV-1a double 32-bit mix — deterministic, synchronous, no crypto needed.
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x85ebca6b) >>> 0
  }
  const a = h1.toString(16).padStart(8, '0')
  const b = h2.toString(16).padStart(8, '0')
  const c = (h1 >>> 7).toString(16).padStart(8, '0')
  const d = (h2 >>> 7).toString(16).padStart(8, '0')
  const hex = (a + b + c + d).slice(0, 32)
  return (
    hex.slice(0, 8) +
    '-' +
    hex.slice(8, 12) +
    '-' +
    hex.slice(12, 16) +
    '-' +
    hex.slice(16, 20) +
    '-' +
    hex.slice(20, 32)
  )
}

