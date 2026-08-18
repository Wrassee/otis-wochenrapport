import { useState, useEffect, useRef, type FormEvent } from 'react'
import type { Location, FavoriteLocation, ActivityCode, TimeEntry } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { OtisDurationSelect } from '@/components/ui/OtisDurationSelect'
import { FavoriteLifts } from './FavoriteLifts'
import { ActivityPicker } from './ActivityPicker'
import * as localDb from '@/db/indexeddb'
import { upsertFavorite } from '@/db/supabase'
import { useAppStore } from '@/stores/appStore'
import { useShallow } from 'zustand/react/shallow'
import {
  decimalToTime,
  timeToDecimal,
  otisToStandard,
  snapToQuarter,
  findOverlappingRanges,
  findLatestLiftEntry,
} from '@/lib/utils'
import { ensureLiftRow } from '@/lib/locationZones'
import { resolveLiftZone, zoneForCoordinates } from '@/lib/zoneReference'
import { useTranslation } from '@/lib/useTranslation'
import {
  Plus,
  UtensilsCrossed,
  AlertTriangle,
  MapPin,
  Search,
  ChevronDown,
  PenLine,
  Clock,
  X,
} from 'lucide-react'

interface TimeEntryFormProps {
  date: string
  defaultStartTime?: number
  existingEntries: TimeEntry[]
  onSave: (
    entry: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'synced'> & { is_lunch?: boolean },
  ) => Promise<void>
  onOverlapClick?: (conflictingIds: string[]) => void
}

export function TimeEntryForm({
  date,
  defaultStartTime,
  existingEntries,
  onSave,
  onOverlapClick,
}: TimeEntryFormProps) {
  const { t, language } = useTranslation()
  const {
    locations,
    favoriteLocations,
    addRecentLocation,
    setLocations,
    setFavoriteLocations,
    activityCodes,
    searchLocations,
    timeEntries,
  } = useAppStore(
    useShallow((s) => ({
      locations: s.locations,
      favoriteLocations: s.favoriteLocations,
      addRecentLocation: s.addRecentLocation,
      setLocations: s.setLocations,
      setFavoriteLocations: s.setFavoriteLocations,
      activityCodes: s.activityCodes,
      searchLocations: s.searchLocations,
      timeEntries: s.timeEntries,
    })),
  )

  const [startTime, setStartTime] = useState(decimalToTime(defaultStartTime ?? 7.5))
  const [duration, setDuration] = useState('1.00')
  const [_selectedAnlagenummer, setSelectedAnlagenummer] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedAddress, setSelectedAddress] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [selectedActivityCode, setSelectedActivityCode] = useState<ActivityCode | null>(null)
  const [showActivityPicker, setShowActivityPicker] = useState(false)
  /** Free-text remark (own note) — written into column O of the Excel. */
  const [remark, setRemark] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchResults, setSearchResults] = useState<Location[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddressResults, setShowAddressResults] = useState(false)
  const [addressResults, setAddressResults] = useState<Location[]>([])
  const [isLunch, setIsLunch] = useState(false)
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null)
  const [conflictingEntryIds, setConflictingEntryIds] = useState<string[]>([])
  /** True when the last background geocode of the address failed — surfaced as
   *  an inline warning under the address field (zone stays unknown). */
  const [geocodeFailed, setGeocodeFailed] = useState(false)
  /** Values of the form at submit time — keeps overlap checks skipped until
   *  the chained (next) start time lands, surviving multiple intermediate
   *  renders caused by addEntry + loadWeek. */
  const justSubmittedRef = useRef<string | null>(null)
  /** True once the user manually picked a start time — the auto-sync of the
   *  chained default must not override a deliberate manual choice. */
  const startTimeTouchedRef = useRef(false)

  // Containers for the two autocomplete dropdowns — used to close them when
  // the user taps/clicks outside, so a suggestion list can never trap the form.
  const liftSearchRef = useRef<HTMLDivElement>(null)
  const addressSearchRef = useRef<HTMLDivElement>(null)

  // Dismiss both suggestion dropdowns on click-outside or Esc.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null
      if (target && liftSearchRef.current && !liftSearchRef.current.contains(target)) {
        setShowSearchResults(false)
      }
      if (target && addressSearchRef.current && !addressSearchRef.current.contains(target)) {
        setShowAddressResults(false)
      }
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSearchResults(false)
        setShowAddressResults(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  // Keep the start time in sync with the chained default once the day's entries
  // load asynchronously — the form mounts BEFORE loadWeek() resolves, so it
  // would otherwise keep the stale fallback default (07:30) and falsely report
  // an overlap against the just-loaded entries (e.g. an existing 07:30-09:00).
  // A manual user edit wins over the auto-sync; switching days resets the guard.
  useEffect(() => {
    startTimeTouchedRef.current = false
  }, [date])

  useEffect(() => {
    if (startTimeTouchedRef.current) return
    setStartTime(decimalToTime(defaultStartTime ?? 7.5))
  }, [defaultStartTime])

  // Check for time overlaps — skip the render(s) triggered by the submit
  // itself: once the new entry lands in existingEntries, the form still holds
  // the OLD startTime for a moment, which would falsely look like a self-overlap.
  useEffect(() => {
    if (justSubmittedRef.current) {
      // Still showing the submitted (stale) values → an intermediate render of
      // the just-created entry is in flight; keep skipping until values change.
      if (justSubmittedRef.current === `${startTime}|${duration}`) return
      // Chained values have landed → clear the guard and run a real check.
      justSubmittedRef.current = null
    }
    if (!startTime || !duration) return
    const start = timeToDecimal(startTime)
    const dur = otisDurationToStandard(duration)
    if (dur <= 0) return
    // Lunch breaks are excluded: a break may legitimately fall inside the
    // working time. The helper uses half-open intervals, so an entry starting
    // exactly where another ends (e.g. 07:30-11:30 then 11:30-15:00) is valid.
    const conflicting = findOverlappingRanges(
      { start, duration: dur },
      existingEntries.filter((e) => !e.is_lunch),
      (e) => ({ start: e.start_time, duration: e.duration }),
    )

    if (conflicting.length > 0) {
      setOverlapWarning(
        `${t('entry.overlap')} ${conflicting
          .map((e) => `${decimalToTime(e.start_time)}-${decimalToTime(e.start_time + e.duration)}`)
          .join(', ')}`,
      )
      setConflictingEntryIds(conflicting.map((e) => e.id))
    } else {
      setOverlapWarning(null)
      setConflictingEntryIds([])
    }
  }, [startTime, duration, existingEntries, t])

  const handleSearch = async (query: string) => {
    const q = query.trim().toUpperCase()
    const selNr = selectedLocation?.anlagenummer.toUpperCase()
    // Editing the Anlagenummer invalidates the currently carried
    // project/address — whether it came from a search-selected lift OR from
    // the previous entry's fields (the form keeps them for chaining). Without
    // this, a partial number (e.g. "1" while typing "1CE") would auto-save a
    // bogus lift row carrying the OLD lift's Projekt-Nr/Adresse (e.g. AEV21's
    // data) — the mixed-up identifiers seen in "Meine Lifte".
    if (selectedLocation && q !== selNr) {
      setSelectedAnlagenummer('')
      setSelectedProjectId('')
      setSelectedAddress('')
      setSelectedLocation(null)
    } else if (!selectedLocation) {
      setSelectedProjectId('')
      setSelectedAddress('')
    }
    setSearchQuery(query)
    // Close the address dropdown so both results lists can't overlap
    setShowAddressResults(false)
    if (query.length < 2) {
      setShowSearchResults(false)
      return
    }
    const results = await searchLocations(query)
    setSearchResults(results)
    setShowSearchResults(true)
  }

  /** Search by address — same location pool, matched on address/project/nr. */
  const handleAddressSearch = async (query: string) => {
    setSelectedAddress(query)
    setGeocodeFailed(false)
    if (selectedLocation && query.toUpperCase() !== selectedLocation.full_address.toUpperCase()) {
      setSelectedLocation(null)
    }
    // Close the lift-nr dropdown so both results lists can't overlap
    setShowSearchResults(false)
    if (query.length < 2) {
      setShowAddressResults(false)
      return
    }
    const results = await searchLocations(query)
    setAddressResults(results)
    setShowAddressResults(true)
  }

  const handleSelectLocation = (loc: Location) => {
    setSelectedAnlagenummer(loc.anlagenummer)
    setSelectedProjectId(loc.project_id)
    setSelectedAddress(loc.full_address)
    setSelectedLocation(loc)
    setGeocodeFailed(false)
    setSearchQuery(loc.anlagenummer)
    setShowSearchResults(false)
    setShowAddressResults(false)
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
      // Shared helper: dedup against IndexedDB, update-or-create the location
      // row and upsert the favorite. (updateLocationDetails queues a
      // location_upsert sync UNCONDITIONALLY — cacheLocations only syncs
      // 'manual_' ids, so edits to Supabase-synced lifts would otherwise never
      // reach the cloud.)
      const { location } = await ensureLiftRow(anlagenummer, projectId, address)
      // Mirror the persisted row into the store (IndexedDB is the source of
      // truth; the store slice only drives the UI).
      if (location) {
        const idx = locations.findIndex((l) => l.id === location.id)
        if (idx >= 0) {
          setLocations(locations.map((l) => (l.id === location.id ? location : l)))
        } else {
          setLocations([...locations, location])
        }
      }

      const refreshed = await localDb.getFavoriteLocations()
      setFavoriteLocations(refreshed.slice(0, 5))

      // Also push the favorite to the cloud so the manually entered lift
      // appears in "Letzte Anlagen" on other devices too (search-selected
      // lifts do this via addRecentLocation → upsertFavorite).
      const { user } = useAppStore.getState()
      if (user && navigator.onLine) {
        try {
          const fav = refreshed.find((f) => f.anlagenummer.toUpperCase() === key)
          await upsertFavorite({
            user_id: user.id,
            anlagenummer: key,
            project_id: projectId,
            full_address: address,
            latitude: fav?.latitude ?? location?.latitude ?? 0,
            longitude: fav?.longitude ?? location?.longitude ?? 0,
            zone: fav?.manual_zone ?? fav?.zone ?? location?.manual_zone ?? location?.zone ?? 0,
            manual_zone: fav?.manual_zone ?? location?.manual_zone,
            use_count: fav?.use_count ?? 1,
          })
        } catch (e) {
          console.warn('Failed to sync manual lift favorite to Supabase:', e)
        }
      }
    } catch (err) {
      console.warn('Failed to save manual lift:', err)
    }
  }

  /**
   * Background geocode the address and update the location + favorite in IndexedDB.
   * This is fire-and-forget after the entry is already saved.
   *
   * NOTE: there is deliberately NO auto-save of the manual lift here. A new
   * lift is only persisted when the user submits the entry ("Eintrag erfassen")
   * — handleSubmit → saveManualLift — never while fields are still being
   * typed. The old 1200ms debounced auto-save saved half-typed numbers with
   * stale Projekt/Adresse from the previous entry ("1" / "sun" artifacts in
   * Meine Lifte) and even looped forever via its `locations` dependency.
   */
  const geocodeAndUpdateLocation = async (
    anlagenummer: string,
    projectId: string,
    address: string,
  ) => {
    try {
      // Shared helper with the geocode option: geocodes the address and
      // persists the coordinates to the location row + favorite (a manual_zone
      // override is kept).
      const { geocoded } = await ensureLiftRow(anlagenummer, projectId, address, {
        geocode: true,
      })
      setGeocodeFailed(!geocoded)
      if (geocoded) {
        // Mirror the geocoded coords into the store's location slice.
        const store = useAppStore.getState()
        const loc = store.locations.find(
          (l) => l.anlagenummer.toUpperCase() === anlagenummer.toUpperCase(),
        )
        if (loc) {
          store.setLocations(
            store.locations.map((l) =>
              l.id === loc.id
                ? {
                    ...l,
                    latitude: geocoded.latitude,
                    longitude: geocoded.longitude,
                    zone: geocoded.zone,
                  }
                : l,
            ),
          )
        }
        const refreshed = await localDb.getFavoriteLocations()
        store.setFavoriteLocations(refreshed.slice(0, 5))
      }
    } catch (err) {
      console.warn('Background geocoding failed:', err)
      setGeocodeFailed(true)
    }
  }

  // Self-heal: when a lift is picked from the database with an address but no
  // geocoded coordinates (e.g. an older row whose background geocode failed),
  // geocode it now so the zone badge reflects the real distance instead of a
  // stale/unknown stored zone. Existing-lift selection is the one path that
  // never re-geocoded, which left such lifts stuck on the old Z1 default.
  useEffect(() => {
    const loc = selectedLocation
    if (!loc) return
    const addr = loc.full_address?.trim()
    if (!addr) return
    if (Number(loc.latitude) && Number(loc.longitude)) return

    let cancelled = false
    const heal = async () => {
      const { geocoded } = await ensureLiftRow(loc.anlagenummer, loc.project_id, addr, {
        geocode: true,
      })
      if (!cancelled) {
        if (geocoded) {
          setSelectedLocation({
            ...loc,
            latitude: geocoded.latitude,
            longitude: geocoded.longitude,
            zone: geocoded.zone,
          })
          setGeocodeFailed(false)
        } else {
          setGeocodeFailed(true)
        }
      }
    }
    heal().catch(() => {})
    return () => {
      cancelled = true
    }
    // Only re-run when a different lift gets selected — never on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation?.id])

  const handleSelectFavorite = (fav: FavoriteLocation) => {
    // Resolve project/address from the richest available source. Favorites can
    // hold stale/partial rows (e.g. an empty remote upsert overwrote the local
    // project/address, or the lift was entered manually without them), so the
    // location cache and the most recent time entry for this lift are used as
    // fallbacks — a lift picked from "Letzte Anlagen" must always carry its
    // full Anlage/Projekt/Adresse into the second block of the day too.
    const loc = locations.find(
      (l) => l.anlagenummer.toUpperCase() === fav.anlagenummer.toUpperCase(),
    )
    // Most recent time entry that used this lift (fallback source).
    const latest = findLatestLiftEntry(timeEntries, fav.anlagenummer)
    const projectId = fav.project_id || loc?.project_id || latest?.location_project_id || ''
    const address = fav.full_address || loc?.full_address || latest?.location_address || ''

    setSelectedAnlagenummer(fav.anlagenummer)
    setSelectedProjectId(projectId)
    setSelectedAddress(address)
    setGeocodeFailed(false)
    setSearchQuery(fav.anlagenummer)
    setShowSearchResults(false)
    if (loc) {
      setSelectedLocation(loc)
    } else {
      setSelectedLocation({
        id: fav.anlagenummer,
        anlagenummer: fav.anlagenummer,
        project_id: projectId,
        full_address: address,
        latitude: fav.latitude,
        longitude: fav.longitude,
        zone: fav.zone,
        manual_zone: fav.manual_zone,
        created_at: '',
      })
    }
  }

  const handleLunchToggle = () => {
    // The lunch start is deliberately chosen (chained or 12:00) — the
    // default-start sync must not override it with the next work default.
    startTimeTouchedRef.current = true
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
    // A lunch break has no remark — clear it so a stale note never rides along.
    setRemark('')
    // Reset any open search dropdowns
    setShowSearchResults(false)
    setShowAddressResults(false)
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

    // Flag the in-flight submit BEFORE any await: when the new entry lands in
    // existingEntries, the overlap effect must ignore the stale form values
    // until the chained next start time has been applied.
    justSubmittedRef.current = `${startTime}|${duration}`

    const start = timeToDecimal(startTime)
    // Duration is in OTIS format — convert to standard decimal for storage
    const dur = otisDurationToStandard(duration)

    if (dur <= 0) return

    // Resolve zone: manual override wins, otherwise recompute from coordinates,
    // otherwise the stored zone — never write a stale stored zone into the entry.
    let resolvedZone: number | undefined
    if (selectedLocation) {
      resolvedZone = resolveLiftZone(selectedLocation) || undefined
    } else if (searchQuery) {
      const key = searchQuery.toUpperCase()
      const src =
        locations.find((l) => l.anlagenummer.toUpperCase() === key) ??
        favoriteLocations.find((f) => f.anlagenummer.toUpperCase() === key)
      resolvedZone = resolveLiftZone(src) || undefined
    }

    const entry: Omit<TimeEntry, 'id' | 'created_at' | 'updated_at' | 'synced'> & {
      is_lunch?: boolean
    } = {
      user_id: '',
      date,
      start_time: start,
      duration: dur,
      location_id: selectedLocation?.id || null,
      location_anlagenummer: selectedLocation?.anlagenummer || searchQuery || undefined,
      location_project_id: selectedProjectId || undefined,
      location_address: selectedAddress || undefined,
      location_zone: resolvedZone,
      activity_code_id: selectedActivityCode?.id || null,
      activity_code: selectedActivityCode?.code || null,
      is_lunch: isLunch,
      notes: remark.trim(),
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
    setRemark('')
    setOverlapWarning(null)
    setConflictingEntryIds([])
  }

  const todayStr = new Date(date + 'T12:00:00').toLocaleDateString(language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

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
            <p className="text-[10px] text-gray-500 dark:text-stone-200">{t('entry.title')}</p>
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
                : 'glass dark:glass-dark border-otis-200/30 dark:border-white/5 text-gray-600 dark:text-stone-200 hover:border-amber-300/50 hover:text-amber-600 dark:hover:text-amber-400'
            }`}
          >
            <UtensilsCrossed className="w-5 h-5" />
            {isLunch ? t('entry.lunch.active') : t('entry.lunch.btn')}
          </button>

          {/* Lift fields (Anlagen-Nr / Projekt-Nr / Adresse) — hidden for
              Mittagspause, they are irrelevant and distract the technician */}
          {!isLunch && (
            <>
              {/* Anlagenummer search */}
              <div className="relative" ref={liftSearchRef}>
                <label className="block text-sm font-semibold text-otis-700 dark:text-otis-200 mb-1.5">
                  {t('entry.anlagenummer')} <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 dark:text-stone-200" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder={t('entry.search.placeholder')}
                    className="w-full h-14 pl-12 pr-4 rounded-2xl text-base glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none disabled:opacity-50 transition-all"
                  />
                </div>

                {/* Search results dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div className="absolute z-20 mt-1.5 w-full glass-card dark:glass-card-dark rounded-2xl shadow-xl max-h-48 overflow-y-auto animate-slide-down border border-otis-200/30 dark:border-white/5">
                    <div className="flex justify-end p-1.5 sticky top-0 bg-white/70 dark:bg-otis-900/70 backdrop-blur">
                      <button
                        type="button"
                        onClick={() => setShowSearchResults(false)}
                        className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 dark:text-stone-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                        aria-label="Close"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {searchResults.map((loc) => (
                      <button
                        key={loc.id}
                        type="button"
                        onClick={() => handleSelectLocation(loc)}
                        className="w-full flex flex-col items-start p-3.5 hover:bg-otis-50 dark:hover:bg-white/5 border-b border-otis-200/20 dark:border-white/5 last:border-b-0 text-left transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-otis-600 dark:text-otis-400">
                            {loc.anlagenummer}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-stone-200 font-medium">
                            {loc.project_id}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-stone-300">
                          {loc.full_address}
                        </span>
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
                    <PenLine className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-stone-200" />
                    <input
                      type="text"
                      value={selectedProjectId}
                      onChange={(e) => {
                        setSelectedProjectId(e.target.value.toUpperCase())
                        if (
                          e.target.value.toUpperCase() !==
                          (selectedLocation?.project_id || '').toUpperCase()
                        ) {
                          setSelectedLocation(null)
                        }
                      }}
                      autoCapitalize="characters"
                      placeholder={t('entry.projekt.placeholder')}
                      className="w-full h-14 pl-11 pr-4 rounded-2xl text-base uppercase glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none disabled:opacity-50 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-otis-700 dark:text-otis-200 mb-1.5">
                    {t('entry.address')} <span className="text-red-400">*</span>
                  </label>
                  <div className="relative" ref={addressSearchRef}>
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-stone-200" />
                    <input
                      type="text"
                      value={selectedAddress}
                      onChange={(e) => handleAddressSearch(e.target.value)}
                      placeholder={t('entry.address.placeholder')}
                      className="w-full h-14 pl-11 pr-4 rounded-2xl text-base glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none disabled:opacity-50 transition-all"
                    />

                    {/* Address search results dropdown */}
                    {showAddressResults && addressResults.length > 0 && (
                      <div className="absolute z-20 mt-1.5 w-full glass-card dark:glass-card-dark rounded-2xl shadow-xl max-h-48 overflow-y-auto animate-slide-down border border-otis-200/30 dark:border-white/5">
                        <div className="flex justify-end p-1.5 sticky top-0 bg-white/70 dark:bg-otis-900/70 backdrop-blur">
                          <button
                            type="button"
                            onClick={() => setShowAddressResults(false)}
                            className="w-6 h-6 rounded-full flex items-center justify-center text-gray-400 dark:text-stone-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                            aria-label="Close"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {addressResults.map((loc) => (
                          <button
                            key={loc.id}
                            type="button"
                            onClick={() => handleSelectLocation(loc)}
                            className="w-full flex flex-col items-start p-3.5 hover:bg-otis-50 dark:hover:bg-white/5 border-b border-otis-200/20 dark:border-white/5 last:border-b-0 text-left transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-otis-600 dark:text-otis-400">
                                {loc.anlagenummer}
                              </span>
                              <span className="text-xs text-gray-600 dark:text-stone-200 font-medium">
                                {loc.project_id}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-stone-300">
                              {loc.full_address}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-stone-200 mt-1 pl-1">
                    {t('entry.address.hint')}
                  </p>
                  {geocodeFailed && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-300 mt-1 pl-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      {t('entry.address.geocode.failed')}
                    </p>
                  )}
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
                    {(() => {
                      const manual = selectedLocation.manual_zone
                      if (manual !== undefined && manual > 0) {
                        return (
                          <>
                            Z{manual}
                            <span className="ml-0.5 text-[9px]">✦</span>
                          </>
                        )
                      }
                      // A zone is only trustworthy with coordinates (or a
                      // manual override) — a stale stored zone, or an unknown
                      // zone left over from a failed geocode (e.g. a typo in
                      // the address), is NEVER shown as a confident "Z1".
                      const hasCoords =
                        Number(selectedLocation.latitude) && Number(selectedLocation.longitude)
                      const zone = hasCoords
                        ? zoneForCoordinates(
                            Number(selectedLocation.latitude),
                            Number(selectedLocation.longitude),
                          )
                        : 0
                      return zone > 0 ? `Z${zone}` : t('lifts.zone.auto.short')
                    })()}
                  </Badge>
                </div>
              )}
            </>
          )}

          {/* Time inputs — 15-minute increments per OTIS standard */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="start-time"
              label={t('entry.beginn')}
              type="time"
              value={startTime}
              onChange={(e) => {
                startTimeTouchedRef.current = true
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

          {/* Activity code button + free-text remark */}
          {!isLunch && (
            <div className="space-y-3">
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
                      <span className="text-sm text-gray-600 dark:text-stone-200">
                        {selectedActivityCode.description_de}
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-500 dark:text-stone-200">
                      {t('entry.activity.select')}
                    </span>
                  )}
                  <ChevronDown className="w-5 h-5 text-gray-500 dark:text-stone-200" />
                </button>
              </div>
              <div>
                <label className="block text-sm font-semibold text-otis-700 dark:text-otis-200 mb-1.5">
                  {t('entry.remark')}
                </label>
                <input
                  type="text"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder={t('entry.remark.placeholder')}
                  className="w-full h-12 px-4 rounded-2xl text-sm glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none transition-all"
                />
              </div>
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
                <p className="text-sm text-red-600 dark:text-red-300 font-medium">
                  {overlapWarning}
                </p>
                <p className="text-[10px] text-red-400/70 dark:text-red-400/50 mt-0.5">
                  {t('entry.overlap.jump')}
                </p>
              </div>
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
    </div>
  )
}
