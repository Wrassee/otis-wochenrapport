import { useState, useEffect, useRef, type FormEvent, useMemo } from 'react'
import type { Location, FavoriteLocation, ActivityCode, TimeEntry } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { OtisDurationSelect } from '@/components/ui/OtisDurationSelect'
import { FavoriteLifts } from './FavoriteLifts'
import { ActivityPicker } from './ActivityPicker'
import * as localDb from '@/db/indexeddb'
import { useAppStore } from '@/stores/appStore'
import { decimalToTime, timeToDecimal, standardToOtis, otisToStandard, formatOtisDuration, snapToQuarter, haversineDistance, calculateZone } from '@/lib/utils'
import { REFERENCE_LAT, REFERENCE_LON } from '@/lib/constants'
import { geocodeAddress } from '@/lib/geocode'
import { useTranslation } from '@/lib/useTranslation'
import { DAY_NAMES } from '@/lib/translations'
import type { Language } from '@/lib/translations'
import { ExpenseEditor } from '@/components/weekly/ExpenseEditor'
import { Plus, UtensilsCrossed, AlertTriangle, MapPin, Search, ChevronDown, PenLine, Clock, Euro } from 'lucide-react'

interface TimeEntryFormProps {
  date: string
  defaultStartTime?: number
  existingEntries: TimeEntry[]
  onSave: (entry: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'synced'> & { is_lunch?: boolean }) => Promise<void>
  onOverlapClick?: (conflictingIds: string[]) => void
}

export function TimeEntryForm({ date, defaultStartTime, existingEntries, onSave, onOverlapClick }: TimeEntryFormProps) {
  const { t } = useTranslation()
  const { locations, favoriteLocations, addRecentLocation, setLocations, setFavoriteLocations, activityCodes, searchLocations, dailyExpenses, language } = useAppStore()

  const [startTime, setStartTime] = useState(decimalToTime(defaultStartTime ?? 7.5))
  const [duration, setDuration] = useState('1.00')
  const [selectedAnlagenummer, setSelectedAnlagenummer] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedAddress, setSelectedAddress] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [selectedActivityCode, setSelectedActivityCode] = useState<ActivityCode | null>(null)
  const [showActivityPicker, setShowActivityPicker] = useState(false)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchResults, setSearchResults] = useState<Location[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLunch, setIsLunch] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)
  const [conflictingEntryIds, setConflictingEntryIds] = useState<string[]>([])
  const [showExpenseEditor, setShowExpenseEditor] = useState(false)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const justSubmittedRef = useRef(false)

  // Check for time overlaps — skip one render cycle after submit to avoid
  // false alarm when startTime is chained but existingEntries hasn't updated yet
  useEffect(() => {
    if (justSubmittedRef.current) {
      justSubmittedRef.current = false
      return
    }
    if (!startTime || !duration) return
    const start = timeToDecimal(startTime)
    const dur = otisDurationToStandard(duration)
    const end = start + dur
    const conflicting = existingEntries.filter((e) => {
      if (e.is_lunch) return false
      const eEnd = e.start_time + e.duration
      return start < eEnd && e.start_time < end
    })

    if (conflicting.length > 0) {
      setOverlapWarning(
        `Zeitüberschneidung! ${conflicting
          .map((e) => `${decimalToTime(e.start_time)}-${decimalToTime(e.start_time + e.duration)}`)
          .join(', ')}`
      )
      setConflictingEntryIds(conflicting.map((e) => e.id))
    } else {
      setOverlapWarning(null)
      setConflictingEntryIds([])
    }
  }, [startTime, duration, existingEntries])

  const handleSearch = async (query: string) => {
    // Only clear search-selected data if user was viewing a selected location
    // and is now typing something different. Don't clear manually entered
    // address/project (selectedLocation is null).
    if (selectedLocation && query.toUpperCase() !== selectedLocation.anlagenummer.toUpperCase()) {
      setSelectedAnlagenummer('')
      setSelectedProjectId('')
      setSelectedAddress('')
      setSelectedLocation(null)
    }
    setSearchQuery(query)
    if (query.length < 2) {
      setShowSearchResults(false)
      return
    }
    const results = await searchLocations(query)
    setSearchResults(results)
    setShowSearchResults(true)
  }

  const handleSelectLocation = (loc: Location) => {
    setSelectedAnlagenummer(loc.anlagenummer)
    setSelectedProjectId(loc.project_id)
    setSelectedAddress(loc.full_address)
    setSelectedLocation(loc)
    setSearchQuery(loc.anlagenummer)
    setShowSearchResults(false)
    addRecentLocation(loc)
  }

  /**
   * Save/update a manually entered lift to the local database (deduplicated).
   * - If the lift already exists in locations → updates project_id, full_address
   * - If it's new → creates a new location entry
   * - Always upserts into favorites (with use_count increment)
   */
  const saveManualLift = async (anlagenummer: string, projectId: string, address: string) => {
    try {
      const key = anlagenummer.toUpperCase()
      const existingLoc = locations.find(
        (l) => l.anlagenummer.toUpperCase() === key
      )

      if (existingLoc) {
        // Update existing location with new project/address
        const updatedLoc = {
          ...existingLoc,
          project_id: projectId,
          full_address: address,
        }
        await localDb.cacheLocations([updatedLoc])
        setLocations(
          locations.map((l) => (l.id === updatedLoc.id ? updatedLoc : l))
        )
      } else {
        // Create new location entry
        const newId = `manual_${key}_${Date.now()}`
        const newLoc = {
          id: newId,
          anlagenummer: key,
          project_id: projectId,
          full_address: address,
          latitude: 0,
          longitude: 0,
          zone: 0,
          created_at: new Date().toISOString(),
        }
        await localDb.cacheLocations([newLoc])
        setLocations([...locations, newLoc])
      }

      // Upsert into favorites (deduplicated by anlagenummer key)
      await localDb.addFavoriteLocation({
        anlagenummer: key,
        project_id: projectId,
        full_address: address,
        latitude: existingLoc?.latitude ?? 0,
        longitude: existingLoc?.longitude ?? 0,
        zone: existingLoc?.manual_zone ?? existingLoc?.zone ?? 0,
        manual_zone: existingLoc?.manual_zone,
      })
      const refreshed = await localDb.getFavoriteLocations()
      setFavoriteLocations(refreshed.slice(0, 5))
    } catch (err) {
      console.warn('Failed to save manual lift:', err)
    }
  }

  /**
   * Auto-save manual lift when all 3 fields (Anlagenummer, Projekt, Adresse) are filled.
   * Debounced 1200ms after the last keystroke to avoid excessive writes.
   */
  useEffect(() => {
    if (isLunch || selectedLocation) return
    const nr = searchQuery.trim().toUpperCase()
    const proj = selectedProjectId.trim()
    const addr = selectedAddress.trim()
    if (!nr || !proj || !addr) return

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      saveManualLift(nr, proj, addr)
    }, 1200)

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [searchQuery, selectedProjectId, selectedAddress, selectedLocation, isLunch, locations])

  /**
   * Background geocode the address and update the location + favorite in IndexedDB.
   * This is fire-and-forget after the entry is already saved.
   */
  const geocodeAndUpdateLocation = async (anlagenummer: string, projectId: string, address: string) => {
    try {
      const result = await geocodeAddress(address)
      if (!result) return

      const distance = haversineDistance(
        REFERENCE_LAT,
        REFERENCE_LON,
        result.lat,
        result.lon
      )
      const zone = calculateZone(distance)

      // Update the location in IndexedDB if it was a manual entry
      const locToUpdate = locations.find(
        (l) => l.anlagenummer.toUpperCase() === anlagenummer.toUpperCase()
      )
      if (locToUpdate) {
        // If manual_zone is set, the user defined the zone manually in Settings
        // so we keep their override and only update lat/lng
        const effectiveZone = locToUpdate.manual_zone ?? zone
        const updatedLoc = {
          ...locToUpdate,
          latitude: result.lat,
          longitude: result.lon,
          zone: effectiveZone,
        }
        await localDb.cacheLocations([updatedLoc])
        setLocations(
          locations.map((l) =>
            l.id === updatedLoc.id ? updatedLoc : l
          )
        )
      }

      // Update the favorite with correct coordinates + zone
      // Keep manual_zone if already set (reuse locToUpdate from above)
      const favEffectiveZone = locToUpdate?.manual_zone ?? zone
      await localDb.addFavoriteLocation({
        anlagenummer,
        project_id: projectId,
        full_address: address,
        latitude: result.lat,
        longitude: result.lon,
        zone: favEffectiveZone,
        manual_zone: locToUpdate?.manual_zone,
      })
      const refreshed = await localDb.getFavoriteLocations()
      setFavoriteLocations(refreshed.slice(0, 5))

      console.log(`📍 ${anlagenummer}: Zone ${zone} (${result.lat.toFixed(4)}, ${result.lon.toFixed(4)})`)
    } catch (err) {
      console.warn('Background geocoding failed:', err)
    }
  }

  const handleSelectFavorite = (fav: FavoriteLocation) => {
    setSelectedAnlagenummer(fav.anlagenummer)
    setSelectedProjectId(fav.project_id)
    setSelectedAddress(fav.full_address)
    setSearchQuery(fav.anlagenummer)
    setShowSearchResults(false)
    // Case-insensitive lookup to match the location in the store
    const loc = locations.find((l) => l.anlagenummer.toUpperCase() === fav.anlagenummer.toUpperCase())
    if (loc) {
      setSelectedLocation(loc)
    } else {
      setSelectedLocation({
        id: fav.anlagenummer,
        anlagenummer: fav.anlagenummer,
        project_id: fav.project_id,
        full_address: fav.full_address,
        latitude: fav.latitude,
        longitude: fav.longitude,
        zone: fav.zone,
        created_at: '',
      })
    }
  }

  const handleLunchToggle = () => {
    if (!isLunch) {
      const lastEntry = existingEntries[existingEntries.length - 1]
      if (lastEntry) {
        const lunchStart = lastEntry.start_time + lastEntry.duration
        setStartTime(decimalToTime(lunchStart))
        setDuration('0.30')
        setIsLunch(true)
        setSelectedAnlagenummer('')
        setSelectedProjectId('')
        setSelectedAddress('')
        setSelectedLocation(null)
        setSelectedActivityCode(null)
      } else {
        setStartTime('12:00')
        setDuration('0.30')
        setIsLunch(true)
      }
    } else {
      setIsLunch(false)
    }
  }

  /**
   * Convert an OTIS-format duration string to standard decimal, snapped to 15-min grid.
   * Input: "4.30" (OTIS = 4h30m)  →  Returns: 4.5 (standard decimal for storage)
   */
  const otisDurationToStandard = (otisValue: string): number => {
    const otis = parseFloat(otisValue)
    if (isNaN(otis) || otis <= 0) return 0.25
    const standard = otisToStandard(otis)
    return Math.max(snapToQuarter(standard), 0.25)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const start = timeToDecimal(startTime)
    // Duration is in OTIS format — convert to standard decimal for storage
    const dur = otisDurationToStandard(duration)

    if (dur <= 0) return

    const entry: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'synced'> & { is_lunch?: boolean } = {
      user_id: '',
      date,
      start_time: start,
      duration: dur,
      location_id: selectedLocation?.id || null,
      location_anlagenummer: selectedLocation?.anlagenummer || searchQuery || undefined,
      location_project_id: selectedProjectId || undefined,
      location_address: selectedAddress || undefined,
      location_zone: selectedLocation ? (selectedLocation.manual_zone ?? selectedLocation.zone) : undefined,
      activity_code_id: selectedActivityCode?.id || null,
      activity_code: selectedActivityCode?.code || null,
      is_lunch: isLunch,
      notes: '',
    }

    await onSave(entry)

    // Save/update manually entered lift to local database (deduplicated)
    if (!selectedLocation && !isLunch && searchQuery) {
      const nr = searchQuery.toUpperCase()
      const proj = selectedProjectId || ''
      const addr = selectedAddress || ''
      await saveManualLift(nr, proj, addr)

      // Background geocoding
      if (addr) {
        geocodeAndUpdateLocation(nr, proj, addr).catch(() => {})
      }
    }

    // Chain the next start time, keep lift fields for next entry
    const newStart = snapToQuarter(start + dur)
    setStartTime(decimalToTime(newStart))
    setDuration('1.00')
    setIsLunch(false)
    setSelectedActivityCode(null)
    setOverlapWarning(null)
    setConflictingEntryIds([])
    justSubmittedRef.current = true
  }

  const todayStr = new Date(date + 'T12:00:00').toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })
  const expenseDayName = useMemo(() => {
    const dayIdx = new Date(date + 'T12:00:00').getDay()
    // getDay(): 0=Sun, 1=Mon ... 6=Sat → convert to 0=Mon index
    const idx = Math.min(dayIdx === 0 ? 6 : dayIdx - 1, 4)
    const names = DAY_NAMES[language as Language] ?? DAY_NAMES.de
    return names[idx]
  }, [date, language])

  return (
    <div className="space-y-4">
      {/* Favorite/Recent lifts */}
      <FavoriteLifts favorites={favoriteLocations} onSelect={handleSelectFavorite} />

      <Card>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-otis-500 to-otis-700 flex items-center justify-center shadow-lg shadow-otis-500/20 flex-shrink-0">
            <Clock className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-otis-800 dark:text-white">{todayStr}</div>
            <p className="text-[10px] text-gray-400">{t('entry.title')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Lunch toggle button */}
          <button
            type="button"
            onClick={handleLunchToggle}
            className={`w-full flex items-center justify-center gap-2 h-14 rounded-2xl border-2 font-semibold transition-all duration-200 ${
              isLunch
                ? 'bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur border-amber-400/60 text-amber-700 dark:text-amber-300'
                : 'glass dark:glass-dark border-otis-200/30 dark:border-white/5 text-gray-500 dark:text-gray-400 hover:border-amber-300/50 hover:text-amber-600 dark:hover:text-amber-400'
            }`}
          >
            <UtensilsCrossed className="w-5 h-5" />
            {isLunch ? t('entry.lunch.active') : t('entry.lunch.btn')}
          </button>

          {/* Anlagenummer search */}
          <div className="relative">
            <label className="block text-sm font-semibold text-otis-700 dark:text-otis-200 mb-1.5">
              {t('entry.anlagenummer')} <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={t('entry.search.placeholder')}
                className="w-full h-14 pl-12 pr-4 rounded-2xl text-base glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none disabled:opacity-50 transition-all"
                disabled={isLunch}
              />
            </div>

            {/* Search results dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute z-20 mt-1.5 w-full glass-card dark:glass-card-dark rounded-2xl shadow-xl max-h-48 overflow-y-auto animate-slide-down border border-otis-200/30 dark:border-white/5">
                {searchResults.map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => handleSelectLocation(loc)}
                    className="w-full flex flex-col items-start p-3.5 hover:bg-otis-50 dark:hover:bg-white/5 border-b border-otis-200/20 dark:border-white/5 last:border-b-0 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-otis-600 dark:text-otis-400">{loc.anlagenummer}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{loc.project_id}</span>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{loc.full_address}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Project number & Address fields (always visible, editable) */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-sm font-semibold text-otis-700 dark:text-otis-200 mb-1.5">
                {t('entry.projekt')} <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <PenLine className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={selectedProjectId}
                  onChange={(e) => {
                    setSelectedProjectId(e.target.value)
                    if (e.target.value !== selectedLocation?.project_id) {
                      setSelectedLocation(null)
                    }
                  }}
                  placeholder={t('entry.projekt.placeholder')}
                  className="w-full h-14 pl-11 pr-4 rounded-2xl text-base glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none disabled:opacity-50 transition-all"
                  disabled={isLunch}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-otis-700 dark:text-otis-200 mb-1.5">
                {t('entry.address')} <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={selectedAddress}
                  onChange={(e) => {
                    setSelectedAddress(e.target.value)
                    if (e.target.value !== selectedLocation?.full_address) {
                      setSelectedLocation(null)
                    }
                  }}
                  placeholder={t('entry.address.placeholder')}
                  className="w-full h-14 pl-11 pr-4 rounded-2xl text-base glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none disabled:opacity-50 transition-all"
                  disabled={isLunch}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1 pl-1">
                {t('entry.address.hint')}
              </p>
            </div>
          </div>

          {/* Selected location info badge */}
          {selectedLocation && (
            <div className="flex items-center gap-2.5 p-3 bg-emerald-50/80 dark:bg-emerald-900/20 backdrop-blur rounded-2xl border border-emerald-200/40 dark:border-emerald-700/30">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  {t('entry.from.database')} {selectedLocation.anlagenummer}
                </span>
              </div>
              <Badge variant="zone" size="sm">
                Z{selectedLocation.manual_zone ?? selectedLocation.zone}
                {selectedLocation.manual_zone !== undefined && (
                  <span className="ml-0.5 text-[9px]">✦</span>
                )}
              </Badge>
            </div>
          )}

          {/* Time inputs — 15-minute increments per OTIS standard */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="start-time"
              label={t('entry.beginn')}
              type="time"
              value={startTime}
              onChange={(e) => {
                const decimal = timeToDecimal(e.target.value)
                const snapped = snapToQuarter(decimal)
                setStartTime(decimalToTime(snapped))
              }}
              required
              step="900"
              hint={t('entry.beginn.hint')}
            />
            <OtisDurationSelect
              label={t('entry.dauer')}
              value={duration}
              onChange={(value) => setDuration(value)}
              required
            />
          </div>

          {/* Activity code button */}
          {!isLunch && (
            <div>
              <label className="block text-sm font-semibold text-otis-700 dark:text-otis-200 mb-1.5">
                {t('entry.activity')}
              </label>
              <button
                type="button"
                onClick={() => setShowActivityPicker(true)}
                className="w-full flex items-center justify-between h-14 px-4 rounded-2xl glass-input dark:glass-input-dark text-otis-900 dark:text-white hover:border-otis-400/40 transition-all"
              >
                {selectedActivityCode ? (
                  <div className="flex items-center gap-2">
                    <Badge variant="info">{selectedActivityCode.code}</Badge>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedActivityCode.description_de}
                    </span>
                  </div>
                ) : (
                  <span className="text-gray-400">{t('entry.activity.select')}</span>
                )}
                <ChevronDown className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          )}

          {/* Overlap warning — clickable, scrolls to conflicting entries */}
          {overlapWarning && (
            <button
              type="button"
              onClick={() => onOverlapClick?.(conflictingEntryIds)}
              className="w-full flex items-start gap-2.5 p-3.5 bg-red-50/80 dark:bg-red-900/20 backdrop-blur border-2 border-red-200/60 dark:border-red-700/40 rounded-2xl hover:bg-red-100/80 dark:hover:bg-red-900/30 hover:border-red-300/80 dark:hover:border-red-600/60 transition-all active:scale-[0.98] text-left cursor-pointer"
            >
              <div className="w-6 h-6 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-red-600 dark:text-red-300 font-medium">{overlapWarning}</p>
                <p className="text-[10px] text-red-400/70 dark:text-red-400/50 mt-0.5">
                  Zum Eintrag springen &rarr;
                </p>
              </div>
            </button>
          )}

          {/* Quick Spesen link — opens daily ExpenseEditor popup */}
          {!isLunch && (
            <button
              type="button"
              onClick={() => setShowExpenseEditor(true)}
              className="flex items-center justify-center gap-2 h-12 rounded-2xl border-2 border-dashed border-amber-300/40 dark:border-amber-600/30 text-amber-600 dark:text-amber-400 text-sm font-semibold hover:bg-amber-50/80 dark:hover:bg-amber-900/20 hover:border-amber-400/60 transition-all active:scale-95 w-full"
            >
              <Euro className="w-4 h-4" />
              {t('entry.spesen')}
              <span className="text-[10px] opacity-60">&rarr; {t('day.spesen')}</span>
            </button>
          )}

          <Button type="submit" fullWidth size="lg" variant="primary">
            <Plus className="w-5 h-5" />
            {isLunch ? t('entry.lunch.save') : t('entry.save')}
          </Button>
        </form>
      </Card>

      {/* Activity Picker Bottom Sheet */}
      <ActivityPicker
        open={showActivityPicker}
        onClose={() => setShowActivityPicker(false)}
        onSelect={(code) => {
          setSelectedActivityCode(code)
          setShowActivityPicker(false)
        }}
        codes={activityCodes}
        selectedCode={selectedActivityCode?.code}
      />

      {/* Daily Expense Editor Popup */}
      <ExpenseEditor
        open={showExpenseEditor}
        onClose={() => setShowExpenseEditor(false)}
        date={date}
        dayName={expenseDayName}
        dailyExpenses={dailyExpenses}
      />
    </div>
  )
}
