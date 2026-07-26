/**
 * Offline Excel Generator
 *
 * Generates an OTIS Wochenrapport XLSX entirely in the browser
 * using raw XML manipulation + JSZip, without needing the backend.
 *
 * Mirrors the Python approach in apps/backend/src/excel_generator.py.
 */

import JSZip from 'jszip'

// ====== CONSTANTS (mirrored from Python excel_generator.py) ======

const SPESEN_DAY_COLUMNS: Record<number, string> = {
  0: 'D', // Monday (LU)
  1: 'E', // Tuesday (MA)
  2: 'F', // Wednesday (ME)
  3: 'G', // Thursday (JE)
  4: 'H', // Friday (VE)
  5: 'I', // Saturday (SA)
  6: 'J', // Sunday (DI)
}

const ZONE_ROWS: Record<number, number> = { 1: 10, 2: 12, 3: 15, 4: 18 }

const ACTIVITY_COLUMNS: Record<string, string> = {
  NK: 'J', S: 'J', T: 'J',
  'T Clot': 'K', O: 'L', QI: 'M',
  I04: 'N', I5S: 'N', I5Q: 'N', I5T: 'N', I5A: 'N',
  A01: 'N', A02: 'N', A03: 'N', A04: 'N', A05: 'N', A07: 'N',
  VM: 'O', VP: 'P',
  NM: 'Q', NTC: 'Q', NF: 'Q', VC: 'Q',
  'QI SCOTT': 'R',
}

const EXPENSE_ROWS: Record<string, number> = {
  entschaedigung_10h: 26,
  hotel: 27,
  transport: 28,
  pikettdienst: 29,
  entschaedigung_pikett: 30,
  material: 31,
  privatfahrzeug: 33,
}

// ====== HELPERS ======

/** Escape XML special characters */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Format a number for XML */
function numStr(value: number): string {
  if (Number.isInteger(value)) return String(value)
  // Format with up to 15 decimal places, strip trailing zeros
  let s = value.toFixed(15).replace(/\.?0+$/, '')
  return s
}

/** Get the ISO week Monday for a given year+week */
function getMondayOfWeek(year: number, weekNumber: number): Date {
  const jan4 = new Date(year, 0, 4)
  const dayOffset = jan4.getDay() // 0=Sun..6=Sat
  // Monday = jan4 - (dayOffset - 1) days + (weekNumber - 1) * 7 days
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - (dayOffset === 0 ? 6 : dayOffset - 1) + (weekNumber - 1) * 7)
  return monday
}

/** Format date as DD.MM.YYYY */
function formatDateDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

// ====== XML CELL MANIPULATION ======

/** Extract the style attribute from an existing cell element */
function getCellStyle(xml: string, ref: string): string {
  const m = xml.match(new RegExp(`<c\\s+r="${ref}"\\s+s="(\\d+)"`))
  return m ? m[1] : '0'
}

/** Replace an existing cell element with new XML */
function replaceCell(xml: string, ref: string, newXml: string): string {
  // Try self-closing tag first
  const pattern1 = new RegExp(`<c\\s+r="${ref}"[^>]*/>`)
  if (pattern1.test(xml)) {
    return xml.replace(pattern1, newXml)
  }
  // Try full tag (with content)
  const pattern2 = new RegExp(`<c\\s+r="${ref}"[^>]*>.*?</c>`, 's')
  if (pattern2.test(xml)) {
    return xml.replace(pattern2, newXml)
  }
  return xml // Cell not found
}

/** Set a cell to a numeric value */
function setCellNum(xml: string, ref: string, value: number): string {
  const style = getCellStyle(xml, ref)
  const newXml = `<c r="${ref}" s="${style}"><v>${numStr(value)}</v></c>`
  return replaceCell(xml, ref, newXml)
}

/** Set a cell to an inline string value */
function setCellStr(xml: string, ref: string, value: string): string {
  const style = getCellStyle(xml, ref)
  const escaped = xmlEscape(value)
  const newXml = `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${escaped}</t></is></c>`
  return replaceCell(xml, ref, newXml)
}

/** Set a cell to the activity marker 'ü' (inline string) */
function setCellMarker(xml: string, ref: string): string {
  const style = getCellStyle(xml, ref)
  const newXml = `<c r="${ref}" s="${style}" t="inlineStr"><is><t>ü</t></is></c>`
  return replaceCell(xml, ref, newXml)
}

// ====== ENTRY DATA TYPES ======

export interface OfflineEntry {
  date: string // YYYY-MM-DD
  start_time: number
  duration: number
  anlagenummer?: string
  project_id?: string
  address?: string
  activity_code?: string
  is_lunch?: boolean
  zone?: number
  location_zone?: number
}

export interface OfflineExpense {
  date: string
  expense_type: string
  value: number
}

export interface OfflineGenerateOptions {
  year: number
  week_number: number
  personnel_number: string
  full_name: string
  entries: OfflineEntry[]
  expenses?: OfflineExpense[]
}

// ====== SHEET FILLERS ======

function fillStundenrapport(
  sheetXml: string,
  year: number,
  weekNumber: number,
  personnelNumber: string,
  fullName: string,
  entries: OfflineEntry[],
): string {
  let xml = sheetXml

  // --- Header row 2 ---
  xml = setCellStr(xml, 'C2', String(personnelNumber))
  const nameParts = fullName.trim().split(/ (.+)/)
  if (nameParts.length >= 2) {
    xml = setCellStr(xml, 'E2', nameParts[0]) // Last name
    xml = setCellStr(xml, 'H2', nameParts[1]) // First name
  } else {
    xml = setCellStr(xml, 'E2', fullName)
  }

  const weekMonday = getMondayOfWeek(year, weekNumber)
  xml = setCellNum(xml, 'L2', weekMonday.getMonth() + 1)
  xml = setCellNum(xml, 'N2', year)
  xml = setCellNum(xml, 'L3', weekNumber)

  // --- Second block row 28-29 ---
  xml = setCellStr(xml, 'C28', String(personnelNumber))
  if (nameParts.length >= 2) {
    xml = setCellStr(xml, 'E28', nameParts[0])
    xml = setCellStr(xml, 'H28', nameParts[1])
  } else {
    xml = setCellStr(xml, 'E28', fullName)
  }
  xml = setCellNum(xml, 'L28', weekMonday.getMonth() + 1)
  xml = setCellNum(xml, 'N28', year)
  xml = setCellNum(xml, 'L29', weekNumber)

  // --- Data entries (rows 8-22, max 15) ---
  const workEntries = entries
    .filter((e) => !e.is_lunch)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.start_time - b.start_time
    })

  for (let i = 0; i < Math.min(workEntries.length, 15); i++) {
    const entry = workEntries[i]
    const row = 8 + i

    // Day of month (A)
    if (entry.date) {
      const dt = new Date(entry.date + 'T00:00:00')
      if (!isNaN(dt.getTime())) {
        xml = setCellNum(xml, `A${row}`, dt.getDate())
      }
    }

    // Anlagenummer (B)
    if (entry.anlagenummer) {
      xml = setCellStr(xml, `B${row}`, entry.anlagenummer)
    }

    // Project ID (D)
    if (entry.project_id) {
      xml = setCellStr(xml, `D${row}`, entry.project_id)
    }

    // Address (F)
    if (entry.address) {
      xml = setCellStr(xml, `F${row}`, entry.address)
    }

    // Start time (H)
    if (entry.start_time != null) {
      xml = setCellNum(xml, `H${row}`, entry.start_time)
    }

    // Duration (I)
    if (entry.duration != null) {
      xml = setCellNum(xml, `I${row}`, entry.duration)
    }

    // Activity code marker (J-R)
    if (entry.activity_code && ACTIVITY_COLUMNS[entry.activity_code]) {
      const colLetter = ACTIVITY_COLUMNS[entry.activity_code]
      xml = setCellMarker(xml, `${colLetter}${row}`)
    }
  }

  return xml
}

function fillSpesenrapport(
  sheetXml: string,
  year: number,
  weekNumber: number,
  personnelNumber: string,
  fullName: string,
  entries: OfflineEntry[],
  expenses?: OfflineExpense[],
): string {
  let xml = sheetXml

  // --- Header row 7 ---
  xml = setCellStr(xml, 'B7', String(personnelNumber))
  xml = setCellStr(xml, 'G7', fullName)

  // --- Date range row 5 ---
  const monday = getMondayOfWeek(year, weekNumber)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  xml = setCellStr(xml, 'E5', formatDateDMY(monday))
  xml = setCellStr(xml, 'I5', formatDateDMY(friday))

  // --- Calculate highest zone per day ---
  const dayZones: Record<number, number> = {}
  for (const entry of entries) {
    const dt = new Date(entry.date + 'T00:00:00')
    if (isNaN(dt.getTime())) continue
    const weekday = dt.getDay() === 0 ? 6 : dt.getDay() - 1 // Mon=0..Sun=6
    const zone = entry.zone || entry.location_zone || 0
    if (zone > 0 && zone > (dayZones[weekday] ?? 0)) {
      dayZones[weekday] = zone
    }
  }

  // --- Fill zone marks ---
  for (const [weekdayStr, zone] of Object.entries(dayZones)) {
    const weekday = Number(weekdayStr)
    if (ZONE_ROWS[zone]) {
      const row = ZONE_ROWS[zone]
      const colLetter = SPESEN_DAY_COLUMNS[weekday]
      if (colLetter) {
        xml = setCellNum(xml, `${colLetter}${row}`, 1)
      }
    }
  }

  // --- Fill expenses ---
  if (expenses && expenses.length > 0) {
    const expenseByDay: Record<number, Record<string, number>> = {}
    for (const exp of expenses) {
      const dt = new Date(exp.date + 'T00:00:00')
      if (isNaN(dt.getTime())) continue
      const weekday = dt.getDay() === 0 ? 6 : dt.getDay() - 1
      if (!expenseByDay[weekday]) expenseByDay[weekday] = {}
      expenseByDay[weekday][exp.expense_type] = exp.value
    }

    for (const [weekdayStr, dayExpenses] of Object.entries(expenseByDay)) {
      const weekday = Number(weekdayStr)
      const colLetter = SPESEN_DAY_COLUMNS[weekday]
      if (!colLetter) continue
      for (const [expType, value] of Object.entries(dayExpenses)) {
        if (EXPENSE_ROWS[expType]) {
          const row = EXPENSE_ROWS[expType]
          xml = setCellNum(xml, `${colLetter}${row}`, value)
        }
      }
    }
  }

  // --- Footer date (E36) ---
  const today = new Date()
  xml = setCellStr(xml, 'E36', formatDateDMY(today))

  return xml
}

// ====== MAIN GENERATOR ======

/**
 * Generate an OTIS Wochenrapport XLSX entirely in the browser.
 *
 * Fetches the template file (cached by the service worker),
 * fills it with entry data using raw XML manipulation,
 * and returns the file as a Blob.
 *
 * @param options - Generation options (year, week, entries, etc.)
 * @param templateUrl - URL to the template XLSX (default: /templates/template.xlsx)
 * @returns A Promise resolving to the XLSX Blob
 */
export async function generateExcelOffline(
  options: OfflineGenerateOptions,
  templateUrl: string = '/templates/template.xlsx',
): Promise<Blob> {
  const { year, week_number, personnel_number, full_name, entries, expenses } = options

  // 1. Fetch the template
  const response = await fetch(templateUrl)
  if (!response.ok) {
    throw new Error(`Template not found: ${templateUrl}`)
  }
  const templateData = await response.arrayBuffer()

  // 2. Open as ZIP
  const zip = await JSZip.loadAsync(templateData)

  // 3. Extract sheet XMLs
  const sheet1Raw = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
  const sheet2Raw = await zip.file('xl/worksheets/sheet2.xml')!.async('string')

  // 4. Fill with data
  const sheet1Filled = fillStundenrapport(
    sheet1Raw, year, week_number, personnel_number, full_name, entries,
  )
  const sheet2Filled = fillSpesenrapport(
    sheet2Raw, year, week_number, personnel_number, full_name, entries, expenses,
  )

  // 5. Update the ZIP
  zip.file('xl/worksheets/sheet1.xml', sheet1Filled)
  zip.file('xl/worksheets/sheet2.xml', sheet2Filled)

  // 6. Generate blob
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return blob
}
