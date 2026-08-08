import { useEffect, useRef, useState } from 'react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { OtisDurationSelect } from '@/components/ui/OtisDurationSelect'
import { ActivityPicker } from '@/components/daily/ActivityPicker'
import { useAppStore } from '@/stores/appStore'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from '@/lib/useTranslation'
import type { TimeEntry, ActivityCode, Location } from '@/lib/types'
import {
  decimalToTime,
  timeToDecimal,
  otisToStandard,
  formatOtisDuration,
  snapToQuarter,
} from '@/lib/utils'
import { Save, ChevronDown, Search, MapPin, PenLine } from 'lucide-react'

interface EditEntrySheetProps {
  open: boolean
  entry: TimeEntry | null
  onClose: () => void
  onSave: (entry: TimeEntry) => Promise<void>
}

/**
 * Shared "Eintrag bearbeiten" bottom sheet used by the Dashboard (Heutige
 * Einträge) and the Woche pages. Besides time + Tätigkeit it also allows
 * changing the lift (Anlage/Lift Nr.) — the Anlagenummer search works exactly
 * like the one in TimeEntryForm (search by nr, project or address).
 */
export function EditEntrySheet({ open, entry, onClose, onSave }: EditEntrySheetProps) {
  const { t } = useTranslation()
  const { locations, activityCodes, searchLocations } = useAppStore(
    useShallow((s) => ({
      locations: s.locations,
      activityCodes: s.activityCodes,
      searchLocations: s.searchLocations,
    })),
  )

  const [editStart, setEditStart] = useState('')
  const [editDuration, setEditDuration] = useState('')
  const [editActivityCode, setEditActivityCode] = useState<ActivityCode | null>(null)
  const [showEditActivityPicker, setShowEditActivityPicker] = useState(false)
  const [editIsSaving, setEditIsSaving] = useState(false)

  // Lift fields
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedAddress, setSelectedAddress] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [searchResults, setSearchResults] = useState<Location[]>([])
  const [showAddressResults, setShowAddressResults] = useState(false)
  const [addressResults, setAddressResults] = useState<Location[]>([])

  // Guard so the store's locations/activityCodes arrays (which change on every
  // manual-lift save, favorites refresh, geocoding or sync) can never reset the
  // form while the user is mid-edit — only a NEW entry re-initializes.
  const lastInitIdRef = useRef<string | null>(null)

  // (Re)initialize the form whenever a different entry is opened — and reset
  // the guard when the sheet closes so a fresh open always shows the entry's
  // current values (no stale unsaved drafts from the previous open).
  useEffect(() => {
    if (!entry) {
      lastInitIdRef.current = null
      return
    }
    if (lastInitIdRef.current === entry.id) return
    lastInitIdRef.current = entry.id
    setEditStart(decimalToTime(entry.start_time))
    setEditDuration(formatOtisDuration(entry.duration))
    const foundCode = activityCodes.find((c) => c.code === entry.activity_code)
    setEditActivityCode(foundCode || null)
    setSearchQuery(entry.location_anlagenummer || '')
    const loc = locations.find(
      (l) => l.anlagenummer.toUpperCase() === (entry.location_anlagenummer || '').toUpperCase(),
    )
    // Fall back to the location cache when the stored entry is missing the
    // project/address (old rows / quick-select gaps) — editing must show the
    // lift's full details, not empty fields.
    setSelectedProjectId(entry.location_project_id || loc?.project_id || '')
    setSelectedAddress(entry.location_address || loc?.full_address || '')
    setSelectedLocation(loc || null)
    setShowSearchResults(false)
    setShowAddressResults(false)
    setShowEditActivityPicker(false)
  }, [entry, activityCodes, locations])

  const handleSearch = async (query: string) => {
    if (selectedLocation && query.toUpperCase() !== selectedLocation.anlagenummer.toUpperCase()) {
      setSelectedLocation(null)
    }
    setSearchQuery(query)
    setShowAddressResults(false)
    if (query.length < 2) {
      setShowSearchResults(false)
      return
    }
    const results = await searchLocations(query)
    setSearchResults(results)
    setShowSearchResults(true)
  }

  const handleAddressSearch = async (query: string) => {
    setSelectedAddress(query)
    if (selectedLocation && query.toUpperCase() !== selectedLocation.full_address.toUpperCase()) {
      setSelectedLocation(null)
    }
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
    setSelectedLocation(loc)
    setSearchQuery(loc.anlagenummer)
    setSelectedProjectId(loc.project_id)
    setSelectedAddress(loc.full_address)
    setShowSearchResults(false)
    setShowAddressResults(false)
  }

  const handleSave = async () => {
    if (!entry) return
    setEditIsSaving(true)
    try {
      const start = timeToDecimal(editStart)
      const otisVal = parseFloat(editDuration)
      const standardDur = isNaN(otisVal)
        ? entry.duration
        : Math.max(Math.round(otisToStandard(otisVal) * 4) / 4, 0.25)

      // Keep the original cloud location_id only if the lift didn't change;
      // a manually typed nr (no DB selection) must not keep the old FK.
      // An EMPTY field counts as "unchanged" so clearing the input never
      // produces a display/FK mismatch.
      const nr = (selectedLocation?.anlagenummer || searchQuery.trim()).toUpperCase()
      const originalNr = (entry.location_anlagenummer || '').toUpperCase()
      const liftChanged = Boolean(nr) && nr !== originalNr
      const locationId = liftChanged ? (selectedLocation?.id ?? null) : entry.location_id

      const updatedEntry: TimeEntry = {
        ...entry,
        start_time: start,
        duration: Math.max(standardDur, 0.25),
        activity_code: editActivityCode?.code || entry.activity_code,
        activity_code_id: editActivityCode?.id || entry.activity_code_id,
        location_id: locationId,
        location_anlagenummer: liftChanged ? nr : entry.location_anlagenummer,
        location_project_id: selectedProjectId || entry.location_project_id,
        location_address: selectedAddress || entry.location_address,
        location_zone: selectedLocation?.manual_zone ?? selectedLocation?.zone ?? entry.location_zone,
      }
      await onSave(updatedEntry)
      onClose()
    } catch (err) {
      console.warn('Failed to update entry:', err)
    } finally {
      setEditIsSaving(false)
    }
  }

  const isLunch = !!entry?.is_lunch

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title={t('edit.title')}>
        {entry && (
          <div className="space-y-4">
            {/* Lift — Anlagenummer search */}
            {!isLunch && (
              <>
                <div className="relative">
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
                      className="w-full h-14 pl-12 pr-4 rounded-2xl text-base glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none transition-all"
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
                      className="w-full h-14 pl-11 pr-4 rounded-2xl text-base uppercase glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-otis-700 dark:text-otis-200 mb-1.5">
                    {t('entry.address')} <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-stone-200" />
                    <input
                      type="text"
                      value={selectedAddress}
                      onChange={(e) => handleAddressSearch(e.target.value)}
                      placeholder={t('entry.address.placeholder')}
                      className="w-full h-14 pl-11 pr-4 rounded-2xl text-base glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none transition-all"
                    />

                    {/* Address search results dropdown */}
                    {showAddressResults && addressResults.length > 0 && (
                      <div className="absolute z-20 mt-1.5 w-full glass-card dark:glass-card-dark rounded-2xl shadow-xl max-h-48 overflow-y-auto animate-slide-down border border-otis-200/30 dark:border-white/5">
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
                </div>
              </>
            )}

            {/* Tätigkeit — Activity code picker */}
            {!isLunch && (
              <div>
                <label className="block text-sm font-semibold text-otis-700 dark:text-otis-200 mb-1.5">
                  {t('entry.activity')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowEditActivityPicker(true)}
                  className="w-full flex items-center justify-between h-14 px-4 rounded-2xl glass-input dark:glass-input-dark text-otis-900 dark:text-white hover:border-otis-400/40 transition-all"
                >
                  {editActivityCode ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="info">{editActivityCode.code}</Badge>
                      <span className="text-sm text-gray-600 dark:text-stone-200">
                        {editActivityCode.description_de}
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
            )}

            {/* Time — Beginn + Dauer */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="edit-start"
                label={t('entry.beginn')}
                type="time"
                value={editStart}
                onChange={(e) => {
                  const decimal = timeToDecimal(e.target.value)
                  const snapped = snapToQuarter(decimal)
                  setEditStart(decimalToTime(snapped))
                }}
                step="900"
                required
                hint={t('entry.beginn.hint')}
              />
              <OtisDurationSelect
                label={t('entry.dauer')}
                value={editDuration}
                onChange={(value) => setEditDuration(value)}
                required
              />
            </div>

            {/* Action buttons — sticky footer so Save/Cancel are always
                visible at the bottom of the sheet (never hidden behind the
                app's bottom nav or the system gesture bar) */}
            <div
              className="sticky bottom-0 -mx-6 px-6 pt-3 flex gap-3 bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm border-t border-otis-200/20 dark:border-white/5"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <Button
                variant="secondary"
                onClick={onClose}
                className="flex-1"
                size="lg"
              >
                {t('edit.cancel')}
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                className="flex-1"
                size="lg"
                disabled={editIsSaving}
              >
                <Save className="w-4 h-4" />
                {editIsSaving ? t('edit.saving') : t('edit.save')}
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>

      {/* Edit Activity Picker */}
      <ActivityPicker
        open={showEditActivityPicker}
        onClose={() => setShowEditActivityPicker(false)}
        onSelect={(code) => {
          setEditActivityCode(code)
          setShowEditActivityPicker(false)
        }}
        codes={activityCodes}
        selectedCode={editActivityCode?.code}
      />
    </>
  )
}
