import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from '@/lib/useTranslation'
import { useAppStore } from '@/stores/appStore'
import { useTimeEntries } from '@/hooks/useTimeEntries'
import { useShallow } from 'zustand/react/shallow'
import { getWeekDates, decimalToTime } from '@/lib/utils'
import { DAY_NAMES } from '@/lib/translations'
import type { TranslationKey } from '@/lib/translations'
import type { ActivityCode, ExpenseType, TimeEntry } from '@/lib/types'
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
} from 'lucide-react'
import { cn } from '@/lib/cn'

/** One work block (a lift visit): plant data + start time + duration. */
interface WorkBlock {
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

/** Default start time for absence days (07:00). */
const ABSENCE_START = 7

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
  | 'absence'
  | 'anlage'
  | 'projekt'
  | 'adresse'
  | 'activity'
  | 'start'
  | 'duration'
  | 'lunchQ'
  | 'lunchStart'
  | 'lunchDuration'
  | 'moreLifts'
  | 'spesen'
  | 'expenses'

/** History entry so the Back button can walk back through dynamic phases. */
interface HistoryEntry {
  dayIndex: number
  phase: Phase
  blockIndex: number
}

const PHASE_RANK: Record<Phase, number> = {
  worked: 0,
  absence: 1,
  anlage: 2,
  projekt: 3,
  adresse: 4,
  activity: 5,
  start: 6,
  duration: 7,
  lunchQ: 8,
  lunchStart: 9,
  lunchDuration: 10,
  moreLifts: 11,
  spesen: 12,
  expenses: 13,
}

const PHASES_PER_DAY = 14

/** Phases that show a lift counter badge. */
const BLOCK_BADGE_PHASES: Phase[] = ['anlage', 'projekt', 'adresse', 'activity', 'start', 'duration']

function fmtDuration(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m} min`
  if (m === 0) return `${h}h`
  return `${h}h ${m}min`
}

/** YYYY-MM-DD → DD.MM. */
function shortDate(dateStr: string): string {
  const [, mm, dd] = dateStr.split('-')
  return `${dd}.${mm}.`
}

export function WizardPage() {
  const navigate = useNavigate()
  const { t, language } = useTranslation()
  const { currentWeek, dailyExpenses, toggleExpense, activityCodes, locations } = useAppStore(
    useShallow((s) => ({
      currentWeek: s.currentWeek,
      dailyExpenses: s.dailyExpenses,
      toggleExpense: s.toggleExpense,
      activityCodes: s.activityCodes,
      locations: s.locations,
    })),
  )
  const { addEntry } = useTimeEntries()

  const dates = useMemo(() => getWeekDates(currentWeek.year, currentWeek.week), [currentWeek])
  const dayNames = DAY_NAMES[language]

  const [days, setDays] = useState<DayPlan[]>(() => Array.from({ length: TOTAL_DAYS }, emptyDay))
  const [dayIndex, setDayIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('worked')
  const [blockIndex, setBlockIndex] = useState(0) // index of the block currently being entered
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const updateDay = (patch: Partial<DayPlan>) => {
    setDays((prev) => prev.map((d, i) => (i === dayIndex ? { ...d, ...patch } : d)))
  }

  const emptyBlock = (): WorkBlock => ({
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
    if (isLastDay) {
      setDayIndex(TOTAL_DAYS)
    } else {
      setDayIndex((i) => i + 1)
    }
    setPhase('worked')
    setBlockIndex(0)
  }

  const goTo = (p: Phase, bi?: number) => {
    pushHistory()
    setError(null)
    setPhase(p)
    if (bi !== undefined) setBlockIndex(bi)
  }

  const goBack = () => {
    setError(null)
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
      .map((l) => ({
        label: l.anlagenummer,
        sublabel: `${l.project_id} · ${l.full_address}`,
        onSelect: () => {
          setBlockField({
            anlagenummer: l.anlagenummer,
            projektnummer: l.project_id,
            adresse: l.full_address,
          })
          goTo('activity')
        },
      }))
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
          <div className="w-full glass-strong dark:glass-dark rounded-3xl p-7 shadow-2xl">
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
      case 'absence':
        return t('wizard.absence.title')
      case 'anlage':
        return t('wizard.anlage')
      case 'projekt':
        return t('wizard.projekt')
      case 'adresse':
        return t('wizard.adresse')
      case 'activity':
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
      default:
        return t('wizard.expenses')
    }
  })()

  const handleBlockStart = (start: number) => {
    const idx = blockIndex
    setBlockField({ start })
    goTo('duration', idx)
  }

  const handleBlockDuration = (duration: number) => {
    const idx = blockIndex
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
            <span className="inline-flex items-center px-2.5 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/15 text-xs">
              {dayNames[dayIndex]}, {shortDate(dates[dayIndex])}
            </span>
          </div>
          <button
            onClick={exit}
            className="flex items-center justify-center w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all active:scale-95"
            aria-label={t('wizard.exit')}
          >
            <X className="w-5 h-5" />
          </button>
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

          {/* Block counter badge for per-lift phases */}
          {BLOCK_BADGE_PHASES.includes(phase) && (
            <div className="flex items-center justify-center gap-2 mb-5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur border border-white/15 text-white/90 text-sm font-semibold">
                <Building2 className="w-4 h-4 text-otis-300" />
                {t('wizard.block', { n: blockIndex + 1 })}
              </span>
            </div>
          )}

          {phase === 'worked' && (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => {
                  updateDay({ status: 'work', absenceCode: null, lunchSkipped: false })
                  goTo('anlage')
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
                updateDay({ lunch: true, lunchStart: v })
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
                onClick={() => goTo('anlage', day!.blocks.length)}
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
                onClick={advanceDay}
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
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-otis-200/70 mb-2 px-1">
          {productiveLabel}
        </p>
        {renderGroup(productive, 'wrench')}
      </div>
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
