import { useState, useEffect, useCallback } from 'react'
import { ProfileSetup } from '@/components/auth/ProfileSetup'
import { Card, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/appStore'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from '@/lib/useTranslation'
import { upsertProfile } from '@/db/supabase'
import * as localDb from '@/db/indexeddb'
import {
  LogOut,
  Wifi,
  WifiOff,
  Smartphone,
  RefreshCw,
  Clock,
  Shield,
  Info,
  Settings,
  Bell,
  BellOff,
  Calendar,
  MapPin,
  Pencil,
  Check,
  X,
  Search,
  Trash2,
  AlertTriangle,
  Plus,
  Languages,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { forceSync } from '@/db/sync'
import { useNavigate } from 'react-router-dom'
import { signOut } from '@/db/supabase'
import { cn } from '@/lib/cn'
import {
  scheduleMondayReminder,
  cancelMondayReminder,
  isReminderScheduled,
  setReminderPreference,
} from '@/db/notifications'
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher'

export function SettingsPage() {
  const { t } = useTranslation()
  const { profile, setProfile, user, setUser, syncStatus, setSyncStatus, language } = useAppStore(
    useShallow((s) => ({
      profile: s.profile,
      setProfile: s.setProfile,
      user: s.user,
      setUser: s.setUser,
      syncStatus: s.syncStatus,
      setSyncStatus: s.setSyncStatus,
      language: s.language,
    })),
  )
  const navigate = useNavigate()
  const [notificationEnabled, setNotificationEnabled] = useState(false)
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState<string | null>(null)

  useEffect(() => {
    isReminderScheduled().then(setNotificationEnabled)
  }, [])

  const handleSaveProfile = async (
    fullName: string,
    personnelNumber: string,
    supervisorEmail: string,
  ) => {
    if (!user) return
    const updatedProfile = {
      id: user.id,
      email: user.email,
      full_name: fullName,
      personnel_number: personnelNumber,
      supervisor_email: supervisorEmail,
      language,
      created_at: profile?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    // Offline-first: persist to the store + IndexedDB immediately so the
    // fields keep their values even if the Supabase sync fails (e.g. offline).
    setProfile(updatedProfile)
    try {
      await upsertProfile(updatedProfile)
    } catch (err) {
      console.warn('Failed to sync profile to Supabase:', err)
    }
  }

  const handleSync = async () => {
    setSyncStatus({ syncing: true })
    await forceSync()
  }

  const handleLogout = async () => {
    await signOut()
    setUser(null)
    setProfile(null)
    navigate('/login')
  }

  const toggleNotification = async () => {
    setNotificationLoading(true)
    setNotificationError(null)

    try {
      if (notificationEnabled) {
        await cancelMondayReminder()
        await setReminderPreference(false)
        setNotificationEnabled(false)
      } else {
        const result = await scheduleMondayReminder()
        if (result.scheduled) {
          await setReminderPreference(true)
          setNotificationEnabled(true)
        } else {
          setNotificationError(result.error || t('settings.reminder.error'))
        }
      }
    } catch (err: any) {
      setNotificationError(err.message || t('common.error'))
    } finally {
      setNotificationLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-otis-500 to-otis-700 flex items-center justify-center shadow-lg shadow-otis-500/20">
          <Settings className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-otis-800 dark:text-white">{t('nav.settings')}</h2>
          <p className="text-xs text-gray-400 dark:text-stone-300">{t('nav.subtitle.settings')}</p>
        </div>
      </div>

      {/* Profile */}
      <ProfileSetup
        initialName={profile?.full_name || ''}
        initialPersonnel={profile?.personnel_number || ''}
        initialSupervisorEmail={profile?.supervisor_email || ''}
        onSave={handleSaveProfile}
      />

      {/* Monday Reminder Notification */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'w-9 h-9 rounded-xl flex items-center justify-center shadow-lg',
                notificationEnabled
                  ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/20'
                  : 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-gray-500/20',
              )}
            >
              {notificationEnabled ? (
                <Bell className="w-4 h-4 text-white" />
              ) : (
                <BellOff className="w-4 h-4 text-white" />
              )}
            </div>
            <div>
              <CardTitle>{t('settings.reminder')}</CardTitle>
              <p className="text-[10px] text-gray-400 dark:text-stone-300">
                {t('settings.reminder.subtitle')}
              </p>
            </div>
          </div>
          <Badge variant={notificationEnabled ? 'success' : 'default'} size="sm">
            {notificationEnabled ? t('settings.reminder.active') : t('settings.reminder.inactive')}
          </Badge>
        </div>

        <div className="p-3.5 bg-otis-50/50 dark:bg-white/3 rounded-2xl border border-otis-200/20 dark:border-white/5 mb-4">
          <div className="flex items-start gap-2.5">
            <Calendar className="w-4 h-4 text-otis-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-gray-500 dark:text-stone-300 space-y-1">
              <p className="font-medium text-otis-600 dark:text-otis-300">
                {t('settings.reminder.desc')}
              </p>
              <p>{t('settings.reminder.detail')}</p>
            </div>
          </div>
        </div>

        {notificationError && (
          <div className="flex items-start gap-2 p-3 bg-red-50/80 dark:bg-red-900/20 backdrop-blur rounded-2xl border border-red-200/60 dark:border-red-700/40 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
            <p className="text-xs text-red-500">{notificationError}</p>
          </div>
        )}

        <Button
          onClick={toggleNotification}
          fullWidth
          variant={notificationEnabled ? 'secondary' : 'primary'}
          disabled={notificationLoading}
        >
          {notificationLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              {notificationEnabled
                ? t('settings.reminder.deactivating')
                : t('settings.reminder.activating')}
            </span>
          ) : notificationEnabled ? (
            <span className="flex items-center gap-2">
              <BellOff className="w-4 h-4" />
              {t('settings.reminder.deactivate')}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              {t('settings.reminder.activate')}
            </span>
          )}
        </Button>
      </Card>

      {/* Language Switcher */}
      <LanguageSwitcher />

      {/* Theme Switcher */}
      <ThemeSwitcher />

      {/* Lift Zone Manager */}
      <LiftZoneManager />

      {/* Sync Status */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Smartphone className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle>{t('settings.sync')}</CardTitle>
              <p className="text-[10px] text-gray-400 dark:text-stone-300">
                {t('settings.sync.subtitle')}
              </p>
            </div>
          </div>
          <Badge variant={syncStatus.online ? 'success' : 'danger'}>
            {syncStatus.online ? t('settings.online') : t('settings.offline')}
          </Badge>
        </div>

        <div className="space-y-2.5 text-sm text-gray-600 dark:text-stone-300 mb-4 p-3.5 bg-otis-50/50 dark:bg-white/3 rounded-2xl border border-otis-200/20 dark:border-white/5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-gray-400 dark:text-stone-300" />
              {t('settings.status')}
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              {syncStatus.online ? (
                <>
                  <Wifi className="w-4 h-4 text-emerald-500" /> {t('settings.online')}
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-500" /> {t('settings.offline')}
                </>
              )}
            </span>
          </div>
          {syncStatus.lastSync && (
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-400 dark:text-stone-300" />
                {t('settings.last.sync')}
              </span>
              <span className="font-medium">
                {new Date(syncStatus.lastSync).toLocaleTimeString('de-DE')}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-gray-400 dark:text-stone-300" />
              {t('settings.pending')}
            </span>
            <Badge variant={syncStatus.pendingSync > 0 ? 'warning' : 'success'} size="sm">
              {syncStatus.pendingSync > 0
                ? t('settings.pending.count', { n: syncStatus.pendingSync })
                : t('settings.pending.none')}
            </Badge>
          </div>
        </div>

        <Button onClick={handleSync} variant="secondary" fullWidth disabled={syncStatus.syncing}>
          <RefreshCw className={cn('w-4 h-4', syncStatus.syncing && 'animate-spin')} />
          {syncStatus.syncing ? t('settings.syncing') : t('settings.sync.now')}
        </Button>
      </Card>

      {/* App Info */}
      <Card variant="outline">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-otis-100/50 dark:bg-otis-800/30 flex items-center justify-center flex-shrink-0">
            <Info className="w-4 h-4 text-otis-500" />
          </div>
          <div className="text-xs text-gray-400 dark:text-stone-300 space-y-1">
            <p className="font-semibold text-otis-600 dark:text-otis-300">
              {t('settings.app.info')}
            </p>
            <p>{t('settings.app.desc')}</p>
            <p>
              {t('settings.reminder.state', {
                state: notificationEnabled
                  ? t('settings.reminder.active')
                  : t('settings.reminder.inactive'),
              })}
            </p>
            {user && (
              <p className="font-mono text-[10px] text-gray-400 dark:text-stone-300">
                {t('settings.user', { email: user.email })}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Logout */}
      <Button onClick={handleLogout} variant="danger" fullWidth size="lg">
        <LogOut className="w-5 h-5" />
        {t('settings.logout')}
      </Button>
    </div>
  )
}

function ThemeSwitcher() {
  const { t } = useTranslation()
  const { theme, setTheme } = useAppStore(
    useShallow((s) => ({ theme: s.theme, setTheme: s.setTheme })),
  )

  const options: { value: 'system' | 'light' | 'dark'; label: string; icon: typeof Sun }[] = [
    { value: 'system', label: t('theme.system'), icon: Monitor },
    { value: 'light', label: t('theme.light'), icon: Sun },
    { value: 'dark', label: t('theme.dark'), icon: Moon },
  ]

  return (
    <Card>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          {theme === 'dark' ? (
            <Moon className="w-4 h-4 text-white" />
          ) : theme === 'light' ? (
            <Sun className="w-4 h-4 text-white" />
          ) : (
            <Monitor className="w-4 h-4 text-white" />
          )}
        </div>
        <div>
          <CardTitle>{t('theme.title')}</CardTitle>
          <p className="text-[10px] text-gray-400 dark:text-stone-300">{t('theme.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const Icon = opt.icon
          const isActive = theme === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                'flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-2xl border-2 transition-all duration-200 active:scale-95',
                isActive
                  ? 'bg-otis-500/10 dark:bg-otis-500/20 border-otis-400/40 dark:border-otis-500/40 text-otis-700 dark:text-otis-300'
                  : 'bg-otis-50/50 dark:bg-white/3 border-transparent text-gray-500 dark:text-stone-300 hover:border-otis-300/30 dark:hover:border-white/10 hover:text-otis-600 dark:hover:text-otis-300',
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'text-otis-500')} />
              <span className="text-[11px] font-semibold leading-tight text-center">
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>
    </Card>
  )
}

interface LiftItem {
  anlagenummer: string
  projectId: string
  address: string
  effectiveZone: number
  isManual: boolean
}

function LiftZoneManager() {
  const { t } = useTranslation()
  const { locations, setLocations, setFavoriteLocations } = useAppStore(
    useShallow((s) => ({
      locations: s.locations,
      setLocations: s.setLocations,
      setFavoriteLocations: s.setFavoriteLocations,
    })),
  )
  const [liftList, setLiftList] = useState<LiftItem[]>([])
  const [filteredList, setFilteredList] = useState<LiftItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [editingLift, setEditingLift] = useState<string | null>(null)
  const [editProject, setEditProject] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editZone, setEditZone] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success')
  const [isAdding, setIsAdding] = useState(false)
  const [addNr, setAddNr] = useState('')
  const [addProject, setAddProject] = useState('')
  const [addAddress, setAddAddress] = useState('')
  const [addZone, setAddZone] = useState(0)

  const loadLifts = useCallback(async () => {
    setIsLoading(true)
    const allLocs = await localDb.getAllLocations()
    const favs = await localDb.getFavoriteLocations()

    // Merge locations + favorites by anlagenummer
    const seen = new Set<string>()
    const merged: LiftItem[] = []

    for (const loc of allLocs) {
      if (!seen.has(loc.anlagenummer.toUpperCase())) {
        seen.add(loc.anlagenummer.toUpperCase())
        merged.push({
          anlagenummer: loc.anlagenummer,
          projectId: loc.project_id,
          address: loc.full_address,
          effectiveZone: loc.manual_zone ?? loc.zone,
          isManual: loc.manual_zone !== undefined,
        })
      }
    }
    for (const fav of favs) {
      if (!seen.has(fav.anlagenummer.toUpperCase())) {
        seen.add(fav.anlagenummer.toUpperCase())
        merged.push({
          anlagenummer: fav.anlagenummer,
          projectId: fav.project_id,
          address: fav.full_address,
          effectiveZone: fav.manual_zone ?? fav.zone,
          isManual: fav.manual_zone !== undefined,
        })
      }
    }

    // Sort by anlagenummer
    merged.sort((a, b) => a.anlagenummer.localeCompare(b.anlagenummer))
    setLiftList(merged)
    setFilteredList(merged)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadLifts()
  }, [loadLifts])

  // Filter list when search changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredList(liftList)
      return
    }
    const q = searchQuery.toLowerCase()
    setFilteredList(
      liftList.filter(
        (lift) =>
          lift.anlagenummer.toLowerCase().includes(q) ||
          lift.projectId.toLowerCase().includes(q) ||
          lift.address.toLowerCase().includes(q),
      ),
    )
  }, [searchQuery, liftList])

  const showFeedback = (msg: string, type: 'success' | 'error') => {
    setSaveFeedback(msg)
    setFeedbackType(type)
    setTimeout(() => setSaveFeedback(null), 2500)
  }

  const startEditing = (lift: LiftItem) => {
    setIsAdding(false)
    setEditingLift(lift.anlagenummer)
    setEditProject(lift.projectId)
    setEditAddress(lift.address)
    setEditZone(lift.effectiveZone)
  }

  const cancelEditing = () => {
    setIsAdding(false)
    setEditingLift(null)
    setEditProject('')
    setEditAddress('')
    setEditZone(0)
    setDeleteConfirm(null)
  }

  const saveLiftDetails = async (anlagenummer: string) => {
    try {
      // Update project / address
      await localDb.updateLocationDetails(anlagenummer, {
        project_id: editProject,
        full_address: editAddress,
      })

      // Update zone
      const manualZone = editZone > 0 ? editZone : undefined
      const effectiveZone = manualZone ?? editZone
      await localDb.updateLocationZone(anlagenummer, effectiveZone, manualZone)

      // Refresh store locations and favorites
      const updatedLocs = await localDb.getAllLocations()
      setLocations(updatedLocs)
      const updatedFavs = await localDb.getFavoriteLocations()
      setFavoriteLocations(updatedFavs.slice(0, 5))

      showFeedback(t('lifts.saved', { nr: anlagenummer }), 'success')
      setEditingLift(null)
      loadLifts()
    } catch (err) {
      showFeedback(t('lifts.save.error'), 'error')
      setEditingLift(null)
    }
  }

  const deleteLift = async (anlagenummer: string) => {
    try {
      await localDb.deleteLocation(anlagenummer)

      // Refresh store locations and favorites
      const updatedLocs = await localDb.getAllLocations()
      setLocations(updatedLocs)
      const updatedFavs = await localDb.getFavoriteLocations()
      setFavoriteLocations(updatedFavs.slice(0, 5))

      showFeedback(t('lifts.deleted', { nr: anlagenummer }), 'success')
      setDeleteConfirm(null)
      setEditingLift(null)
      loadLifts()
    } catch (err) {
      showFeedback(t('lifts.delete.error'), 'error')
      setDeleteConfirm(null)
    }
  }

  const addLift = async (
    anlagenummer: string,
    projectId: string,
    address: string,
    zone: number,
  ) => {
    try {
      const key = anlagenummer.toUpperCase()
      const newId = `manual_${key}_${Date.now()}`
      const manualZone = zone > 0 ? zone : undefined

      // Save to locations store
      await localDb.cacheLocations([
        {
          id: newId,
          anlagenummer: key,
          project_id: projectId,
          full_address: address,
          latitude: 0,
          longitude: 0,
          zone: manualZone ?? 0,
          manual_zone: manualZone,
          created_at: new Date().toISOString(),
        },
      ])

      // Save to favorites
      await localDb.addFavoriteLocation({
        anlagenummer: key,
        project_id: projectId,
        full_address: address,
        latitude: 0,
        longitude: 0,
        zone: manualZone ?? 0,
        manual_zone: manualZone,
      })

      // Refresh store locations and favorites
      const updatedLocs = await localDb.getAllLocations()
      setLocations(updatedLocs)
      const updatedFavs = await localDb.getFavoriteLocations()
      setFavoriteLocations(updatedFavs.slice(0, 5))

      showFeedback(t('lifts.added', { nr: key }), 'success')
      setIsAdding(false)
      setAddNr('')
      setAddProject('')
      setAddAddress('')
      setAddZone(0)
      loadLifts()
    } catch (err) {
      showFeedback(t('lifts.add.error'), 'error')
    }
  }

  const ZONE_OPTIONS = [
    { value: 0, label: t('lifts.zone.auto') },
    { value: 1, label: t('lifts.zone.1') },
    { value: 2, label: t('lifts.zone.2') },
    { value: 3, label: t('lifts.zone.3') },
    { value: 4, label: t('lifts.zone.4') },
  ]

  if (liftList.length === 0 && !isLoading) return null

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <div>
            <CardTitle>{t('lifts.title')}</CardTitle>
            <p className="text-[10px] text-gray-400 dark:text-stone-300">
              {t('lifts.count', { n: liftList.length })}{' '}
              {filteredList.length < liftList.length
                ? t('lifts.filtered', { n: filteredList.length })
                : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              cancelEditing()
              setIsAdding(true)
              setAddNr('')
              setAddProject('')
              setAddAddress('')
              setAddZone(0)
              setSearchQuery('')
            }}
            className="h-8 px-3 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center gap-1.5 text-white text-xs font-semibold shadow-lg shadow-emerald-500/20 hover:from-emerald-500 hover:to-emerald-700 transition-all active:scale-95"
            title={t('lifts.add.title')}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('lifts.add')}</span>
          </button>
          <button
            onClick={loadLifts}
            className="w-8 h-8 rounded-xl glass dark:glass-dark flex items-center justify-center hover:bg-white/20 transition-all"
            title={t('lifts.refresh')}
          >
            <RefreshCw
              className={cn(
                'w-4 h-4 text-gray-400 dark:text-stone-300',
                isLoading && 'animate-spin',
              )}
            />
          </button>
        </div>
      </div>

      {/* Search filter */}
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-stone-300" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('lifts.search.placeholder')}
          className="w-full h-10 pl-10 pr-4 rounded-2xl text-sm glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-white/20 transition-all"
          >
            <X className="w-3 h-3 text-gray-500 dark:text-stone-400" />
          </button>
        )}
      </div>

      {/* Feedback banner */}
      {saveFeedback && (
        <div
          className={cn(
            'flex items-center gap-2 p-3 mb-3 backdrop-blur rounded-2xl border transition-all',
            feedbackType === 'success'
              ? 'bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200/60 dark:border-emerald-700/40'
              : 'bg-red-50/80 dark:bg-red-900/20 border-red-200/60 dark:border-red-700/40',
          )}
        >
          <Check
            className={cn(
              'w-4 h-4',
              feedbackType === 'success' ? 'text-emerald-500' : 'text-red-500',
            )}
          />
          <p
            className={cn(
              'text-xs font-medium',
              feedbackType === 'success'
                ? 'text-emerald-600 dark:text-emerald-300'
                : 'text-red-600 dark:text-red-300',
            )}
          >
            {saveFeedback}
          </p>
        </div>
      )}

      {/* Add new lift form */}
      {isAdding && (
        <div className="mb-3 p-3 rounded-2xl border-2 border-emerald-200/60 dark:border-emerald-700/40 bg-emerald-50/80 dark:bg-emerald-900/20 backdrop-blur animate-slide-down">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
              <Plus className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300">
              {t('lifts.add.title')}
            </span>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">
                {t('lifts.add.nr')} <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={addNr}
                onChange={(e) => setAddNr(e.target.value.toUpperCase())}
                placeholder={t('lifts.add.nr.placeholder')}
                className="w-full h-9 px-3 rounded-xl text-xs bg-white dark:bg-otis-800 border border-emerald-300/40 dark:border-emerald-700/30 text-otis-800 dark:text-white focus:outline-none focus:border-emerald-400/60"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">
                {t('lifts.add.project')}
              </label>
              <input
                type="text"
                value={addProject}
                onChange={(e) => setAddProject(e.target.value)}
                placeholder={t('lifts.add.project.placeholder')}
                className="w-full h-9 px-3 rounded-xl text-xs bg-white dark:bg-otis-800 border border-emerald-300/40 dark:border-emerald-700/30 text-otis-800 dark:text-white focus:outline-none focus:border-emerald-400/60"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">
                {t('lifts.add.address')}
              </label>
              <input
                type="text"
                value={addAddress}
                onChange={(e) => setAddAddress(e.target.value)}
                placeholder={t('lifts.add.address.placeholder')}
                className="w-full h-9 px-3 rounded-xl text-xs bg-white dark:bg-otis-800 border border-emerald-300/40 dark:border-emerald-700/30 text-otis-800 dark:text-white focus:outline-none focus:border-emerald-400/60"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mb-0.5">
                {t('lifts.add.zone')}
              </label>
              <select
                value={addZone}
                onChange={(e) => setAddZone(Number(e.target.value))}
                className="w-full h-9 px-3 rounded-xl text-xs bg-white dark:bg-otis-800 border border-emerald-300/40 dark:border-emerald-700/30 text-otis-800 dark:text-white focus:outline-none focus:border-emerald-400/60"
              >
                {ZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-3 pt-1">
            <button
              onClick={() => {
                if (!addNr.trim()) {
                  showFeedback(t('lifts.add.error.required'), 'error')
                  return
                }
                const key = addNr.trim().toUpperCase()
                // Check if already exists
                const exists = liftList.some((l) => l.anlagenummer.toUpperCase() === key)
                if (exists) {
                  showFeedback(t('lifts.add.error.exists', { nr: key }), 'error')
                  return
                }
                addLift(key, addProject.trim(), addAddress.trim(), addZone)
              }}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-500 text-white font-semibold text-xs hover:bg-emerald-600 transition-all active:scale-95 shadow-md shadow-emerald-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('lifts.add.btn')}
            </button>
            <button
              onClick={() => {
                setIsAdding(false)
                setAddNr('')
                setAddProject('')
                setAddAddress('')
                setAddZone(0)
              }}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-700/40 text-red-600 dark:text-red-300 font-semibold text-xs hover:bg-red-100 dark:hover:bg-red-800/30 transition-all active:scale-95"
            >
              <X className="w-3.5 h-3.5" />
              {t('lifts.add.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Loading / Empty state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-otis-300 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-otis-100/50 dark:bg-otis-800/30 flex items-center justify-center mb-2">
            <MapPin className="w-6 h-6 text-gray-400 dark:text-stone-300" />
          </div>
          <p className="text-sm text-gray-400 dark:text-stone-300 font-medium">
            {searchQuery ? t('lifts.notfound') : t('lifts.empty')}
          </p>
          <p className="text-[10px] text-gray-400 dark:text-stone-300 mt-0.5">
            {searchQuery ? t('lifts.notfound.hint') : t('lifts.empty.hint')}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[420px] overflow-y-auto scrollbar-hide">
          {filteredList.map((lift) => (
            <div
              key={lift.anlagenummer}
              className={cn(
                'rounded-2xl border transition-all duration-200',
                editingLift === lift.anlagenummer
                  ? 'bg-otis-50/80 dark:bg-otis-900/30 border-otis-300/40 dark:border-otis-600/40'
                  : 'bg-otis-50/50 dark:bg-white/3 border-otis-200/20 dark:border-white/5 hover:border-otis-300/30 dark:hover:border-white/10',
              )}
            >
              {editingLift === lift.anlagenummer ? (
                /* ── EDIT MODE ── */
                <div className="p-3 space-y-2.5">
                  {/* Header with anlagenummer + zone */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 flex items-center justify-center">
                        <MapPin className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="font-bold text-sm text-otis-800 dark:text-white">
                        {lift.anlagenummer}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <select
                        value={editZone}
                        onChange={(e) => setEditZone(Number(e.target.value))}
                        className="h-8 px-2 rounded-xl text-xs font-semibold bg-white dark:bg-otis-800 border border-otis-300/30 dark:border-otis-700/30 text-otis-800 dark:text-white focus:outline-none focus:border-otis-400/50"
                      >
                        {ZONE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Editable fields */}
                  <div className="space-y-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-otis-500 dark:text-otis-400 mb-0.5">
                        {t('lifts.edit.project')}
                      </label>
                      <input
                        type="text"
                        value={editProject}
                        onChange={(e) => setEditProject(e.target.value)}
                        placeholder={t('lifts.add.project.placeholder')}
                        className="w-full h-9 px-3 rounded-xl text-xs bg-white dark:bg-otis-800 border border-otis-300/30 dark:border-otis-700/30 text-otis-800 dark:text-white focus:outline-none focus:border-otis-400/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-otis-500 dark:text-otis-400 mb-0.5">
                        {t('lifts.edit.address')}
                      </label>
                      <input
                        type="text"
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder={t('lifts.add.address.placeholder')}
                        className="w-full h-9 px-3 rounded-xl text-xs bg-white dark:bg-otis-800 border border-otis-300/30 dark:border-otis-700/30 text-otis-800 dark:text-white focus:outline-none focus:border-otis-400/50"
                      />
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => saveLiftDetails(lift.anlagenummer)}
                      className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-700/40 text-emerald-700 dark:text-emerald-300 font-semibold text-xs hover:bg-emerald-200 dark:hover:bg-emerald-800/40 transition-all active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {t('lifts.edit.save')}
                    </button>
                    <button
                      onClick={cancelEditing}
                      className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200/60 dark:border-red-700/40 text-red-600 dark:text-red-300 font-semibold text-xs hover:bg-red-100 dark:hover:bg-red-800/30 transition-all active:scale-95"
                    >
                      <X className="w-3.5 h-3.5" />
                      {t('lifts.edit.cancel')}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(lift.anlagenummer)}
                      className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200/60 dark:border-orange-700/40 flex items-center justify-center hover:bg-orange-100 dark:hover:bg-orange-800/30 transition-all active:scale-90"
                      title={t('lifts.delete.btn')}
                    >
                      <Trash2 className="w-4 h-4 text-orange-500" />
                    </button>
                  </div>

                  {/* Delete confirmation */}
                  {deleteConfirm === lift.anlagenummer && (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50/80 dark:bg-red-900/20 border border-red-200/60 dark:border-red-700/40 animate-slide-down">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <span className="text-xs text-red-600 dark:text-red-300 flex-1">
                        {t('lifts.confirm.delete', { nr: lift.anlagenummer })}
                      </span>
                      <button
                        onClick={() => deleteLift(lift.anlagenummer)}
                        className="h-7 px-3 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-all active:scale-95"
                      >
                        {t('lifts.delete.btn')}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="h-7 px-3 rounded-lg bg-gray-200 dark:bg-white/10 text-gray-600 dark:text-stone-200 text-xs font-semibold hover:bg-gray-300 dark:hover:bg-white/20 transition-all active:scale-95"
                      >
                        {t('lifts.delete.no')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                /* ── VIEW MODE ── */
                <div className="flex items-center gap-2 p-2.5">
                  {/* Lift info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-otis-700 dark:text-otis-300">
                        {lift.anlagenummer}
                      </span>
                      {lift.projectId && (
                        <span className="text-[10px] font-mono font-medium text-gray-400 dark:text-stone-400 bg-otis-100/30 dark:bg-white/3 px-1.5 py-0.5 rounded-lg">
                          {lift.projectId}
                        </span>
                      )}
                    </div>
                    {lift.address && (
                      <p className="text-[10px] text-gray-400 dark:text-stone-400 truncate mt-0.5">
                        {lift.address}
                      </p>
                    )}
                  </div>

                  {/* Zone badge + edit button */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge variant={lift.isManual ? 'warning' : 'zone'} size="sm">
                      Z{lift.effectiveZone}
                      {lift.isManual && (
                        <span className="ml-0.5 text-[9px] text-amber-600 dark:text-amber-300">
                          &bull;
                        </span>
                      )}
                    </Badge>
                    <button
                      onClick={() => startEditing(lift)}
                      className="w-7 h-7 rounded-lg bg-otis-100/50 dark:bg-otis-800/30 flex items-center justify-center hover:bg-otis-200/50 dark:hover:bg-otis-700/40 transition-all active:scale-90"
                      title={t('lifts.edit.title')}
                    >
                      <Pencil className="w-3.5 h-3.5 text-otis-500" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
