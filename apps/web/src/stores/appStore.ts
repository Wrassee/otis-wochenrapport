import { create } from 'zustand'
import type {
  TimeEntry,
  Profile,
  Location,
  FavoriteLocation,
  WeekSummary,
  ActivityCode,
  SyncStatus,
  DailyExpense,
  DailyExpensesMap,
  ExpenseType,
  ExpensePhoto,
  DayError,
} from '@/lib/types'
import * as localDb from '@/db/indexeddb'
import {
  getToday,
  getWeekDates,
  getWeekInfo,
  getWeekKey,
  haversineDistance,
  calculateZone,
  generateId,
} from '@/lib/utils'
import { REFERENCE_LAT, REFERENCE_LON, ACTIVITY_CODES } from '@/lib/constants'
import type { Language } from '@/lib/translations'
import { DAY_NAMES } from '@/lib/translations'
import {
  getProfile,
  upsertFavorite,
  getFavorites,
  getExpenses,
  getWeekEntries,
  upsertExpensePhoto,
  deleteExpensePhotoFromSupabase,
  subscribeExpensePhotoChanges,
  subscribeDailyExpenseChanges,
  subscribeFavoriteChanges,
  updateProfileLanguage,
} from '@/db/supabase'
import { syncExpenses as queueExpensesSync } from '@/lib/syncExpenses'
import { loadWeekExpensePhotos, markPhotoDeleted, clearPhotoDeleted } from '@/lib/expensePhotos'
import { fileToPhotoDataUrl } from '@/lib/photoUtils'

/** In-flight guard: prevents duplicate parallel loads of the same photo week. */
const photoLoadsInFlight = new Set<string>()

/** Realtime photo-change subscription cleanup handle (per signed-in user). */
let photoRealtimeUnsubscribe: (() => void) | null = null

/** Debounce timer for realtime photo reloads — batches rapid events into one fetch. */
let photoRealtimeTimer: ReturnType<typeof setTimeout> | null = null

/** Realtime expense-change subscription cleanup handle (per signed-in user). */
let expenseRealtimeUnsubscribe: (() => void) | null = null

/** Debounce timer for persisting realtime expense changes to IndexedDB. */
let expenseRealtimeTimer: ReturnType<typeof setTimeout> | null = null

/** Realtime favorite-change subscription cleanup handle (per signed-in user). */
let favoriteRealtimeUnsubscribe: (() => void) | null = null

/**
 * Reject after N ms so a hanging network call can never block app init forever
 * (the Woche page renders its spinner while the store's `isLoading` is true,
 * so a stuck initialize() would leave it spinning indefinitely).
 */
function withTimeout<T>(promise: Promise<T>, ms = 8000, label = 'supabase'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}/**
 * Collect all expenses from the dailyExpenses map into a flat array
 * and queue a background sync to Supabase (debounced 2 s).
 */
function queueAllExpensesSync(dailyExpenses: Record<string, DailyExpense[]>, userId: string): void {
  const all: Array<{ date: string; expense_type: string; value: number }> = []
  for (const [d, exps] of Object.entries(dailyExpenses)) {
    for (const exp of exps) {
      all.push({ date: d, expense_type: exp.expense_type, value: exp.value })
    }
  }
  queueExpensesSync(all, userId)
}

/**
 * Map a Supabase time_entries row (with the `locations!left` join) into the
 * local TimeEntry shape used by the store and the Excel generator.
 */
function remoteRowToTimeEntry(row: Record<string, any>): TimeEntry {
  const loc = (row.locations as Record<string, any> | null) || {}
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    date: String(row.date),
    start_time: Number(row.start_time) || 0,
    duration: Number(row.duration) || 0,
    location_id: row.location_id != null ? String(row.location_id) : null,
    activity_code_id: row.activity_code_id != null ? String(row.activity_code_id) : null,
    activity_code: row.activity_code != null ? String(row.activity_code) : null,
    is_lunch: !!row.is_lunch,
    notes: row.notes || '',
    synced: true, // pulled from the cloud — already uploaded, don't re-queue
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || new Date().toISOString(),
    location_anlagenummer: loc.anlagenummer != null ? String(loc.anlagenummer) : undefined,
    location_project_id: loc.project_id != null ? String(loc.project_id) : undefined,
    location_address: loc.full_address != null ? String(loc.full_address) : undefined,
    location_zone: loc.zone != null ? Number(loc.zone) : undefined,
  }
}

interface AppState {
  // Auth
  user: { id: string; email: string } | null
  profile: Profile | null
  isAuthenticated: boolean

  // Data
  timeEntries: TimeEntry[]
  locations: Location[]
  activityCodes: ActivityCode[]
  favoriteLocations: FavoriteLocation[]
  dailyExpenses: DailyExpensesMap
  /** Receipt photos (Spesen Belege), keyed by `${year}-${week}`. */
  expensePhotos: Record<string, ExpensePhoto[]>

  // Localisation
  language: Language
  theme: 'system' | 'light' | 'dark'

  // UI State
  currentDate: string
  currentWeek: { year: number; week: number }
  weekSummary: WeekSummary | null
  syncStatus: SyncStatus
  isLoading: boolean

  // Actions
  setTheme: (theme: 'system' | 'light' | 'dark') => void
  setLanguage: (lang: Language) => void
  setUser: (user: { id: string; email: string } | null) => void
  setProfile: (profile: Profile | null) => void
  setCurrentDate: (date: string) => void
  setCurrentWeek: (year: number, week: number) => void
  setSyncStatus: (status: Partial<SyncStatus>) => void
  setLocations: (locations: Location[]) => void
  setTimeEntries: (entries: TimeEntry[]) => void
  setFavoriteLocations: (favorites: FavoriteLocation[]) => void
  setActivityCodes: (codes: ActivityCode[]) => void

  // Entry operations
  addTimeEntry: (
    entry: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'synced'>,
  ) => Promise<void>
  updateTimeEntry: (entry: TimeEntry) => Promise<void>
  deleteTimeEntry: (entryId: string) => Promise<void>
  quickAddDuration: (existingEntry: TimeEntry, extraDuration: number) => Promise<void>

  // Week operations
  loadWeekEntries: () => Promise<void>
  calculateWeekSummary: () => Promise<void>

  // Expense operations
  setDailyExpenses: (date: string, expenses: DailyExpense[]) => void
  toggleExpense: (date: string, expenseType: ExpenseType) => void
  setExpenseValue: (date: string, expenseType: ExpenseType, value: number) => void

  // Expense photo operations (Spesen Belege)
  loadExpensePhotos: (year: number, week: number, force?: boolean) => Promise<void>
  addExpensePhoto: (file: File, year: number, week: number) => Promise<ExpensePhoto | null>
  updateExpensePhotoNote: (year: number, week: number, id: string, note: string) => Promise<void>
  removeExpensePhoto: (year: number, week: number, id: string) => Promise<void>

  // Location operations
  searchLocations: (query: string) => Promise<Location[]>
  addRecentLocation: (location: Location) => Promise<void>

  // Init
  initialize: (userId: string) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  profile: null,
  isAuthenticated: false,
  timeEntries: [],
  locations: [],
  activityCodes: ACTIVITY_CODES,
  favoriteLocations: [],
  currentDate: getToday(),
  currentWeek: (() => {
    const info = getWeekInfo(getToday())
    return { year: info.year, week: info.week }
  })(),
  weekSummary: null,
  syncStatus: { online: navigator.onLine, syncing: false, pendingSync: 0, lastSync: null },
  isLoading: false,
  dailyExpenses: {},
  expensePhotos: {},
  language: (localStorage.getItem('otis_language') as Language) || 'de',
  theme: (localStorage.getItem('otis_theme') as 'system' | 'light' | 'dark') || 'system',

  setTheme: (theme) => {
    localStorage.setItem('otis_theme', theme)
    set({ theme })
    // Immediately apply the theme class
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else if (theme === 'light') {
      root.classList.remove('dark')
    } else {
      // 'system' — follow OS preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.toggle('dark', prefersDark)
    }
  },

  setLanguage: async (lang) => {
    localStorage.setItem('otis_language', lang)
    set({ language: lang })

    // Sync language preference to Supabase profile — offline-first:
    // online → push immediately; offline (or push failure) → queue a
    // language_sync so the background sync retries once connectivity returns
    // (IndexedDB queue survives app restarts, so it is never lost).
    const { user } = get()
    const profile = get().profile
    let pushed = false
    if (user && navigator.onLine) {
      try {
        await updateProfileLanguage(user.id, lang)
        pushed = true
      } catch (e) {
        console.warn('Failed to sync language to Supabase:', e)
      }
    }
    if (user && !pushed) {
      await localDb.addToSyncQueue({
        type: 'language_sync',
        userId: user.id,
        language: lang,
        timestamp: Date.now(),
      })
    }

    // Keep the locally cached profile in sync so an offline app restart
    // shows the same language (initialize() prefers the IndexedDB profile
    // over localStorage). updated_at is bumped only when the cloud push is
    // queued — the fresh local choice must win until it reaches the cloud;
    // on a successful push the remote row is newer, so it stays authoritative.
    if (profile) {
      const updated = pushed
        ? { ...profile, language: lang }
        : { ...profile, language: lang, updated_at: new Date().toISOString() }
      get().setProfile(updated)
    }
  },

  setUser: (user) => {
    // Logged out — tear down the realtime photo subscription for this user
    // and cancel any pending debounced reload.
    if (!user && photoRealtimeUnsubscribe) {
      photoRealtimeUnsubscribe()
      photoRealtimeUnsubscribe = null
    }
    if (!user && photoRealtimeTimer) {
      clearTimeout(photoRealtimeTimer)
      photoRealtimeTimer = null
    }
    // Logged out — also tear down the realtime expense subscription.
    if (!user && expenseRealtimeUnsubscribe) {
      expenseRealtimeUnsubscribe()
      expenseRealtimeUnsubscribe = null
    }
    if (!user && expenseRealtimeTimer) {
      clearTimeout(expenseRealtimeTimer)
      expenseRealtimeTimer = null
    }
    // Logged out — also tear down the realtime favorites subscription.
    if (!user && favoriteRealtimeUnsubscribe) {
      favoriteRealtimeUnsubscribe()
      favoriteRealtimeUnsubscribe = null
    }
    set({ user, isAuthenticated: !!user })
  },

  setProfile: (profile) => {
    set({ profile })
    if (profile) {
      localDb.saveLocalProfile(profile)
      // Sync language from Supabase profile if available
      if (profile.language && profile.language !== get().language) {
        const lang = profile.language as Language
        localStorage.setItem('otis_language', lang)
        set({ language: lang })
      }
    }
  },

  /**
   * Set the displayed day AND keep the week context in sync — photos, entries
   * and summaries are all grouped by week, so when the day crosses a week
   * boundary the active week must follow it (single source of truth).
   */
  setCurrentDate: (date) => {
    const info = getWeekInfo(date)
    set((state) => ({
      currentDate: date,
      currentWeek:
        info.year !== state.currentWeek.year || info.week !== state.currentWeek.week
          ? { year: info.year, week: info.week }
          : state.currentWeek,
    }))
  },

  /**
   * Set the active week AND keep the displayed day in sync — the Dashboard is
   * day-based, so the day must jump to the Monday of the selected week.
   * Together with setCurrentDate (which syncs the week), this keeps one single
   * week context across Dashboard / Woche / Spesen / Export.
   */
  setCurrentWeek: (year, week) =>
    set({ currentWeek: { year, week }, currentDate: getWeekDates(year, week)[0] }),

  setSyncStatus: (status) =>
    set((state) => ({
      syncStatus: { ...state.syncStatus, ...status },
    })),

  setLocations: (locations) => set({ locations }),

  setTimeEntries: (entries) => set({ timeEntries: entries }),

  setFavoriteLocations: (favorites) => set({ favoriteLocations: favorites }),

  setActivityCodes: (codes) => set({ activityCodes: codes }),

  addTimeEntry: async (entryData) => {
    const { user } = get()
    if (!user) return

    const entry: TimeEntry = {
      ...entryData,
      id: generateId(),
      user_id: user.id,
      synced: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Save locally first (offline-first)
    await localDb.saveEntry(entry)

    // Update state
    set((state) => ({
      timeEntries: [...state.timeEntries, entry],
    }))

    // Refresh week summary
    get().calculateWeekSummary()
  },

  updateTimeEntry: async (entry) => {
    const updated = { ...entry, updated_at: new Date().toISOString(), synced: false }
    await localDb.saveEntry(updated)
    set((state) => ({
      timeEntries: state.timeEntries.map((e) => (e.id === entry.id ? updated : e)),
    }))
    get().calculateWeekSummary()
  },

  deleteTimeEntry: async (entryId) => {
    await localDb.deleteEntry(entryId)
    set((state) => ({
      timeEntries: state.timeEntries.filter((e) => e.id !== entryId),
    }))
    get().calculateWeekSummary()
  },

  quickAddDuration: async (existingEntry, extraDuration) => {
    const updated = {
      ...existingEntry,
      duration: existingEntry.duration + extraDuration,
      updated_at: new Date().toISOString(),
      synced: false,
    }
    await localDb.saveEntry(updated)
    set((state) => ({
      timeEntries: state.timeEntries.map((e) => (e.id === existingEntry.id ? updated : e)),
    }))
    get().calculateWeekSummary()
  },

  loadWeekEntries: async () => {
    const { user, currentWeek } = get()
    if (!user) return

    const dates = getWeekDates(currentWeek.year, currentWeek.week)
    const startDate = dates[0]
    const endDate = dates[4]

    // Local-first: load what's on this device immediately (offline-safe).
    const localEntries = await localDb.getAllEntriesForWeek(user.id, startDate, endDate)
    set({ timeEntries: localEntries })

    // Cross-device pull: when online, merge the same week from Supabase so
    // entries recorded on another device (e.g. the phone) appear here too.
    // Remote wins for conflicts; locally-unsynced rows are kept (they'll be
    // pushed by the background sync); synced rows missing remotely were
    // deleted elsewhere and are dropped locally so they can't resurrect.
    if (navigator.onLine) {
      try {
        const remoteRows = await withTimeout(
          getWeekEntries(user.id, startDate, endDate),
          8000,
          'getWeekEntries',
        )
        // Empty remote result is NOT "everything was deleted elsewhere" — it
        // can be a transient network/RLS oddity. Guard: only merge (and only
        // drop synced-remote-missing rows) when the fetch actually returned
        // rows, otherwise keep the local week untouched.
        if (remoteRows.length > 0) {
          const byId = new Map<string, TimeEntry>(localEntries.map((e) => [e.id, e]))
          const merged: TimeEntry[] = []
          const seenRemote = new Set<string>()
          const pendingDelete: string[] = []

          for (const row of remoteRows) {
            seenRemote.add(String(row.id))
            const local = byId.get(String(row.id))
            if (local && !local.synced) {
              // Local has unsynced edits → local wins, will be pushed soon.
              merged.push(local)
            } else {
              merged.push(remoteRowToTimeEntry(row))
            }
          }
          // Local-only rows: keep unsynced (pending) ones; drop synced rows
          // that no longer exist remotely (deleted on another device).
          for (const local of localEntries) {
            if (!seenRemote.has(local.id)) {
              if (!local.synced) {
                merged.push(local)
              } else {
                pendingDelete.push(local.id)
              }
            }
          }

          if (pendingDelete.length > 0) {
            await localDb.removeEntriesLocally(pendingDelete)
          }
          // Persist the merge without re-queueing (pulled rows keep synced=true).
          await localDb.saveEntriesPreservingSync(merged)
          // Stable display order: date, then start time.
          merged.sort((a, b) => a.date.localeCompare(b.date) || a.start_time - b.start_time)
          set({ timeEntries: merged })
        }
      } catch (e) {
        console.warn('Failed to pull week entries from Supabase:', e)
      }
    }
  },

  calculateWeekSummary: async () => {
    const { timeEntries, currentWeek, language } = get()
    const dates = getWeekDates(currentWeek.year, currentWeek.week)
    const dayNames = DAY_NAMES[language]

    const days = dates.map((date, index) => {
      const dayEntries = timeEntries
        .filter((e) => e.date === date)
        .sort((a, b) => a.start_time - b.start_time)
      const lunchEntries = dayEntries.filter((e) => e.is_lunch)
      const workEntries = dayEntries.filter((e) => !e.is_lunch)

      const totalHours = workEntries.reduce((sum, e) => sum + e.duration, 0)
      const lunchMinutes = lunchEntries.reduce((sum, e) => sum + e.duration * 60, 0)

      const requiredHours = index === 4 ? 8.0 : 8.5
      // Structured, localized errors — keys + params are resolved to text via
      // t(error.key, error.params) in DayCard, so the UI follows the selected
      // app language (not hardcoded German).
      const errors: DayError[] = []

      if (totalHours < requiredHours) {
        errors.push({
          key: 'week.error.hours',
          params: { hours: totalHours.toFixed(1), required: requiredHours },
        })
      }

      if (lunchEntries.length === 0 && totalHours > 0) {
        errors.push({ key: 'week.error.noLunch' })
      } else if (lunchMinutes < 30) {
        errors.push({ key: 'week.error.lunchShort', params: { min: Math.round(lunchMinutes) } })
      } else if (lunchMinutes > 60) {
        errors.push({ key: 'week.error.lunchLong', params: { min: Math.round(lunchMinutes) } })
      }

      // Calculate max zone for the day
      const maxZone = dayEntries.reduce((max, e) => {
        return e.location_zone ? Math.max(max, e.location_zone) : max
      }, 0)

      return {
        date,
        dayName: dayNames[index],
        dayNumber: index + 1,
        totalHours,
        lunchMinutes,
        hasLunch: lunchEntries.length > 0,
        entries: dayEntries,
        requiredHours,
        isValid: errors.length === 0,
        errors,
        maxZone,
      }
    })

    const totalHours = days.reduce((sum, d) => sum + d.totalHours, 0)

    const weekSummary: WeekSummary = {
      year: currentWeek.year,
      weekNumber: currentWeek.week,
      days,
      totalHours,
      startDate: dates[0],
      endDate: dates[4],
    }

    set({ weekSummary })
  },

  setDailyExpenses: (date, expenses) => {
    set((state) => ({
      dailyExpenses: { ...state.dailyExpenses, [date]: expenses },
    }))
  },

  toggleExpense: (date, expenseType) => {
    const newState = (() => {
      const current = get().dailyExpenses[date] || []
      const existing = current.find((e) => e.expense_type === expenseType)
      if (existing) {
        // Remove if already set
        return {
          dailyExpenses: {
            ...get().dailyExpenses,
            [date]: current.filter((e) => e.expense_type !== expenseType),
          },
        }
      } else {
        // Add with default value 1 (privatfahrzeug starts with 10 km)
        return {
          dailyExpenses: {
            ...get().dailyExpenses,
            [date]: [
              ...current,
              {
                date,
                expense_type: expenseType,
                value: expenseType === 'privatfahrzeug' ? 10 : expenseType === 'material' ? 0 : 1,
              },
            ],
          },
        }
      }
    })()
    set(newState)
    // Persist to IndexedDB
    localDb
      .saveDailyExpenses(newState.dailyExpenses)
      .catch((e) => console.warn('Failed to persist expenses to IndexedDB:', e))

    // Queue background sync to Supabase
    const { user } = get()
    if (user) {
      queueAllExpensesSync(newState.dailyExpenses, user.id)
    }
  },

  setExpenseValue: (date, expenseType, value) => {
    const newState = (() => {
      const current = get().dailyExpenses[date] || []
      const existing = current.find((e) => e.expense_type === expenseType)
      if (existing) {
        return {
          dailyExpenses: {
            ...get().dailyExpenses,
            [date]: current.map((e) => (e.expense_type === expenseType ? { ...e, value } : e)),
          },
        }
      }
      return { dailyExpenses: get().dailyExpenses }
    })()
    set(newState)
    // Persist to IndexedDB
    localDb
      .saveDailyExpenses(newState.dailyExpenses)
      .catch((e) => console.warn('Failed to persist expenses to IndexedDB:', e))

    // Queue background sync to Supabase
    const { user } = get()
    if (user) {
      queueAllExpensesSync(newState.dailyExpenses, user.id)
    }
  },

  loadExpensePhotos: async (year, week, force = false) => {
    // In-flight guard — Dashboard, Woche, Spesen and Export each call this on
    // mount; without it the same week would be fetched 4× in parallel.
    // Realtime events pass force=true so a fresh photo is never missed, even
    // if a mount load for the same week is currently running.
    const key = getWeekKey(year, week)
    if (!force && photoLoadsInFlight.has(key)) return
    photoLoadsInFlight.add(key)
    try {
      const { user } = get()
      const list = await loadWeekExpensePhotos(user?.id, year, week)
      set((state) => ({
        expensePhotos: { ...state.expensePhotos, [key]: list },
      }))
    } finally {
      photoLoadsInFlight.delete(key)
    }
  },

  addExpensePhoto: async (file, year, week) => {
    const { user } = get()
    if (!user) return null

    const dataUrl = await fileToPhotoDataUrl(file)
    const photo: ExpensePhoto = {
      id: generateId(),
      user_id: user.id,
      year,
      week,
      filename: `Beleg_KW${week}_${Date.now()}.jpg`,
      dataUrl,
      created_at: new Date().toISOString(),
    }

    // Offline-first: persist locally, then best-effort sync to cloud
    await localDb.saveExpensePhoto(photo)
    set((state) => ({
      expensePhotos: {
        ...state.expensePhotos,
        [getWeekKey(year, week)]: [photo, ...(state.expensePhotos[getWeekKey(year, week)] || [])],
      },
    }))
    if (navigator.onLine) {
      try {
        await upsertExpensePhoto({
          id: photo.id,
          user_id: photo.user_id,
          year: photo.year,
          week: photo.week,
          filename: photo.filename,
          data_url: photo.dataUrl,
          created_at: photo.created_at,
        })
      } catch (err) {
        console.warn('Failed to sync receipt photo to Supabase:', err)
      }
    }
    return photo
  },

  updateExpensePhotoNote: async (year, week, id, note) => {
    const key = getWeekKey(year, week)
    let current = get().expensePhotos[key]?.find((p) => p.id === id)
    // Defensive fallback: if the week isn't loaded into the store yet (e.g. the
    // note button was tapped right after mount), look the photo up in the local
    // DB so the edit is never silently dropped.
    if (!current) {
      const saved = await localDb.getExpensePhotos(year, week)
      current = saved.find((p) => p.id === id)
      if (!current) return
    }

    const updated: ExpensePhoto = { ...current, note: note.trim() || undefined }
    await localDb.saveExpensePhoto(updated)
    set((state) => ({
      expensePhotos: {
        ...state.expensePhotos,
        [key]: (state.expensePhotos[key] || []).map((p) => (p.id === id ? updated : p)),
      },
    }))
    if (navigator.onLine) {
      try {
        await upsertExpensePhoto({
          id: updated.id,
          user_id: updated.user_id,
          year: updated.year,
          week: updated.week,
          filename: updated.filename,
          data_url: updated.dataUrl,
          // Send '' (not undefined) so a cleared note actually clears the
          // cloud column — JSON.stringify drops undefined keys, which would
          // leave the stale note behind and resurrect it on the next merge.
          note: updated.note ?? '',
          created_at: updated.created_at,
        })
      } catch (err) {
        console.warn('Failed to sync receipt photo note to Supabase:', err)
      }
    }
  },

  removeExpensePhoto: async (year, week, id) => {
    const { user } = get()
    if (!user) return

    // Offline-first: tombstone + local delete, then best-effort cloud delete.
    // The tombstone prevents the photo from resurrecting on the next merge
    // if the cloud delete fails (offline). It is purged once the cloud
    // delete succeeds (see lib/expensePhotos.ts).
    markPhotoDeleted(user.id, id)
    await localDb.deleteExpensePhoto(id)
    const key = getWeekKey(year, week)
    set((state) => ({
      expensePhotos: {
        ...state.expensePhotos,
        [key]: (state.expensePhotos[key] || []).filter((p) => p.id !== id),
      },
    }))
    if (navigator.onLine) {
      try {
        await deleteExpensePhotoFromSupabase(id)
        clearPhotoDeleted(user.id, id)
      } catch (err) {
        console.warn('Failed to delete receipt photo from Supabase:', err)
      }
    }
  },

  searchLocations: async (query) => {
    return localDb.searchLocations(query)
  },

  addRecentLocation: async (location) => {
    await localDb.addFavoriteLocation({
      anlagenummer: location.anlagenummer,
      project_id: location.project_id,
      full_address: location.full_address,
      latitude: location.latitude,
      longitude: location.longitude,
      zone: location.zone,
    })
    const favorites = await localDb.getFavoriteLocations()
    set({ favoriteLocations: favorites.slice(0, 5) })

    // Also sync to Supabase if online
    const { user } = get()
    if (user && navigator.onLine) {
      try {
        const fav = favorites.find((f) => f.anlagenummer === location.anlagenummer)
        await upsertFavorite({
          user_id: user.id,
          anlagenummer: location.anlagenummer,
          project_id: location.project_id,
          full_address: location.full_address,
          latitude: location.latitude,
          longitude: location.longitude,
          zone: location.zone,
          use_count: fav?.use_count ?? 1,
        })
      } catch (e) {
        console.warn('Failed to sync favorite to Supabase:', e)
      }
    }
  },

  initialize: async (userId) => {
    set({ isLoading: true })
    try {
      // Load profile from local
      const profile = await localDb.getLocalProfile()
      if (profile) {
        set({ profile })
        // Apply language from locally cached profile
        if (profile.language) {
          const lang = profile.language as Language
          localStorage.setItem('otis_language', lang)
          set({ language: lang })
        }
      }

      // Try to fetch the full profile from Supabase — the cloud is the source
      // of truth, so a brand-new device immediately shows the saved profile
      // (name, personnel number, supervisor email, language). Remote wins for
      // each field, but we fall back to the locally cached value (not an empty
      // string) so an incomplete remote row never wipes offline-first data.
      if (navigator.onLine) {
        try {
          const remoteProfile = await withTimeout(getProfile(userId), 8000, 'getProfile')
          if (remoteProfile) {
            const currentProfile = get().profile
            // Offline-first guard: if the local profile was edited more recently
            // (e.g. saved while offline), don't let a stale remote row overwrite it.
            const localUpdated = currentProfile?.updated_at
              ? new Date(currentProfile.updated_at).getTime()
              : 0
            const remoteUpdated = remoteProfile.updated_at
              ? new Date(remoteProfile.updated_at).getTime()
              : 0
            if (localUpdated <= remoteUpdated) {
              const mergedProfile: Profile = {
                id: remoteProfile.id,
                email: remoteProfile.email || currentProfile?.email || '',
                full_name: remoteProfile.full_name || currentProfile?.full_name || '',
                personnel_number:
                  remoteProfile.personnel_number || currentProfile?.personnel_number || '',
                supervisor_email:
                  remoteProfile.supervisor_email || currentProfile?.supervisor_email || '',
                language: remoteProfile.language || currentProfile?.language || get().language,
                created_at:
                  remoteProfile.created_at ||
                  currentProfile?.created_at ||
                  new Date().toISOString(),
                updated_at: remoteProfile.updated_at || new Date().toISOString(),
              }
              // Reuse the store action: sets state, persists to IndexedDB and
              // applies the language preference if it differs.
              get().setProfile(mergedProfile)
            }
            // If the local profile is NEWER (e.g. edited offline), keep it —
            // a stale remote row must not overwrite it. Either way the rest of
            // the initialization (locations, favorites, expenses, entries,
            // realtime) still runs to completion.
          }
        } catch (e) {
          console.warn('Failed to fetch profile from Supabase:', e)
        }
      }

      // Load locations from local
      const locations = await localDb.getAllLocations()
      if (locations.length > 0) set({ locations })

      // Load favorites — try Supabase first, then local
      let mergedFavorites: FavoriteLocation[] = []
      if (navigator.onLine) {
        try {
          const remoteFavorites = await withTimeout(getFavorites(userId), 8000, 'getFavorites')
          if (remoteFavorites.length > 0) {
            const localFavorites = await localDb.getFavoriteLocations()
            // Merge: remote wins, but keep local-only and preserve use_count
            const seen = new Set<string>()
            const merged: FavoriteLocation[] = []
            // Remote first
            for (const rf of remoteFavorites) {
              seen.add(rf.anlagenummer.toUpperCase())
              merged.push({
                id: rf.id || `fav_${rf.anlagenummer}`,
                user_id: rf.user_id,
                anlagenummer: rf.anlagenummer,
                project_id: rf.project_id || '',
                full_address: rf.full_address || '',
                latitude: rf.latitude || 0,
                longitude: rf.longitude || 0,
                zone: rf.zone || 0,
                manual_zone: rf.manual_zone,
                use_count: Math.max(rf.use_count || 1, 1),
                last_used: rf.last_used,
                created_at: rf.created_at,
                updated_at: rf.updated_at,
              })
            }
            // Local-only items
            for (const lf of localFavorites) {
              if (!seen.has(lf.anlagenummer.toUpperCase())) {
                merged.push(lf)
              }
            }
            mergedFavorites = merged
            // Sync merged favorites back to local DB
            for (const fav of merged) {
              await localDb.addFavoriteLocation(fav)
            }
          }
        } catch (e) {
          console.warn('Failed to sync favorites from Supabase:', e)
        }
      }
      if (mergedFavorites.length === 0) {
        const localFavorites = await localDb.getFavoriteLocations()
        mergedFavorites = localFavorites
      }
      set({ favoriteLocations: mergedFavorites.slice(0, 5) })

      // Load activity codes
      const codes = await localDb.getActivityCodes()
      if (codes.length > 0) set({ activityCodes: codes })

      // Load saved daily expenses — try Supabase first for a full view, merge with local
      let mergedExpenses: Record<string, any[]> = {}
      if (navigator.onLine) {
        try {
          const { currentWeek } = get()
          const dates = getWeekDates(currentWeek.year, currentWeek.week)
          const remoteExpenses = await withTimeout(
            getExpenses(userId, dates[0], dates[4]),
            8000,
            'getExpenses',
          )
          if (remoteExpenses.length > 0) {
            // Group by date
            for (const re of remoteExpenses) {
              if (!mergedExpenses[re.date]) mergedExpenses[re.date] = []
              mergedExpenses[re.date].push(re)
            }
          }
        } catch (e) {
          console.warn('Failed to sync expenses from Supabase:', e)
        }
      }
      // Merge local expenses (local-only items preserved, remote wins conflicts)
      const localExpenses = await localDb.getDailyExpenses()
      for (const [date, exps] of Object.entries(localExpenses)) {
        if (!mergedExpenses[date]) {
          mergedExpenses[date] = exps
        } else {
          // Merge local-only expense types for this date
          const remoteTypes = new Set(mergedExpenses[date].map((e) => e.expense_type))
          for (const exp of exps) {
            if (!remoteTypes.has(exp.expense_type)) {
              mergedExpenses[date].push(exp)
            }
          }
        }
      }
      if (Object.keys(mergedExpenses).length > 0) {
        set({ dailyExpenses: mergedExpenses })
        // Save merged back to IndexedDB
        localDb
          .saveDailyExpenses(mergedExpenses)
          .catch((e) => console.warn('Failed to save merged expenses to IndexedDB:', e))
      } else if (Object.keys(localExpenses).length > 0) {
        set({ dailyExpenses: localExpenses })
      }

      // Load week entries
      await get().loadWeekEntries()
      await get().calculateWeekSummary()

      // Live cross-device photo sync — Supabase Realtime. When another device
      // adds/updates/deletes an expense photo, reflect it immediately (no manual
      // sync / app restart needed). Inserts/updates debounce into a week reload;
      // deletes are applied directly (a reload would resurrect the local copy,
      // because the merge deliberately preserves local-only rows).
      try {
        if (photoRealtimeUnsubscribe) {
          photoRealtimeUnsubscribe()
          photoRealtimeUnsubscribe = null
        }
        photoRealtimeUnsubscribe = subscribeExpensePhotoChanges(userId, (payload) => {
          if (payload.eventType === 'DELETE') {
            const id = String(payload.old?.id || '')
            const year = Number(payload.old?.year)
            const week = Number(payload.old?.week)
            if (!id || !Number.isFinite(year) || !Number.isFinite(week)) return
            // Remote delete → drop the photo here too (store + IndexedDB), so it
            // can't resurrect on the next merge.
            localDb
              .deleteExpensePhoto(id)
              .catch((e) =>
                console.warn('Failed to remove photo from IndexedDB on realtime delete:', e),
              )
            set((state) => {
              const key = getWeekKey(year, week)
              return {
                expensePhotos: {
                  ...state.expensePhotos,
                  [key]: (state.expensePhotos[key] || []).filter((p) => p.id !== id),
                },
              }
            })
            return
          }

          // INSERT / UPDATE — reload the touched week (new row carries year/week).
          const rec = payload.new
          const year = Number(rec?.year)
          const week = Number(rec?.week)
          if (!Number.isFinite(year) || !Number.isFinite(week)) return

          if (photoRealtimeTimer) clearTimeout(photoRealtimeTimer)
          photoRealtimeTimer = setTimeout(() => {
            photoRealtimeTimer = null
            get()
              .loadExpensePhotos(year, week, true)
              .catch((e) => console.warn('Failed to reload photos on realtime event:', e))
          }, 300)
        })
      } catch (err) {
        console.warn('Failed to set up photo realtime subscription:', err)
      }

      // Live cross-device expense sync — Supabase Realtime. Rows are applied
      // directly (not via week reload): the sync strategy is full-replace
      // (delete-all + insert-fresh), so a reload would fight the merge logic
      // that deliberately preserves local-only rows.
      // NOTE: this device's OWN full-replace sync echoes DELETE+INSERT events
      // back into this handler — that is intentional and idempotent (each event
      // upserts/removes one specific date+type key, and the handler never
      // triggers a sync itself), so no echo-guard is needed.
      try {
        if (expenseRealtimeUnsubscribe) {
          expenseRealtimeUnsubscribe()
          expenseRealtimeUnsubscribe = null
        }
        expenseRealtimeUnsubscribe = subscribeDailyExpenseChanges(userId, (payload) => {
          const rec = payload.eventType === 'DELETE' ? payload.old : payload.new
          const date = String(rec?.date || '')
          const expenseType = String(rec?.expense_type || '')
          if (!date || !expenseType) return

          set((state) => {
            const current = state.dailyExpenses[date] || []
            if (payload.eventType === 'DELETE') {
              return {
                dailyExpenses: {
                  ...state.dailyExpenses,
                  [date]: current.filter((e) => e.expense_type !== expenseType),
                },
              }
            }
            // INSERT / UPDATE — upsert the row for this date + type.
            // Note: a legit `0` (e.g. Material) must survive — Number.isFinite
            // handles both JSON numbers and "0" strings correctly.
            const entry: DailyExpense = {
              date,
              expense_type: expenseType as ExpenseType,
              value: Number.isFinite(Number(rec?.value)) ? Number(rec?.value) : 1,
            }
            const exists = current.some((e) => e.expense_type === expenseType)
            return {
              dailyExpenses: {
                ...state.dailyExpenses,
                [date]: exists
                  ? current.map((e) => (e.expense_type === expenseType ? entry : e))
                  : [...current, entry],
              },
            }
          })

          // Batch IndexedDB persistence — a full-replace sync emits a burst of
          // DELETE+INSERT events; collapse them into one write.
          if (expenseRealtimeTimer) clearTimeout(expenseRealtimeTimer)
          expenseRealtimeTimer = setTimeout(() => {
            expenseRealtimeTimer = null
            localDb
              .saveDailyExpenses(get().dailyExpenses)
              .catch((e) => console.warn('Failed to persist realtime expenses to IndexedDB:', e))
          }, 300)
        })
      } catch (err) {
        console.warn('Failed to set up expense realtime subscription:', err)
      }

      // Live cross-device favorites sync — Supabase Realtime. When another
      // device uses a lift, its user_favorites row is upserted (use_count /
      // last_used change) — reflect it immediately so "Letzte Anlagen" stays
      // in sync. INSERT/UPDATE rows are applied directly (the payload carries
      // every column, so no reload is needed); DELETE is applied directly too
      // (a reload+merge would resurrect the row, since the merge deliberately
      // preserves local-only favorites).
      // NOTE: this device's OWN upsert (addRecentLocation → upsertFavorite)
      // echoes back as an INSERT/UPDATE event — that is intentional and
      // idempotent (re-saving the same row + refreshing the top-5), and the
      // handler never triggers a sync itself, so no echo-guard is needed.
      try {
        if (favoriteRealtimeUnsubscribe) {
          favoriteRealtimeUnsubscribe()
          favoriteRealtimeUnsubscribe = null
        }
        favoriteRealtimeUnsubscribe = subscribeFavoriteChanges(userId, (payload) => {
          const rec = payload.eventType === 'DELETE' ? payload.old : payload.new
          const anlagenummer = String(rec?.anlagenummer || '')
          if (!anlagenummer) return

          if (payload.eventType === 'DELETE') {
            // Remote delete → drop locally too, so it can't resurrect via the
            // local-preserving merge on the next load.
            localDb
              .removeFavoriteLocation(anlagenummer)
              .catch((e) =>
                console.warn('Failed to remove favorite from IndexedDB on realtime delete:', e),
              )
            set((state) => ({
              favoriteLocations: state.favoriteLocations.filter(
                (f) => f.anlagenummer.toUpperCase() !== anlagenummer.toUpperCase(),
              ),
            }))
            return
          }

          // INSERT / UPDATE — upsert the row locally (preserving the higher
          // use_count, so a device that used the lift more often wins) and
          // refresh the top-5 list. When the row already exists locally, write
          // under its existing anlagenummer key — the favorites store is keyed
          // by anlagenummer and the codebase is case-inconsistent, so saving
          // with the remote casing could create a duplicate row.
          localDb
            .getFavoriteLocations()
            .then((localFavs) => {
              const existing = localFavs.find(
                (f) => f.anlagenummer.toUpperCase() === anlagenummer.toUpperCase(),
              )
              const fav = {
                anlagenummer: existing?.anlagenummer || String(rec?.anlagenummer || ''),
                project_id: String(rec?.project_id || ''),
                full_address: String(rec?.full_address || ''),
                latitude: Number(rec?.latitude) || 0,
                longitude: Number(rec?.longitude) || 0,
                zone: Number(rec?.zone) || 0,
                manual_zone: rec?.manual_zone != null ? Number(rec.manual_zone) : undefined,
                use_count: Math.max(Number(rec?.use_count) || 1, existing?.use_count || 1),
                last_used: String(rec?.last_used || new Date().toISOString()),
              }
              return localDb.saveFavoriteLocation(fav).then(() => localDb.getFavoriteLocations())
            })
            .then((refreshed) => {
              set({ favoriteLocations: refreshed.slice(0, 5) })
            })
            .catch((e) => console.warn('Failed to apply realtime favorite update:', e))
        })
      } catch (err) {
        console.warn('Failed to set up favorites realtime subscription:', err)
      }
    } finally {
      // Always clear the loading flag — even if a step above threw (e.g.
      // IndexedDB blocked, a Supabase call failed), the Woche page must not
      // spin forever on the global isLoading flag.
      set({ isLoading: false })
    }
  },
}))
