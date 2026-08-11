import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/useTranslation'
import { useAppStore } from '@/stores/appStore'
import { useTimeEntries } from '@/hooks/useTimeEntries'
import { useShallow } from 'zustand/react/shallow'
import {
  getWeekDates,
  decimalToTime,
  findFirstOverlap,
  findOverlappingRanges,
  findLatestLiftEntry,
} from '@/lib/utils'
import { DAY_NAMES } from '@/lib/translations'
import type { TranslationKey } from '@/lib/translations'
import type { ActivityCode, ExpenseType, TimeEntry } from '@/lib/types'
import * as localDb from '@/db/indexeddb'
import { ensureLiftRow, geocodeAndApplyZone } from '@/lib/locationZones'
import {
  X,
  ArrowLeft,
  Check,
  Sparkles,
  UtensilsCrossed,
  Clock,
  Building2,
  Wrench,
  XCircle,
  ChevronRight,
  AlertTriangle,
  Briefcase,
  RotateCcw,
  CalendarDays,
} from 'lucide-react'
import { cn } from '@/lib/cn'

/** One work block (a lift visit or office work): plant data + start + duration. */
interface WorkBlock {
  /** 'lift' = at a lift (plant data entered), 'office' = I04/I5T\u2026 without a plant. */
  kind: 'lift' | 'office'
  anlagenummer: string
  projektnummer: string
  adresse: string
  activityCode: string // e.g. 'NK', 'I04', 'I5S'
  start: number
  duration: number
}

/** Per-day plan collected by the wizard. */
interface DayPlan {
  /** Worked at lifts, or not worked. */
  status: 'work' | 'off'
  /** Absence reason code (A01–A07, A06 = Feiertag) when the day is off. */
  absenceCode: string | null
  blocks: WorkBlock[]
  lunch: boolean
  lunchSkipped: boolean // lunch question already declined for this day
  lunchStart: number | null
  lunchDuration: number | null // minutes
  hasSpesen: boolean
  expenses: ExpenseType[]
  /** True when the day was pre-filled by the quick-fill flow — the wizard
   * then only asks the Spesen question for it (blocks + lunch already done). */
  quickFilled?: boolean
}

const emptyDay = (): DayPlan => ({
  status: 'off',
  absenceCode: null,
  blocks: [],
  lunch: false,
  lunchSkipped: false,
  lunchStart: null,
  lunchDuration: null,
  hasSpesen: false,
  expenses: [],
})

/** Duration presets for a work block (decimal hours) — 15-minute steps. */
const DURATION_OPTIONS = Array.from({ length: 32 }, (_, i) => 0.25 * (i + 1))

const LUNCH_OPTIONS = [30, 45, 60]

/** Hours of work after which the lunch question becomes relevant. */
const LUNCH_AFTER_HOURS = 4

/** Default start time for absence days (07:30 — same as the work day start). */
const ABSENCE_START = 7.5

const EXPENSE_TYPES: { type: ExpenseType; labelKey: TranslationKey }[] = [
  { type: 'entschaedigung_10h', labelKey: 'spesen.10h' },
  { type: 'hotel', labelKey: 'spesen.hotel' },
  { type: 'transport', labelKey: 'spesen.transport' },
  { type: 'pikettdienst', labelKey: 'spesen.pikett' },
  { type: 'entschaedigung_pikett', labelKey: 'spesen.pikett.ent' },
  { type: 'material', labelKey: 'spesen.material' },
  { type: 'privatfahrzeug', labelKey: 'spesen.privat' },
]

const TOTAL_DAYS = 5

/** Absence options shown after answering "No" to the worked question. */
const ABSENCE_CODES: { code: string; labelKey: TranslationKey }[] = [
  { code: 'A01', labelKey: 'wizard.absence.A01' },
  { code: 'A02', labelKey: 'wizard.absence.A02' },
  { code: 'A03', labelKey: 'wizard.absence.A03' },
  { code: 'A04', labelKey: 'wizard.absence.A04' },
  { code: 'A05', labelKey: 'wizard.absence.A05' },
  { code: 'A06', labelKey: 'wizard.absence.A06' },
  { code: 'A07', labelKey: 'wizard.absence.A07' },
]

type Phase =
  | 'worked'
  | 'workType'
  | 'absence'
  | 'anlage'
  | 'projekt'
  | 'adresse'
  | 'activity'
  | 'officeActivity'
  | 'start'
  | 'duration'
  | 'lunchQ'
  | 'lunchStart'
  | 'lunchDuration'
  | 'moreLifts'
  | 'spesen'
  | 'expenses'
  | 'quickAnlage'
  | 'quickProjekt'
  | 'quickAdresse'
  | 'quickDays'
  | 'quickLunch'
  // Week-level Spesen questions after a quick-fill: ONE "any expenses this
  // week?" question instead of the same per-day question 4–5 times in a row.
  | 'spesenAny'
  | 'spesenDay'
  | 'spesenMore'

/** History entry so the Back button can walk back through dynamic phases. */
interface HistoryEntry {
  dayIndex: number
  phase: Phase
  blockIndex: number
}

const PHASE_RANK: Record<Phase, number> = {
  worked: 0,
  workType: 1,
  absence: 1,
  anlage: 2,
  projekt: 3,
  adresse: 4,
  activity: 5,
  officeActivity: 5,
  start: 6,
  duration: 7,
  lunchQ: 8,
  lunchStart: 9,
  lunchDuration: 10,
  moreLifts: 11,
  spesen: 12,
  expenses: 13,
  quickAnlage: 14,
  quickProjekt: 15,
  quickAdresse: 16,
  quickDays: 17,
  quickLunch: 18,
  spesenAny: 19,
  spesenDay: 20,
  spesenMore: 21,
}

const PHASES_PER_DAY = 22

/** Week-level phases (not tied to a single day's entry flow). */
const WEEK_LEVEL_PHASES: Phase[] = ['spesenAny', 'spesenDay', 'spesenMore']

/** Phases that show a block counter badge (Lift {n} / B\u00fcro {n}). */
const BLOCK_BADGE_PHASES: Phase[] = [
  'workType',
  'anlage',
  'projekt',
  'adresse',
  'activity',
  'officeActivity',
  'start',
  'duration',
]

function fmtDuration(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

/** "HH:MM–HH:MM" label for a time range (conflict messages). */
function rangeLabel(start: number, duration: number): string {
  return `${decimalToTime(start)}–${decimalToTime(start + duration)}`
}

/** YYYY-MM-DD → DD.MM. */
function shortDate(dateStr: string): string {
  const [, mm, dd] = dateStr.split('-')
  return `${dd}.${mm}.`
}

export function WizardPage() {
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const {
    currentWeek,
    dailyExpenses,
    toggleExpense,
    activityCodes,
    locations,
    timeEntries,
    setLocations,
    setFavoriteLocations,
  } = useAppStore(
      useShallow((s) => ({
        currentWeek: s.currentWeek,
        dailyExpenses: s.dailyExpenses,
        toggleExpense: s.toggleExpense,
        activityCodes: s.activityCodes,
        locations: s.locations,
        timeEntries: s.timeEntries,
        setLocations: s.setLocations,
        setFavoriteLocations: s.setFavoriteLocations,
      })),
    )
  const { addEntry, loadWeek } = useTimeEntries()

  // Make sure the store holds the current week's entries so the save-time
  // overlap check can compare against entries created earlier (previous wizard
  // runs or manual entries) instead of silently writing overlapping blocks.
  useEffect(() => {
    loadWeek().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWeek.year, currentWeek.week])

  const dates = useMemo(() => getWeekDates(currentWeek.year, currentWeek.week), [currentWeek])
  const dayNames = DAY_NAMES[language]

  const [days, setDays] = useState<DayPlan[]>(() => Array.from({ length: TOTAL_DAYS }, emptyDay))
  // Always-fresh mirror of `days` for handlers that may close over a stale
  // render's state (advanceDay decides per-day phase from the next day's
  // quickFilled flag — a stale array would re-ask "Did you work?" for days
  // the quick-fill already filled).
  const daysRef = useRef(days)
  daysRef.current = days
  const [dayIndex, setDayIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('worked')
  const [blockIndex, setBlockIndex] = useState(0) // index of the block currently being entered
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Conflict warning shown inside a question phase (start/duration). */
  const [phaseError, setPhaseError] = useState<string | null>(null)

  /**
   * Quick-fill setup: same lift on several days at once. While the user
   * answers the quick questions (anlage \u2192 projekt \u2192 adresse \u2192 days \u2192
   * lunch), the collected data lives here; on finish the selected days are
   * pre-filled with 4.5h + lunch + 4.0h blocks. Null = quick-fill inactive.
   */
  const [quickSetup, setQuickSetup] = useState<{
    anlagenummer: string
    projektnummer: string
    adresse: string
    days: number[]
    lunchDuration: number | null
  } | null>(null)

  // ─── Draft persistence (exit / re-enter the wizard without data loss) ───
  // The draft is keyed by ISO year-week, so a new week never restores the
  // previous week's data. On a successful finish the draft is removed.
  const draftKey = `wizard.draft.${currentWeek.year}.${currentWeek.week}`
  const [hydrated, setHydrated] = useState(false)
  const loadedRef = useRef(false)

  useEffect(() => {
    if (loadedRef.current) return
    loadedRef.current = true
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const saved = JSON.parse(raw) as {
          days: DayPlan[]
          dayIndex: number
          phase: Phase
          blockIndex: number
          history: HistoryEntry[]
          quickSetup: {
            anlagenummer: string
            projektnummer: string
            adresse: string
            days: number[]
            lunchDuration: number | null
          } | null
        }
        if (Array.isArray(saved.days) && saved.days.length === TOTAL_DAYS) {
          setDays(saved.days)
          if (typeof saved.dayIndex === 'number') setDayIndex(saved.dayIndex)
          if (saved.phase && PHASE_RANK[saved.phase] !== undefined) setPhase(saved.phase)
          if (typeof saved.blockIndex === 'number') setBlockIndex(saved.blockIndex)
          if (Array.isArray(saved.history)) setHistory(saved.history)
          if (saved.quickSetup) setQuickSetup(saved.quickSetup)
        }
      }
    } catch {
      // Corrupt draft — ignore and start fresh.
    }
    setHydrated(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey])

  // Persist the wizard state on every change so an accidental exit (X button)
  // never loses the week already entered. Only writes after the restore pass
  // has finished (otherwise the fresh mount would overwrite the draft).
  useEffect(() => {
    if (!hydrated) return
    const payload = {
      days,
      dayIndex,
      phase,
      blockIndex,
      history,
      quickSetup,
    }
    try {
      localStorage.setItem(draftKey, JSON.stringify(payload))
    } catch {
      // Quota exceeded — draft persistence is best-effort.
    }
  }, [draftKey, hydrated, days, dayIndex, phase, blockIndex, history, quickSetup])

  const day = days[dayIndex] // undefined on the summary screen (dayIndex === TOTAL_DAYS)
  const isLastDay = dayIndex === TOTAL_DAYS - 1

  const phaseRank = PHASE_RANK[phase]
  const progress = Math.min(
    100,
    ((dayIndex * PHASES_PER_DAY + phaseRank) / (TOTAL_DAYS * PHASES_PER_DAY)) * 100,
  )

  // ─── Hooks & derived values live BEFORE the summary early return (React rule) ───
  const completedBlocks = useMemo(
    () => (day?.blocks ?? []).slice(0, Math.min(blockIndex, day?.blocks.length ?? 0)),
    [day, blockIndex],
  )

  /** End of the very last work block (for the lunch question, all blocks count). */
  const lastBlockEnd = (() => {
    const blocks = day?.blocks ?? []
    const last = blocks[blocks.length - 1]
    return last ? last.start + last.duration : 7.5
  })()

  /** Default start time for the next block (chains from the previous block/lunch end). */
  const defaultNextStart = (() => {
    const last = completedBlocks[completedBlocks.length - 1]
    let next = last ? last.start + last.duration : 7.5
    if (day?.lunch && day.lunchStart != null && day.lunchDuration != null) {
      next = Math.max(next, day.lunchStart + day.lunchDuration / 60)
    }
    return next
  })()

  /** Codes selectable per lift (absence codes are day-level, chosen in the first question). */
  const liftCodes = useMemo(
    () =>
      activityCodes.filter(
        (c) => c.category === 'productive' || c.category === 'non_productive',
      ),
    [activityCodes],
  )

  /** Codes for office work (I04, I5T, \u2026) — non-productive only. */
  const officeCodes = useMemo(
    () => activityCodes.filter((c) => c.category === 'non_productive'),
    [activityCodes],
  )

  const updateDay = (patch: Partial<DayPlan>) => {
    setDays((prev) => prev.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d)))
  }

  /** Patch a SPECIFIC day (week-level Spesen flow targets days by index). */
  const updateDayAt = (index: number, patch: Partial<DayPlan>) => {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  }

  /** Jump to the first day that still needs the normal entry flow, or to the
   *  summary screen when the whole week is done. */
  const goToNextUnfilledOrSummary = () => {
    const idx = daysRef.current.findIndex((d) => d.blocks.length === 0 && !d.absenceCode)
    if (idx === -1) {
      setDayIndex(TOTAL_DAYS)
      setBlockIndex(0)
    } else {
      setDayIndex(idx)
      setBlockIndex(0)
      setPhase('worked')
    }
  }

  const emptyBlock = (): WorkBlock => ({
    kind: 'lift',
    anlagenummer: '',
    projektnummer: '',
    adresse: '',
    activityCode: 'NK',
    start: 0,
    duration: 0,
  })

  /** Patch the block currently being edited (creates it on first entry). */
  const setBlockField = (patch: Partial<WorkBlock>) => {
    const idx = blockIndex
    setDays((prev) =>
      prev.map((d, i) => {
        if (i !== dayIndex) return d
        const blocks = [...d.blocks]
        blocks[idx] = { ...emptyBlock(), ...blocks[idx], ...patch }
        return { ...d, status: 'work', blocks }
      }),
    )
  }

  const pushHistory = () => {
    setHistory((h) => [...h, { dayIndex, phase, blockIndex }])
  }

  /** Move to the next day (or summary on the last day). */
  const advanceDay = () => {
    pushHistory()
    setError(null)
    setPhaseError(null)
    if (isLastDay) {
      setDayIndex(TOTAL_DAYS)
    } else {
      const next = dayIndex + 1
      setDayIndex(next)
      // Quick-filled days already have their blocks + lunch — skip straight
      // to the Spesen question instead of re-asking the whole entry flow.
      // Read from daysRef so a stale closure can never miss the flag.
      setPhase(daysRef.current[next]?.quickFilled ? 'spesen' : 'worked')
    }
    setBlockIndex(0)
  }

  /**
   * Apply the quick-fill setup: for every selected day create the standard
   * 4.5h (07:30–12:00) + lunch + 4.0h afternoon block, then move to the first
   * day that still needs input (quick-filled days only ask for Spesen).
   */
  const applyQuickFill = (lunchDuration: number) => {
    if (!quickSetup) return
    const { anlagenummer, projektnummer, adresse, days: selectedDays } = quickSetup
    const filledDay = (): DayPlan => ({
      status: 'work',
      absenceCode: null,
      blocks: [
        {
          kind: 'lift',
          anlagenummer,
          projektnummer,
          adresse,
          activityCode: 'NK',
          start: 7.5,
          duration: 4.5,
        },
        {
          kind: 'lift',
          anlagenummer,
          projektnummer,
          adresse,
          activityCode: 'NK',
          start: 12 + lunchDuration / 60,
          duration: 4.0,
        },
      ],
      lunch: true,
      lunchSkipped: false,
      lunchStart: 12,
      lunchDuration,
      hasSpesen: false,
      expenses: [],
      quickFilled: true,
    })
    const newDays = days.map((d, i) => (selectedDays.includes(i) ? filledDay() : d))
    setDays(newDays)
    setQuickSetup(null)
    setHistory([])
    setError(null)
    setPhaseError(null)
    setBlockIndex(0)
    // Restart the walk from day 0. Instead of asking the same per-day
    // "Spesen?" question for every quick-filled day (4–5 times in a row),
    // ask ONE aggregated week-level question: "any expenses this week?" —
    // only the days the user flags are then walked through the expense
    // picker. Unfilled days afterwards get the normal entry flow.
    setDayIndex(0)
    setPhase(newDays.some((d) => d.quickFilled) ? 'spesenAny' : 'worked')
  }

  /** Live suggestions for the quick-fill Anlagen-Nr. input. */
  const quickAnlageSuggestionsFor = (value: string): Suggestion[] => {
    const q = value.trim().toUpperCase()
    if (q.length < 1) return []
    return locations
      .filter((l) => l.anlagenummer.toUpperCase().includes(q))
      .slice(0, 5)
      .map((l) => {
        const latest = findLatestLiftEntry(timeEntries, l.anlagenummer)
        const projektnummer = l.project_id || latest?.location_project_id || ''
        const adresse = l.full_address || latest?.location_address || ''
        return {
          label: l.anlagenummer,
          sublabel: `${projektnummer} · ${adresse}`,
          onSelect: () => {
            setQuickSetup((qs) =>
              qs
                ? { ...qs, anlagenummer: l.anlagenummer, projektnummer, adresse }
                : qs,
            )
            goTo('quickDays')
          },
        }
      })
  }

  const goTo = (p: Phase, bi?: number) => {
    pushHistory()
    setError(null)
    setPhaseError(null)
    setPhase(p)
    if (bi !== undefined) setBlockIndex(bi)
  }

  const goBack = () => {
    setError(null)
    setPhaseError(null)
    const prev = history[history.length - 1]
    if (!prev) {
      navigate('/dashboard')
      return
    }
    setHistory((h) => h.slice(0, -1))
    setDayIndex(prev.dayIndex)
    setPhase(prev.phase)
    setBlockIndex(prev.blockIndex)
  }

  const exit = () => navigate('/dashboard')

  /** Discard the current week's draft and start over (with confirmation). */
  const resetWeek = () => {
    if (!window.confirm(t('wizard.reset.confirm'))) return
    localStorage.removeItem(draftKey)
    setDays(Array.from({ length: TOTAL_DAYS }, emptyDay))
    setDayIndex(0)
    setPhase('worked')
    setBlockIndex(0)
    setHistory([])
    setQuickSetup(null)
    setError(null)
    setPhaseError(null)
  }

  /**
   * Detect a time overlap for a day's plan: between the plan's own blocks
   * (incl. lunch) and against entries that already exist in the store for
   * that date. Returns the day index or -1.
   */
  /** Work-block ranges (duration > 0) + lunch range of a day plan. */
  const plannedRanges = (plan: DayPlan): { start: number; duration: number }[] => {
    const ranges = plan.blocks
      .filter((b) => b.duration > 0)
      .map((b) => ({ start: b.start, duration: b.duration }))
    if (plan.lunch && plan.lunchStart != null && plan.lunchDuration != null) {
      ranges.push({ start: plan.lunchStart, duration: plan.lunchDuration / 60 })
    }
    return ranges
  }

  /** Already-saved entry ranges for a date (from the store). */
  const savedRanges = (date: string): { start: number; duration: number }[] =>
    timeEntries
      .filter((e) => e.date === date)
      .map((e) => ({ start: e.start_time, duration: e.duration }))

  const findOverlapDay = (): number => {
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const plan = days[i]
      if (plan.status !== 'work') continue
      const planned = plannedRanges(plan)
      const saved = savedRanges(dates[i])
      // Planned vs planned — always an error.
      if (findFirstOverlap(planned, (r) => r)) return i
      // Planned vs already-saved entries.
      if (planned.some((p) => findOverlappingRanges(p, saved, (r) => r).length > 0)) {
        return i
      }
    }
    return -1
  }

  /**
   * Check whether a block with the given start/duration would conflict with
   * another block of the same day (the edited one is skipped), the lunch break
   * or an already-saved entry for that date. Returns the conflicting range as
   * a short "HH:MM–HH:MM" label, or null when the block is fine.
   */
  const findBlockConflict = (start: number, duration: number, skipIndex: number): string | null => {
    if (duration <= 0) return null
    const day = days[dayIndex]
    // plannedRanges lists the work blocks with duration > 0 in order, then the
    // lunch range. Skip the edited block by matching the block object; a new
    // block (duration still 0 in state) is not listed and can't self-conflict.
    const durBlocks = day.blocks.filter((b) => b.duration > 0)
    const others = plannedRanges(day).filter((_, i) => {
      const blockAt = durBlocks[i]
      return blockAt === undefined || blockAt !== day.blocks[skipIndex]
    })
    const hit = findOverlappingRanges(
      { start, duration },
      [...others, ...savedRanges(dates[dayIndex])],
      (r) => r,
    )[0]
    return hit ? rangeLabel(hit.start, hit.duration) : null
  }

  /** Build the time entries for a given day plan. */
  const buildDayEntries = (
    date: string,
    plan: DayPlan,
  ): Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'synced'>[] => {
    // Absence day (sick A03, vacation A01, Feiertag A06, …) — one full-day
    // entry with the absence code; no Spesen for that day.
    if (plan.absenceCode) {
      const code = plan.absenceCode
      const idx = dates.indexOf(date)
      const required = idx === 4 ? 8.0 : 8.5
      return [
        {
          user_id: '',
          date,
          start_time: ABSENCE_START,
          duration: required,
          location_id: null,
          activity_code_id: code,
          activity_code: code,
          is_lunch: false,
          notes: '',
        },
      ]
    }
    if (plan.status !== 'work') return []
    const entries: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'synced'>[] = []
    for (const block of plan.blocks) {
      entries.push({
        user_id: '',
        date,
        start_time: block.start,
        duration: block.duration,
        location_id: null,
        activity_code_id: block.activityCode,
        activity_code: block.activityCode,
        is_lunch: false,
        notes: '',
        location_anlagenummer: block.anlagenummer.trim().toUpperCase(),
        location_project_id: block.projektnummer.trim(),
        location_address: block.adresse.trim(),
      })
    }
    if (plan.lunch && plan.lunchStart != null && plan.lunchDuration != null) {
      entries.push({
        user_id: '',
        date,
        start_time: plan.lunchStart,
        duration: plan.lunchDuration / 60,
        location_id: null,
        activity_code_id: null,
        activity_code: null,
        is_lunch: true,
        notes: '',
      })
    }
    return entries
  }

  const handleFinish = async () => {
    setSaving(true)
    setError(null)
    try {
      // Validate the whole week BEFORE writing anything — no partial saves.
      const clashDay = findOverlapDay()
      if (clashDay >= 0) {
        setError(t('wizard.overlap', { day: dayNames[clashDay] }))
        return
      }
      for (let i = 0; i < TOTAL_DAYS; i++) {
        const plan = days[i]
        const date = dates[i]
        const entries = buildDayEntries(date, plan)
        for (const entry of entries) {
          if (entry.duration > 0) await addEntry(entry)
        }
        // Only add expenses that are not already active for that date
        const existing = dailyExpenses[date] || []
        for (const type of plan.expenses) {
          if (!existing.some((e) => e.expense_type === type)) toggleExpense(date, type)
        }
      }

      // Persist wizard-typed lifts (locations + favorites) — the same save the
      // TimeEntryForm does for manual entries. Without it a lift typed here
      // never appears in "Letzte Anlagen" and carries no coordinates, so the
      // Spesenrapport falls back to the defaulted Z1 until an export heals it.
      const liftsToPersist = new Map<string, { projectId: string; address: string }>()
      for (let i = 0; i < TOTAL_DAYS; i++) {
        const plan = days[i]
        if (plan.status !== 'work') continue
        for (const b of plan.blocks) {
          const key = b.anlagenummer.trim().toUpperCase()
          if (!key || !b.adresse.trim()) continue
          liftsToPersist.set(key, {
            projectId: b.projektnummer.trim(),
            address: b.adresse.trim(),
          })
        }
      }
      for (const [key, { projectId, address }] of liftsToPersist) {
        try {
          // Shared helper: dedup against IndexedDB (never the render closure),
          // update-or-create the location row and upsert the favorite. Only
          // the IndexedDB-fast persistence is awaited; the geocode below is
          // fire-and-forget — finishing the wizard must not wait on the
          // network.
          const { location } = await ensureLiftRow(key, projectId, address)
          if (location && navigator.onLine) {
            geocodeAndApplyZone(key, address, location).catch(() => {})
          }
        } catch (err) {
          console.warn('Wizard lift persist failed for', key, err)
        }
      }
      if (liftsToPersist.size > 0) {
        setLocations(await localDb.getAllLocations())
        setFavoriteLocations(await localDb.getFavoriteLocations())
      }
      // The week was saved — drop the draft so a re-entry starts fresh.
      localStorage.removeItem(draftKey)
      navigate('/dashboard')
    } catch (e) {
      console.error('Wizard save failed:', e)
      setError(t('error.message'))
    } finally {
      setSaving(false)
    }
  }

  /** Live suggestions for the Anlagen-Nr. input (matched against known lifts). */
  const anlageSuggestionsFor = (value: string): Suggestion[] => {
    const q = value.trim().toUpperCase()
    if (q.length < 1) return []
    return locations
      .filter((l) => l.anlagenummer.toUpperCase().includes(q))
      .slice(0, 5)
      .map((l) => {
        // Fall back to the most recent time entry for this lift when the
        // location cache holds an empty project/address — a lift picked here
        // always carries its full details into the plan.
        const latest = findLatestLiftEntry(timeEntries, l.anlagenummer)
        const projektnummer = l.project_id || latest?.location_project_id || ''
        const adresse = l.full_address || latest?.location_address || ''
        return {
          label: l.anlagenummer,
          sublabel: `${projektnummer} · ${adresse}`,
          onSelect: () => {
            setBlockField({
              anlagenummer: l.anlagenummer,
              projektnummer,
              adresse,
            })
            goTo('activity')
          },
        }
      })
  }

  /** ─── Summary screen ─── */
  if (dayIndex >= TOTAL_DAYS) {
    const entryCount = days.reduce((sum, d) => {
      if (d.absenceCode) return sum + 1
      if (d.status === 'work') return sum + d.blocks.length + (d.lunch ? 1 : 0)
      return sum
    }, 0)
    const expenseCount = days.reduce((sum, d) => sum + d.expenses.length, 0)

    return (
      <div className="flex flex-col min-h-dvh bg-auth-ambient dark:bg-auth-ambient-dark relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 orb orb-blue opacity-60 dark:opacity-40" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 orb orb-cyan opacity-40 dark:opacity-30" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] orb orb-purple opacity-20" />

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto">
          <button
            onClick={goBack}
            className="absolute top-6 left-6 flex items-center justify-center w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all active:scale-95"
            aria-label={t('wizard.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-full bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-7 shadow-2xl">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4">
                <Check className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">{t('wizard.done')}</h1>
              <p className="text-otis-200/80 mt-1 text-sm font-medium">
                {t('wizard.summary.title')}
              </p>
            </div>

            <div className="space-y-3 mb-7">
              {entryCount > 0 ? (
                <div className="flex items-center gap-3 p-3.5 bg-white/10 backdrop-blur border border-white/15 rounded-2xl">
                  <Clock className="w-5 h-5 text-otis-300 flex-shrink-0" />
                  <p className="text-sm text-white/90 font-medium">
                    {t('wizard.summary.entries', { count: entryCount })}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-3.5 bg-white/10 backdrop-blur border border-white/15 rounded-2xl">
                  <Clock className="w-5 h-5 text-otis-300 flex-shrink-0" />
                  <p className="text-sm text-white/90 font-medium">
                    {t('wizard.summary.empty')}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-3 p-3.5 bg-white/10 backdrop-blur border border-white/15 rounded-2xl">
                <Sparkles className="w-5 h-5 text-amber-300 flex-shrink-0" />
                <p className="text-sm text-white/90 font-medium">
                  {t('wizard.summary.expenses', { count: expenseCount })}
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-400/30 rounded-2xl text-sm text-red-300 font-medium">
                {error}
              </div>
            )}

            <button
              onClick={handleFinish}
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-lg shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {saving ? '…' : t('wizard.finish')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /** ─── One-question-at-a-time flow ─── */
  const question = (() => {
    switch (phase) {
      case 'worked':
        return t('wizard.worked', { day: dayNames[dayIndex] })
      case 'workType':
        return t('wizard.workType')
      case 'absence':
        return t('wizard.absence.title')
      case 'anlage':
        return t('wizard.anlage')
      case 'projekt':
        return t('wizard.projekt')
      case 'adresse':
        return t('wizard.adresse')
      case 'activity':
      case 'officeActivity':
        return t('wizard.activity')
      case 'start':
        return t('wizard.start')
      case 'duration':
        return t('wizard.duration')
      case 'lunchQ':
        return t('wizard.lunch')
      case 'lunchStart':
        return t('wizard.lunchStart')
      case 'lunchDuration':
        return t('wizard.lunchDuration')
      case 'moreLifts':
        return t('wizard.moreLifts')
      case 'spesen':
        return t('wizard.spesen')
      case 'spesenAny':
        return t('wizard.spesenAny')
      case 'spesenDay':
        return t('wizard.spesenDay')
      case 'spesenMore':
        return t('wizard.spesenMore')
      case 'quickAnlage':
        return t('wizard.anlage')
      case 'quickProjekt':
        return t('wizard.projekt')
      case 'quickAdresse':
        return t('wizard.adresse')
      case 'quickDays':
        return t('wizard.quickDays')
      case 'quickLunch':
        return t('wizard.lunchDuration')
      default:
        return t('wizard.expenses')
    }
  })()

  const handleBlockStart = (start: number) => {
    const idx = blockIndex
    // Hard-constrain the start: a later block may never begin before the
    // previous block (or lunch) ends — guards against a stale wheel value
    // slipping an earlier time in.
    const clamped = completedBlocks.length > 0 ? Math.max(start, defaultNextStart) : start
    // Live conflict check: editing an earlier block's start so it now slides
    // into a later block (or lunch / saved entry) is caught here, not only at
    // save time.
    const duration = day?.blocks[idx]?.duration ?? 0
    const conflict = findBlockConflict(clamped, duration, idx)
    if (conflict) {
      setPhaseError(t('wizard.overlap.phase', { time: conflict }))
      return
    }
    setPhaseError(null)
    setBlockField({ start: clamped })
    goTo('duration', idx)
  }

  const handleBlockDuration = (duration: number) => {
    const idx = blockIndex
    // Extending an earlier block's duration can also collide with a later
    // block — reject it right here.
    const start = day!.blocks[idx]?.start ?? 0
    const conflict = findBlockConflict(start, duration, idx)
    if (conflict) {
      setPhaseError(t('wizard.overlap.phase', { time: conflict }))
      return
    }
    setPhaseError(null)
    const newBlocks = day!.blocks.map((b, i) => (i === idx ? { ...b, duration } : b))
    setDays((prev) => prev.map((d, i) => (i === dayIndex ? { ...d, blocks: newBlocks } : d)))
    // Lunch question becomes relevant once ≥4h of work has accumulated
    // (asked at most once per day).
    const total = newBlocks.reduce((sum, b) => sum + b.duration, 0)
    if (!day!.lunch && !day!.lunchSkipped && total >= LUNCH_AFTER_HOURS) {
      goTo('lunchQ')
    } else {
      goTo('moreLifts')
    }
  }

  return (
    <div className="flex flex-col min-h-dvh bg-auth-ambient dark:bg-auth-ambient-dark relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-80 h-80 orb orb-blue opacity-60 dark:opacity-40" />
      <div className="absolute -bottom-32 -left-32 w-64 h-64 orb orb-cyan opacity-40 dark:opacity-30" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] orb orb-purple opacity-20" />

      {/* Top bar: progress + exit */}
      <header className="relative z-10 w-full max-w-md mx-auto px-6 pt-6">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={goBack}
            className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all active:scale-95"
            aria-label={t('wizard.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-white/80 text-sm font-semibold">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/15">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              {t('wizard.dayProgress', { day: dayIndex + 1, total: TOTAL_DAYS })}
            </span>
            {!WEEK_LEVEL_PHASES.includes(phase) && (
              <span className="inline-flex items-center px-2.5 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/15 text-xs">
                {dayNames[dayIndex]}, {shortDate(dates[dayIndex])}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hydrated && (
              <button
                onClick={resetWeek}
                className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white/70 hover:text-white hover:bg-white/20 transition-all active:scale-95"
                aria-label={t('wizard.reset')}
                title={t('wizard.reset')}
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={exit}
              className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all active:scale-95"
              aria-label={t('wizard.exit')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-otis-400 to-emerald-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Question card */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 w-full max-w-md mx-auto">
        <div className="w-full">
          <h2 className="text-2xl font-bold text-white tracking-tight text-center mb-7">
            {question}
          </h2>

          {/* Phase-level conflict warning (start / duration) */}
          {phaseError && (
            <div className="mb-6 flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-500/15 border border-red-400/30 text-red-100 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-300" />
              <span>{phaseError}</span>
            </div>
          )}

          {/* Block counter badge for per-block phases (Lift {n} / B\u00fcro {n}) */}
          {BLOCK_BADGE_PHASES.includes(phase) && (
            <div className="flex items-center justify-center gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/15 text-white/90 text-sm font-semibold">
                {day!.blocks[blockIndex]?.kind === 'office' ? (
                  <Briefcase className="w-4 h-4 text-amber-300" />
                ) : (
                  <Building2 className="w-4 h-4 text-otis-300" />
                )}
                {day!.blocks[blockIndex]?.kind === 'office'
                  ? t('wizard.blockOffice', { n: blockIndex + 1 })
                  : t('wizard.block', { n: blockIndex + 1 })}
              </span>
            </div>
          )}

          {phase === 'worked' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    updateDay({ status: 'work', absenceCode: null, lunchSkipped: false })
                    goTo('workType')
                  }}
                  className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95"
                >
                  {t('wizard.yes')}
                </button>
                <button
                  onClick={() => goTo('absence')}
                  className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95"
                >
                  {t('wizard.no')}
                </button>
              </div>

              {/* Quick fill — same lift on several days at once. Only offered
                  on Monday (first day) and only while no day has any content
                  yet, so it can never overwrite entered days. */}
              {dayIndex === 0 && days.every((d) => d.blocks.length === 0 && !d.absenceCode) && (
                <button
                  onClick={() => {
                    setQuickSetup({
                      anlagenummer: '',
                      projektnummer: '',
                      adresse: '',
                      // Start with NO day selected — the user taps exactly the
                      // days to fill. (Pre-selecting all five was a trap: a
                      // tap on an already-selected day toggles it OFF, so a
                      // quick Mo–Th selection could silently end up as
                      // K–Fr, and the wizard then re-asked "Did you work on
                      // Monday?" for the unfilled day.)
                      days: [],
                      lunchDuration: null,
                    })
                    goTo('quickAnlage')
                  }}
                  className="w-full py-4 rounded-2xl border-2 border-dashed border-emerald-400/50 bg-emerald-500/10 text-emerald-100 font-bold text-base backdrop-blur-xl hover:bg-emerald-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5 text-emerald-300" />
                  {t('wizard.quick')}
                </button>
              )}
            </div>
          )}

          {phase === 'workType' && (
            <div className="space-y-3">
              <button
                onClick={() => {
                  setBlockField({ kind: 'lift' })
                  goTo('anlage')
                }}
                className="w-full py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5"
              >
                <Building2 className="w-5 h-5 text-otis-300" />
                {t('wizard.workType.lift')}
              </button>
              <button
                onClick={() => {
                  setBlockField({ kind: 'office' })
                  goTo('officeActivity')
                }}
                className="w-full py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2.5"
              >
                <Briefcase className="w-5 h-5 text-amber-300" />
                {t('wizard.workType.office')}
              </button>
            </div>
          )}

          {phase === 'absence' && (
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {ABSENCE_CODES.map(({ code, labelKey }) => (
                <button
                  key={code}
                  onClick={() => {
                    updateDay({
                      status: 'off',
                      absenceCode: code,
                      blocks: [],
                      hasSpesen: false,
                      expenses: [],
                    })
                    advanceDay()
                  }}
                  className="w-full flex items-center justify-between gap-3 py-4 px-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-semibold text-base backdrop-blur-xl hover:bg-white/20 transition-all active:scale-[0.98]"
                >
                  <span className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 text-white font-bold text-sm flex-shrink-0 shadow-lg shadow-purple-500/20">
                      {code}
                    </span>
                    <span className="text-left">{t(labelKey)}</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-white/40" />
                </button>
              ))}
            </div>
          )}

          {phase === 'anlage' && (
            <TextStep
              key="anlage"
              initialValue={day!.blocks[blockIndex]?.anlagenummer ?? ''}
              placeholder={t('wizard.anlage.placeholder')}
              autoCapitalize="characters"
              suggestionsFor={anlageSuggestionsFor}
              onNext={(v) => {
                setBlockField({ anlagenummer: v.toUpperCase() })
                goTo('projekt')
              }}
            />
          )}

          {phase === 'projekt' && (
            <TextStep
              key="projekt"
              initialValue={day!.blocks[blockIndex]?.projektnummer ?? ''}
              placeholder={t('wizard.projekt.placeholder')}
              autoCapitalize="characters"
              onNext={(v) => {
                setBlockField({ projektnummer: v.toUpperCase() })
                goTo('adresse')
              }}
            />
          )}

          {phase === 'adresse' && (
            <TextStep
              key="adresse"
              initialValue={day!.blocks[blockIndex]?.adresse ?? ''}
              placeholder={t('wizard.adresse.placeholder')}
              autoCapitalize="words"
              onNext={(v) => {
                setBlockField({ adresse: v })
                goTo('activity')
              }}
            />
          )}

          {phase === 'activity' && (
            <ActivityStep
              codes={liftCodes}
              selected={day!.blocks[blockIndex]?.activityCode ?? 'NK'}
              productiveLabel={t('activity.productive')}
              nonProductiveLabel={t('activity.nonproductive')}
              onSelect={(code) => {
                setBlockField({ activityCode: code })
                goTo('start')
              }}
            />
          )}

          {phase === 'officeActivity' && (
            <ActivityStep
              codes={officeCodes}
              selected={day!.blocks[blockIndex]?.activityCode ?? 'NK'}
              productiveLabel={t('activity.productive')}
              nonProductiveLabel={t('activity.nonproductive')}
              onSelect={(code) => {
                setBlockField({ activityCode: code })
                goTo('start')
              }}
            />
          )}

          {phase === 'quickAnlage' && (
            <TextStep
              key="quick-anlage"
              initialValue={quickSetup?.anlagenummer ?? ''}
              placeholder={t('wizard.anlage.placeholder')}
              autoCapitalize="characters"
              suggestionsFor={quickAnlageSuggestionsFor}
              onNext={(v) => {
                setQuickSetup((q) => (q ? { ...q, anlagenummer: v.toUpperCase() } : q))
                goTo('quickProjekt')
              }}
            />
          )}

          {phase === 'quickProjekt' && (
            <TextStep
              key="quick-projekt"
              initialValue={quickSetup?.projektnummer ?? ''}
              placeholder={t('wizard.projekt.placeholder')}
              autoCapitalize="characters"
              onNext={(v) => {
                setQuickSetup((q) => (q ? { ...q, projektnummer: v.toUpperCase() } : q))
                goTo('quickAdresse')
              }}
            />
          )}

          {phase === 'quickAdresse' && (
            <TextStep
              key="quick-adresse"
              initialValue={quickSetup?.adresse ?? ''}
              placeholder={t('wizard.adresse.placeholder')}
              autoCapitalize="words"
              onNext={(v) => {
                setQuickSetup((q) => (q ? { ...q, adresse: v } : q))
                goTo('quickDays')
              }}
            />
          )}

          {phase === 'quickDays' && (
            <div>
              <div className="grid grid-cols-5 gap-2 mb-5">
                {dayNames.map((name, i) => {
                  const active = quickSetup?.days.includes(i) ?? false
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        setQuickSetup((q) => {
                          if (!q) return q
                          const days = active
                            ? q.days.filter((d) => d !== i)
                            : [...q.days, i].sort()
                          return { ...q, days }
                        })
                      }
                      className={cn(
                        'py-3.5 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 flex flex-col items-center gap-0.5',
                        active
                          ? 'border-emerald-400 bg-emerald-500/20 text-white'
                          : 'border-white/25 bg-white/10 text-white/80 hover:bg-white/20',
                      )}
                    >
                      <span>{name.slice(0, 2)}</span>
                      <span className="text-[10px] font-medium opacity-70">
                        {shortDate(dates[i])}
                      </span>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => goTo('quickLunch')}
                disabled={!quickSetup || quickSetup.days.length === 0}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-otis-500 to-emerald-500 text-white font-bold text-lg shadow-lg shadow-otis-500/25 hover:shadow-otis-500/40 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {t('wizard.next')}
              </button>
            </div>
          )}

          {phase === 'quickLunch' && (
            <div className="grid grid-cols-3 gap-3">
              {LUNCH_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => applyQuickFill(m)}
                  className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <UtensilsCrossed className="w-5 h-5" />
                  {m} min
                </button>
              ))}
            </div>
          )}

          {phase === 'start' && (
            <TimeWheel
              min={completedBlocks.length > 0 ? defaultNextStart : undefined}
              defaultValue={defaultNextStart}
              onSelect={handleBlockStart}
            />
          )}

          {phase === 'duration' && (
            <DurationWheel
              defaultValue={day!.blocks[blockIndex]?.duration || 1}
              onSelect={handleBlockDuration}
            />
          )}

          {phase === 'lunchQ' && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => goTo('lunchStart')}
                className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95"
              >
                {t('wizard.yes')}
              </button>
              <button
                onClick={() => {
                  updateDay({ lunchSkipped: true })
                  goTo('moreLifts')
                }}
                className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95"
              >
                {t('wizard.no')}
              </button>
            </div>
          )}

          {phase === 'lunchStart' && (
            <TimeWheel
              min={lastBlockEnd}
              defaultValue={lastBlockEnd}
              onSelect={(v) => {
                // Lunch must start after the last work block ends.
                updateDay({ lunch: true, lunchStart: Math.max(v, lastBlockEnd) })
                goTo('lunchDuration')
              }}
            />
          )}

          {phase === 'lunchDuration' && (
            <div className="grid grid-cols-3 gap-3">
              {LUNCH_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    updateDay({ lunchDuration: m })
                    goTo('moreLifts')
                  }}
                  className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <UtensilsCrossed className="w-5 h-5" />
                  {m} min
                </button>
              ))}
            </div>
          )}

          {phase === 'moreLifts' && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => goTo('workType', day!.blocks.length)}
                className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95"
              >
                {t('wizard.yes')}
              </button>
              <button
                onClick={() => goTo('spesen')}
                className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95"
              >
                {t('wizard.no')}
              </button>
            </div>
          )}

          {phase === 'spesen' && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  updateDay({ hasSpesen: true })
                  goTo('expenses')
                }}
                className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95"
              >
                {t('wizard.yes')}
              </button>
              <button
                onClick={() => {
                  updateDay({ hasSpesen: false, expenses: [] })
                  advanceDay()
                }}
                className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95"
              >
                {t('wizard.no')}
              </button>
            </div>
          )}

          {phase === 'spesenAny' && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => goTo('spesenDay')}
                className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95"
              >
                {t('wizard.yes')}
              </button>
              <button
                onClick={() => {
                  // No expenses on any quick-filled day — mark them all done
                  // and jump to the first day that still needs input.
                  daysRef.current.forEach((d, i) => {
                    if (d.quickFilled) updateDayAt(i, { hasSpesen: false, expenses: [] })
                  })
                  goToNextUnfilledOrSummary()
                }}
                className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95"
              >
                {t('wizard.no')}
              </button>
            </div>
          )}

          {phase === 'spesenDay' && (
            <div className="space-y-3">
              {days.map((d, i) =>
                d.quickFilled ? (
                  <button
                    key={i}
                    disabled={d.hasSpesen}
                    onClick={() => {
                      updateDayAt(i, { hasSpesen: true })
                      setDayIndex(i)
                      goTo('expenses')
                    }}
                    className={cn(
                      'w-full py-4 px-5 rounded-2xl border-2 font-semibold text-base transition-all active:scale-[0.98] backdrop-blur-xl flex items-center justify-between',
                      d.hasSpesen
                        ? 'border-amber-400 bg-amber-500/20 text-white'
                        : 'border-white/25 bg-white/10 text-white hover:bg-white/20',
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-white/60" />
                      {dayNames[i]}, {shortDate(dates[i])}
                    </span>
                    <span
                      className={cn(
                        'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                        d.hasSpesen
                          ? 'border-amber-300 bg-amber-400 text-amber-950'
                          : 'border-white/40',
                      )}
                    >
                      {d.hasSpesen && <Check className="w-4 h-4" />}
                    </span>
                  </button>
                ) : null,
              )}
            </div>
          )}

          {phase === 'spesenMore' && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => goTo('spesenDay')}
                className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95"
              >
                {t('wizard.yes')}
              </button>
              <button
                onClick={goToNextUnfilledOrSummary}
                className="py-5 rounded-2xl border-2 border-white/25 bg-white/10 text-white font-bold text-lg backdrop-blur-xl hover:bg-white/20 transition-all active:scale-95"
              >
                {t('wizard.no')}
              </button>
            </div>
          )}

          {phase === 'expenses' && (
            <div className="space-y-3">
              {EXPENSE_TYPES.map(({ type, labelKey }) => {
                const active = day!.expenses.includes(type)
                return (
                  <button
                    key={type}
                    onClick={() =>
                      updateDay({
                        expenses: active
                          ? day!.expenses.filter((e) => e !== type)
                          : [...day!.expenses, type],
                      })
                    }
                    className={cn(
                      'w-full py-4 px-5 rounded-2xl border-2 font-semibold text-base transition-all active:scale-[0.98] backdrop-blur-xl flex items-center justify-between',
                      active
                        ? 'border-amber-400 bg-amber-500/20 text-white'
                        : 'border-white/25 bg-white/10 text-white hover:bg-white/20',
                    )}
                  >
                    <span>{t(labelKey)}</span>
                    <span
                      className={cn(
                        'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                        active
                          ? 'border-amber-300 bg-amber-400 text-amber-950'
                          : 'border-white/40',
                      )}
                    >
                      {active && <Check className="w-4 h-4" />}
                    </span>
                  </button>
                )
              })}

              <button
                onClick={day?.quickFilled ? () => goTo('spesenMore') : advanceDay}
                className="mt-2 w-full py-4 rounded-2xl bg-gradient-to-r from-otis-500 to-emerald-500 text-white font-bold text-lg shadow-lg shadow-otis-500/25 hover:shadow-otis-500/40 hover:brightness-110 active:scale-[0.98] transition-all"
              >
                {t('wizard.next')}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ─── Sub-components ───

interface Suggestion {
  label: string
  sublabel: string
  onSelect: () => void
}

/** A single text-input question (Anlagen-Nr. / Projekt-Nr. / Adresse). */
function TextStep({
  initialValue,
  placeholder,
  autoCapitalize,
  suggestionsFor,
  onNext,
}: {
  initialValue: string
  placeholder?: string
  autoCapitalize?: 'characters' | 'words' | 'none'
  suggestionsFor?: (value: string) => Suggestion[]
  onNext: (value: string) => void
}) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initialValue)
  const suggestions = suggestionsFor ? suggestionsFor(value) : []

  return (
    <div>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && value.trim().length > 0) {
            e.preventDefault()
            onNext(value.trim())
          }
        }}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoFocus
        enterKeyHint="next"
        className="w-full px-5 py-4 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white text-lg font-semibold placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-otis-400/60 focus:border-transparent"
      />

      {suggestions.length > 0 && (
        <div className="mt-3 space-y-1.5 max-h-44 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={s.onSelect}
              className="w-full flex items-center justify-between gap-2 p-3 rounded-xl bg-white/10 border border-white/15 hover:bg-white/20 text-left transition-all active:scale-[0.98]"
            >
              <span className="font-bold text-white text-sm flex-shrink-0">{s.label}</span>
              <span className="text-xs text-white/60 truncate">{s.sublabel}</span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={() => value.trim().length > 0 && onNext(value.trim())}
        disabled={value.trim().length === 0}
        className="mt-4 w-full py-4 rounded-2xl bg-gradient-to-r from-otis-500 to-emerald-500 text-white font-bold text-lg shadow-lg shadow-otis-500/25 hover:shadow-otis-500/40 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
      >
        {t('wizard.next')}
      </button>
    </div>
  )
}

/** Scrollable picker of lift activity codes (productive + non-productive). */
function ActivityStep({
  codes,
  selected,
  productiveLabel,
  nonProductiveLabel,
  onSelect,
}: {
  codes: ActivityCode[]
  selected: string
  productiveLabel: string
  nonProductiveLabel: string
  onSelect: (code: string) => void
}) {
  const productive = codes.filter((c) => c.category === 'productive')
  const nonProductive = codes.filter((c) => c.category === 'non_productive')

  const renderGroup = (group: ActivityCode[], icon: 'wrench' | 'circle') => (
    <div className="grid grid-cols-3 gap-1.5">
      {group.map((c) => {
        const active = c.code === selected
        return (
          <button
            key={c.id}
            onClick={() => onSelect(c.code)}
            className={cn(
              'py-3.5 rounded-xl font-bold text-base transition-all active:scale-95 flex flex-col items-center gap-1 border',
              active
                ? 'bg-gradient-to-r from-otis-500 to-emerald-500 text-white shadow-lg shadow-otis-500/30 border-transparent'
                : 'bg-white/10 text-white/90 hover:bg-white/20 border-white/10',
            )}
          >
            <span className="flex items-center gap-1">
              {icon === 'wrench' ? (
                <Wrench className="w-4 h-4 opacity-80" />
              ) : (
                <XCircle className="w-4 h-4 opacity-80" />
              )}
              {c.code}
            </span>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="max-h-[55vh] overflow-y-auto rounded-3xl p-3 bg-white/10 backdrop-blur-xl border border-white/15 space-y-4">
      {productive.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-otis-200/70 mb-2 px-1">
            {productiveLabel}
          </p>
          {renderGroup(productive, 'wrench')}
        </div>
      )}
      {nonProductive.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/70 mb-2 px-1">
            {nonProductiveLabel}
          </p>
          {renderGroup(nonProductive, 'circle')}
        </div>
      )}
    </div>
  )
}

/**
 * Compact iOS-style time wheel (hours + minutes columns, 3 rows visible).
 * Takes far less space than a full time grid; honors the `min` constraint
 * by hiding hours before it and dropping minutes before it on the same hour.
 */
const WHEEL_ROW_H = 44
const WHEEL_VISIBLE = 3
const WHEEL_MINUTES = [0, 15, 30, 45]
/** Mouse-wheel damping: a 100px notch scrolls ~45px ≈ a single 44px row. */
const WHEEL_DAMPEN = 0.45
/** Pause after scrolling stops before the column snaps to the nearest row. */
const WHEEL_SNAP_DELAY = 120

function TimeWheel({
  min,
  defaultValue,
  onSelect,
}: {
  min?: number
  defaultValue?: number
  onSelect: (value: number) => void
}) {
  const { t } = useTranslation()

  const initial = useMemo(() => {
    const base = defaultValue ?? min ?? 7.5
    let h = Math.max(6, Math.min(19, Math.floor(base)))
    let m = Math.round((base - Math.floor(base)) * 60)
    if (min != null) {
      const minFloor = Math.floor(min)
      const minMinute = Math.round((min - minFloor) * 60)
      if (h < minFloor) {
        h = minFloor
        m = minMinute
      } else if (h === minFloor && m < minMinute) {
        m = minMinute
      }
    }
    return { h, m }
  }, [min, defaultValue])

  const [hour, setHour] = useState(initial.h)
  const [minute, setMinute] = useState(initial.m)

  const minFloor = min != null ? Math.floor(min) : 6
  const minMinute = min != null ? Math.round((min - minFloor) * 60) : 0

  const hours = useMemo(() => {
    const all: number[] = []
    for (let h = 6; h <= 19; h++) all.push(h)
    return all.filter((h) => h >= minFloor)
  }, [minFloor])

  const minutes = useMemo(() => {
    if (hour === minFloor) return WHEEL_MINUTES.filter((m) => m >= minMinute)
    return WHEEL_MINUTES
  }, [hour, minFloor, minMinute])

  // Keep the minute within range when the hour change drops it from the list
  const effectiveMinute = minutes.includes(minute) ? minute : (minutes[0] ?? 0)
  const value = hour + effectiveMinute / 60

  return (
    <div>
      <div
        className="relative rounded-3xl bg-white/10 backdrop-blur-xl border border-white/15 overflow-hidden"
        style={{ height: WHEEL_VISIBLE * WHEEL_ROW_H }}
      >
        {/* Center highlight band */}
        <div className="absolute inset-x-0 bg-white/15 border-y border-white/20 pointer-events-none" style={{ top: WHEEL_ROW_H, height: WHEEL_ROW_H }} />
        <div className="absolute inset-0 flex">
          <WheelColumn items={hours} selected={hour} onSelect={setHour} />
          <WheelColumn items={minutes} selected={effectiveMinute} onSelect={setMinute} />
        </div>
      </div>

      <p className="text-center text-3xl font-bold text-white mt-5 tabular-nums">
        {decimalToTime(value)}
      </p>

      <button
        onClick={() => onSelect(value)}
        className="mt-5 w-full py-4 rounded-2xl bg-gradient-to-r from-otis-500 to-emerald-500 text-white font-bold text-lg shadow-lg shadow-otis-500/25 hover:shadow-otis-500/40 hover:brightness-110 active:scale-[0.98] transition-all"
      >
        {t('wizard.next')}
      </button>
    </div>
  )
}

/** Compact wheel for picking a work-block duration in decimal hours. */
function DurationWheel({
  defaultValue,
  onSelect,
}: {
  defaultValue: number
  onSelect: (value: number) => void
}) {
  const { t } = useTranslation()
  const [duration, setDuration] = useState(defaultValue)

  return (
    <div>
      <div
        className="relative rounded-3xl bg-white/10 backdrop-blur-xl border border-white/15 overflow-hidden"
        style={{ height: WHEEL_VISIBLE * WHEEL_ROW_H }}
      >
        {/* Center highlight band */}
        <div
          className="absolute inset-x-0 bg-white/15 border-y border-white/20 pointer-events-none"
          style={{ top: WHEEL_ROW_H, height: WHEEL_ROW_H }}
        />
        {/* Flex wrapper constrains the column to the container height so the
            wheel is actually scrollable (same pattern as TimeWheel). */}
        <div className="absolute inset-0 flex">
          <WheelColumn
            items={DURATION_OPTIONS}
            selected={duration}
            onSelect={setDuration}
            format={fmtDuration}
          />
        </div>
      </div>

      <p className="text-center text-3xl font-bold text-white mt-5 tabular-nums">
        {fmtDuration(duration)}
      </p>

      <button
        onClick={() => onSelect(duration)}
        className="mt-5 w-full py-4 rounded-2xl bg-gradient-to-r from-otis-500 to-emerald-500 text-white font-bold text-lg shadow-lg shadow-otis-500/25 hover:shadow-otis-500/40 hover:brightness-110 active:scale-[0.98] transition-all"
      >
        {t('wizard.next')}
      </button>
    </div>
  )
}

/** One scrollable wheel column with a centered selected row. */
function WheelColumn({
  items,
  selected,
  onSelect,
  format,
}: {
  items: number[]
  selected: number
  onSelect: (value: number) => void
  /** Optional custom label (e.g. '1h 30min'); defaults to zero-padded numbers. */
  format?: (value: number) => string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Center the selected row when the column mounts or its item list changes.
  // (Not on `selected`: that would re-set scrollTop on every scroll event
  // while dragging and cancel the user's momentum flick.)
  useEffect(() => {
    const idx = items.indexOf(selected)
    if (idx >= 0 && ref.current) ref.current.scrollTop = idx * WHEEL_ROW_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  // Fine-grained wheel control for desktop. The CSS `scroll-snap` made one
  // wheel notch jump 2-3 rows (6 → 9), so we intercept the native wheel event
  // (React's onWheel is passive and cannot preventDefault) and dampen the
  // delta: a 100px notch now moves ~45px ≈ a single 44px row. After scrolling
  // stops (wheel or touch) the column snaps to the nearest row to stay centered.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let snapTimer: number | undefined

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // deltaMode: 0 = pixels, 1 = lines, 2 = pages
      const px =
        e.deltaMode === 1 ? e.deltaY * 24 : e.deltaMode === 2 ? e.deltaY * WHEEL_ROW_H : e.deltaY
      el.scrollTop += px * WHEEL_DAMPEN
    }

    const scheduleSnap = () => {
      window.clearTimeout(snapTimer)
      snapTimer = window.setTimeout(() => {
        const idx = Math.max(
          0,
          Math.min(items.length - 1, Math.round(el.scrollTop / WHEEL_ROW_H)),
        )
        // Instant snap: the jump is at most half a row, and it avoids the
        // transient intermediate values a smooth scroll would emit.
        el.scrollTop = idx * WHEEL_ROW_H
      }, WHEEL_SNAP_DELAY)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('scroll', scheduleSnap, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('scroll', scheduleSnap)
      window.clearTimeout(snapTimer)
    }
  }, [items])

  const handleScroll = () => {
    const el = ref.current
    if (!el) return
    const idx = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / WHEEL_ROW_H)))
    const v = items[idx]
    if (v !== undefined && v !== selected) onSelect(v)
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none' }}
    >
      <div style={{ height: WHEEL_ROW_H }} />
      {items.map((v) => (
        <div
          key={v}
          onClick={() => {
            if (ref.current) ref.current.scrollTop = items.indexOf(v) * WHEEL_ROW_H
          }}
          className="flex items-center justify-center"
          style={{ height: WHEEL_ROW_H }}
        >
          <span
            className={cn(
              'text-lg font-semibold tabular-nums transition-colors',
              v === selected ? 'text-white' : 'text-white/40',
            )}
          >
            {format ? format(v) : String(v).padStart(2, '0')}
          </span>
        </div>
      ))}
      <div style={{ height: WHEEL_ROW_H }} />
    </div>
  )
}
