import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO, startOfWeek, addDays, getISOWeek, getYear } from 'date-fns'
import { de } from 'date-fns/locale'

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
 * Calculate zone based on distance from reference point (Dietlikon)
 */
export function calculateZone(distanceKm: number): number {
  if (distanceKm < 10) return 1
  if (distanceKm < 30) return 2
  if (distanceKm < 60) return 3
  return 4
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
 * Check if running on a specific platform via Capacitor or userAgent
 */
export function isPlatform(platform: 'android' | 'ios' | 'capacitor'): boolean {
  if (platform === 'capacitor') {
    return typeof (window as any).Capacitor !== 'undefined'
  }
  if (platform === 'android') {
    return typeof (window as any).Capacitor?.getPlatform === 'function'
      ? (window as any).Capacitor.getPlatform() === 'android'
      : navigator.userAgent.toLowerCase().includes('android')
  }
  if (platform === 'ios') {
    return typeof (window as any).Capacitor?.getPlatform === 'function'
      ? (window as any).Capacitor.getPlatform() === 'ios'
      : /iPad|iPhone|iPod/.test(navigator.userAgent)
  }
  return false
}
