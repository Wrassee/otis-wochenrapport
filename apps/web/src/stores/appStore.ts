import { create } from 'zustand'
import type { TimeEntry, Profile, Location, FavoriteLocation, WeekSummary, ActivityCode, SyncStatus, DailyExpense, DailyExpensesMap, ExpenseType } from '@/lib/types'
import * as localDb from '@/db/indexeddb'
import { getToday, getWeekDates, getWeekInfo, haversineDistance, calculateZone, generateId } from '@/lib/utils'
import { REFERENCE_LAT, REFERENCE_LON, ACTIVITY_CODES } from '@/lib/constants'
import type { Language } from '@/lib/translations'
import { DAY_NAMES } from '@/lib/translations'
import { supabase, upsertFavorite, getFavorites, syncExpensesToSupabase, getExpenses } from '@/db/supabase'
import { syncExpenses as queueExpensesSync } from '@/lib/syncExpenses'

/**
 * Collect all expenses from the dailyExpenses map into a flat array
 * and queue a background sync to Supabase (debounced 2 s).
 */
function queueAllExpensesSync(
  dailyExpenses: Record<string, DailyExpense[]>,
  userId: string,
): void {
  const all: Array<{ date: string; expense_type: string; value: number }> = []
  for (const [d, exps] of Object.entries(dailyExpenses)) {
    for (const exp of exps) {
      all.push({ date: d, expense_type: exp.expense_type, value: exp.value })
    }
  }
  queueExpensesSync(all, userId)
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
  addTimeEntry: (entry: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'synced'>) => Promise<void>
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

    // Sync language preference to Supabase profile
    const { user } = get()
    if (user && navigator.onLine) {
      try {
        await supabase
          .from('profiles')
          .update({ language: lang })
          .eq('id', user.id)
      } catch (e) {
        console.warn('Failed to sync language to Supabase:', e)
      }
    }
  },

  setUser: (user) => {
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

  setCurrentDate: (date) => set({ currentDate: date }),

  setCurrentWeek: (year, week) => set({ currentWeek: { year, week } }),

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

    const entries = await localDb.getAllEntriesForWeek(user.id, startDate, endDate)
    set({ timeEntries: entries })
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
      const errors: string[] = []

      if (totalHours < requiredHours) {
        errors.push(`Nur ${totalHours.toFixed(1)}h von ${requiredHours}h erfasst`)
      }

      if (lunchEntries.length === 0 && totalHours > 0) {
        errors.push('Keine Mittagspause erfasst')
      } else if (lunchMinutes < 30) {
        errors.push(`Mittagspause zu kurz (${Math.round(lunchMinutes)} Min.)`)
      } else if (lunchMinutes > 60) {
        errors.push(`Mittagspause zu lang (${Math.round(lunchMinutes)} Min.)`)
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
                value: expenseType === 'privatfahrzeug' ? 10 : (expenseType === 'material' ? 0 : 1),
              },
            ],
          },
        }
      }
    })()
    set(newState)
    // Persist to IndexedDB
    localDb.saveDailyExpenses(newState.dailyExpenses).catch((e) =>
      console.warn('Failed to persist expenses to IndexedDB:', e)
    )

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
            [date]: current.map((e) =>
              e.expense_type === expenseType ? { ...e, value } : e
            ),
          },
        }
      }
      return { dailyExpenses: get().dailyExpenses }
    })()
    set(newState)
    // Persist to IndexedDB
    localDb.saveDailyExpenses(newState.dailyExpenses).catch((e) =>
      console.warn('Failed to persist expenses to IndexedDB:', e)
    )

    // Queue background sync to Supabase
    const { user } = get()
    if (user) {
      queueAllExpensesSync(newState.dailyExpenses, user.id)
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

    // Try to fetch profile from Supabase to get latest language setting
    if (navigator.onLine) {
      try {
        const { data: remoteProfile } = await supabase
          .from('profiles')
          .select('language')
          .eq('id', userId)
          .single()
        if (remoteProfile?.language && remoteProfile.language !== get().language) {
          const lang = remoteProfile.language as Language
          localStorage.setItem('otis_language', lang)
          set({ language: lang })
          // Also update local profile cache
          const currentProfile = get().profile
          if (currentProfile) {
            const updatedProfile = { ...currentProfile, language: lang }
            set({ profile: updatedProfile })
            localDb.saveLocalProfile(updatedProfile)
          }
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
        const remoteFavorites = await getFavorites(userId)
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
        const remoteExpenses = await getExpenses(userId, dates[0], dates[4])
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
      localDb.saveDailyExpenses(mergedExpenses).catch((e) =>
        console.warn('Failed to save merged expenses to IndexedDB:', e)
      )
    } else if (Object.keys(localExpenses).length > 0) {
      set({ dailyExpenses: localExpenses })
    }

    // Load week entries
    await get().loadWeekEntries()
    await get().calculateWeekSummary()

    set({ isLoading: false })
  },
}))
