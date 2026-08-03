/**
 * Offline Excel Generator
 *
 * Generates an OTIS Wochenrapport XLSX entirely in the browser
 * using raw XML manipulation + JSZip, without needing the backend.
 *
 * Mirrors the Python approach in apps/backend/src/excel_generator.py.
 */

import JSZip from 'jszip'
import TEMPLATE_BASE64 from './templateBase64'

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

const ZONE_ROWS: Record<number, number> = { 1: 10, 2: 12, 3: 15, 4: 18, 5: 21 }

const ACTIVITY_COLUMNS: Record<string, string> = {
  NK: 'J',
  S: 'J',
  T: 'J',
  'T Clot': 'K',
  O: 'L',
  QI: 'M',
  I04: 'N',
  I5S: 'N',
  I5Q: 'N',
  I5T: 'N',
  I5A: 'N',
  A01: 'N',
  A02: 'N',
  A03: 'N',
  A04: 'N',
  A05: 'N',
  A07: 'N',
  VM: 'O',
  VP: 'P',
  NM: 'Q',
  NTC: 'Q',
  NF: 'Q',
  VC: 'Q',
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

/**
 * Convert standard decimal hours to OTIS format.
 * Standard: 4.5 (4h30m)  →  OTIS: 4.30
 * Standard: 7.25 (7h15m)  →  OTIS: 7.15
 */
function standardToOtis(decimalHours: number): number {
  const hours = Math.floor(decimalHours)
  const minutes = Math.round((decimalHours - hours) * 60)
  return hours + minutes / 100
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

/**
 * Set a cell to the activity marker '✓' (U+2713, inline string).
 *
 * The CELL STYLE carries a plain black font (created by buildMarkerStyles), so
 * '✓' renders visibly in every viewer — no Wingdings needed (Wingdings maps
 * '✓' to a wrong glyph, and the template's marker fonts are white, i.e.
 * invisible on white fill).
 */
function setCellMarker(xml: string, ref: string, style: string): string {
  const newXml = `<c r="${ref}" s="${style}" t="inlineStr"><is><t>✓</t></is></c>`
  return replaceCell(xml, ref, newXml)
}

/** Arial 14, default color (black) — matches the data rows' font size */
const BLACK_MARKER_FONT_ID = 2
/** Fonts that must be replaced when writing the literal '✓':
 *  - Wingdings (6, 7, 8, 22, 25) map '✓' to a wrong glyph
 *  - white fonts (20, 21, 22, 23, 25 — indexed=9) render invisible on white fill
 */
const UNSAFE_MARKER_FONTS = new Set([6, 7, 8, 20, 21, 22, 23, 25])
/** Dark solid fill (indexed=8 = black) that would hide a black '✓' */
const DARK_FILL_IDS = new Set([4])
const NONE_FILL_ID = 0

/**
 * Ensure marker cells render a visible black '✓'.
 *
 * The template's marker columns use white (indexed=9) and Wingdings fonts,
 * which would render the literal '✓' invisible or as a wrong glyph. For each
 * marker cell style we append a variant that swaps the font to a plain black
 * Arial and clears dark fills. Styles that are already safe (black font on a
 * light fill) are left untouched (mapped to themselves).
 *
 * Returns (updated styles.xml, {old_style: new_style}).
 */
function buildMarkerStyles(
  stylesXml: string,
  markerStyles: Set<number>,
): { xml: string; styleMap: Record<number, number> } {
  const styleMap: Record<number, number> = {}
  if (markerStyles.size === 0) return { xml: stylesXml, styleMap }
  // Only the <cellXfs> section carries the cell styles (cellStyleXfs is a
  // separate, much smaller section that precedes it — including it would
  // shift the indices and patch the wrong style).
  const cellXfsMatch = stylesXml.match(/<cellXfs[^>]*>.*?<\/cellXfs>/s)
  if (!cellXfsMatch) return { xml: stylesXml, styleMap }
  const cellXfsSection = cellXfsMatch[0]
  const xfs = [...cellXfsSection.matchAll(/<xf\b[^>]*?(?:\/>|>.*?<\/xf>)/gs)].map((m) => m[0])
  const countM = stylesXml.match(/<cellXfs count="(\d+)"/)
  if (!countM) return { xml: stylesXml, styleMap }
  const base = parseInt(countM[1], 10)
  const extra: string[] = []
  const sorted = [...markerStyles].sort((a, b) => a - b)
  for (const s of sorted) {
    if (s >= xfs.length) continue
    const xf = xfs[s]
    const fidM = xf.match(/fontId="(\d+)"/)
    const fillM = xf.match(/fillId="(\d+)"/)
    const fid = fidM ? parseInt(fidM[1], 10) : 0
    const fill = fillM ? parseInt(fillM[1], 10) : 0
    const needFont = UNSAFE_MARKER_FONTS.has(fid)
    const needFill = DARK_FILL_IDS.has(fill)
    if (!needFont && !needFill) {
      styleMap[s] = s // already safe — keep the original style
      continue
    }
    let newXf = xf
    if (needFont) {
      newXf = newXf.replace(/fontId="\d+"/, `fontId="${BLACK_MARKER_FONT_ID}"`)
    }
    if (needFill) {
      newXf = newXf.replace(/fillId="\d+"/, `fillId="${NONE_FILL_ID}"`)
    }
    styleMap[s] = base + extra.length
    extra.push(newXf)
  }
  if (extra.length === 0) return { xml: stylesXml, styleMap }
  let out = stylesXml.replace(
    `<cellXfs count="${countM[1]}">`,
    `<cellXfs count="${base + extra.length}">`,
  )
  out = out.replace('</cellXfs>', extra.join('') + '</cellXfs>')
  return { xml: out, styleMap }
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
  /** Optional receipt-photo notes written into the Spesenrapport (row 34). */
  photo_notes?: string[]
}

// ====== SHEET FILLERS ======

function fillStundenrapport(
  sheetXml: string,
  year: number,
  weekNumber: number,
  personnelNumber: string,
  fullName: string,
  entries: OfflineEntry[],
): { xml: string; markerRefs: string[] } {
  let xml = sheetXml
  const markerRefs: string[] = []

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

  // --- Data entries. Two identical 15-row blocks in the template:
  //   block 1 = rows 8-22, block 2 = rows 34-48 (offset +26).
  // The template physically has a second page/block — entries beyond the
  // first 15 MUST continue there, otherwise they silently vanish.
  const workEntries = entries
    .filter((e) => !e.is_lunch)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.start_time - b.start_time
    })

  const BLOCK_START = 8
  const BLOCK2_OFFSET = 26 // 34 - 8
  const MAX_ENTRIES = 30 // 15 rows per block × 2 blocks

  if (workEntries.length > MAX_ENTRIES) {
    console.warn(
      `[offlineGenerator] ${workEntries.length} work entries exceed the template ` +
        `capacity of ${MAX_ENTRIES} — ${workEntries.length - MAX_ENTRIES} entries ` +
        'will NOT appear in the Excel.',
    )
  }

  for (let i = 0; i < Math.min(workEntries.length, MAX_ENTRIES); i++) {
    const entry = workEntries[i]
    const blockIdx = Math.floor(i / 15)
    const rowInBlock = i % 15
    const row = BLOCK_START + rowInBlock + (blockIdx === 1 ? BLOCK2_OFFSET : 0)

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

    // Start time (H) — OTIS format (7.30 = 7h30m)
    if (entry.start_time != null) {
      xml = setCellNum(xml, `H${row}`, standardToOtis(entry.start_time))
    }

    // Duration (I) — OTIS format (4.30 = 4h30m)
    if (entry.duration != null) {
      xml = setCellNum(xml, `I${row}`, standardToOtis(entry.duration))
    }

    // Activity code marker (J-R) — applied later with a plain black font
    // and the literal '✓' (see setCellMarker). Work entries without an
    // explicit activity default to NK so every line of the protocol gets a
    // checkmark (the template requires one per row).
    const activityCode = entry.activity_code || 'NK'
    if (activityCode && ACTIVITY_COLUMNS[activityCode]) {
      const colLetter = ACTIVITY_COLUMNS[activityCode]
      markerRefs.push(`${colLetter}${row}`)
    }
  }

  return { xml, markerRefs }
}

function fillSpesenrapport(
  sheetXml: string,
  year: number,
  weekNumber: number,
  personnelNumber: string,
  fullName: string,
  entries: OfflineEntry[],
  expenses?: OfflineExpense[],
  photoNotes?: string[],
): string {
  let xml = sheetXml

  // --- Header: values go into the empty value cells next to the template
  // labels (D5/H5/A7/F7 are the labels; E5/I5/B7/G7 are the value cells).
  const monday = getMondayOfWeek(year, weekNumber)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  xml = setCellStr(xml, 'B7', String(personnelNumber))
  xml = setCellStr(xml, 'G7', fullName)
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

  // --- Photo notes (Bemerkungen, row 34 — empty in the template) ---
  const notes = (photoNotes || []).map((n) => n.trim()).filter(Boolean)
  if (notes.length > 0) {
    xml = setCellStr(xml, 'C34', 'Bemerkungen / Notes :')
    xml = setCellStr(xml, 'E34', notes.join('  |  '))
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
 * Uses the template embedded as base64 in the JavaScript bundle,
 * so no network fetch is required. Works offline and in Capacitor.
 *
 * @param options - Generation options (year, week, entries, etc.)
 * @returns A Promise resolving to the XLSX Blob
 */
export async function generateExcelOffline(options: OfflineGenerateOptions): Promise<Blob> {
  const { year, week_number, personnel_number, full_name, entries, expenses, photo_notes } = options

  // 1. Decode the embedded template from base64
  const templateBinary = atob(TEMPLATE_BASE64)
  const uint8 = new Uint8Array(templateBinary.length)
  for (let i = 0; i < templateBinary.length; i++) {
    uint8[i] = templateBinary.charCodeAt(i)
  }
  const templateData = uint8.buffer

  // 2. Open as ZIP
  const zip = await JSZip.loadAsync(templateData)

  // 3. Extract sheet XMLs + styles
  const sheet1Raw = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
  const sheet2Raw = await zip.file('xl/worksheets/sheet2.xml')!.async('string')
  const stylesRaw = await zip.file('xl/styles.xml')!.async('string')

  // 4. Fill with data
  const s1 = fillStundenrapport(sheet1Raw, year, week_number, personnel_number, full_name, entries)

  // Wingdings/white-font cell styles for the activity markers are NOT
  // needed anymore — the marker is the literal '✓' rendered with a plain
  // black font (see setCellMarker). buildMarkerStyles only fixes up styles
  // whose original font is white/Wingdings or whose fill is dark.
  const markerStyles = new Set<number>()
  for (const ref of s1.markerRefs) {
    markerStyles.add(parseInt(getCellStyle(s1.xml, ref), 10) || 0)
  }
  const wd = buildMarkerStyles(stylesRaw, markerStyles)
  let sheet1Filled = s1.xml
  for (const ref of s1.markerRefs) {
    const style = parseInt(getCellStyle(sheet1Filled, ref), 10) || 0
    sheet1Filled = setCellMarker(sheet1Filled, ref, String(wd.styleMap[style] ?? style))
  }

  const sheet2Filled = fillSpesenrapport(
    sheet2Raw,
    year,
    week_number,
    personnel_number,
    full_name,
    entries,
    expenses,
    photo_notes,
  )

  // 5. Update the ZIP
  zip.file('xl/worksheets/sheet1.xml', sheet1Filled)
  zip.file('xl/worksheets/sheet2.xml', sheet2Filled)
  zip.file('xl/styles.xml', wd.xml)

  // 6. Generate blob
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return blob
}
