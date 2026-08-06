import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { SpesenPage } from '@/pages/SpesenPage'
import { WeeklyPage } from '@/pages/WeeklyPage'
import { ExportPage } from '@/pages/ExportPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { WizardPage } from '@/pages/WizardPage'
import { useAppStore } from '@/stores/appStore'
import { useShallow } from 'zustand/react/shallow'
import { getCurrentSession } from '@/db/supabase'
import { startBackgroundSync, stopBackgroundSync, onSyncStatusChange } from '@/db/sync'
import {
  cacheLocations,
  cacheActivityCodes,
  getAllLocations as getLocalLocations,
} from '@/db/indexeddb'
import { getLocations as getSupabaseLocations } from '@/db/supabase'
import { ACTIVITY_CODES } from '@/lib/constants'
import { scheduleMondayReminder, isReminderScheduled } from '@/db/notifications'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useTranslation } from '@/lib/useTranslation'
import { Building2 } from 'lucide-react'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/**
 * Inner component that has access to the React Router navigate function
 * so it can listen for SW NAVIGATE messages from notification clicks.
 */
function AppNavigator() {
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const { type, url } = event.data || {}
      if (type === 'NAVIGATE' && url) {
        navigate(url, { replace: true })
      }
    }

    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [navigate])

  return null
}

export default function App() {
  const [initializing, setInitializing] = useState(true)
  const { t } = useTranslation()
  const { setUser, initialize, setSyncStatus, setLocations, setActivityCodes, theme } = useAppStore(
    useShallow((s) => ({
      setUser: s.setUser,
      initialize: s.initialize,
      setSyncStatus: s.setSyncStatus,
      setLocations: s.setLocations,
      setActivityCodes: s.setActivityCodes,
      theme: s.theme,
    })),
  )

  // Apply the selected theme on mount and when it changes
  useEffect(() => {
    const root = document.documentElement

    const applyTheme = (t: 'system' | 'light' | 'dark') => {
      if (t === 'dark') {
        root.classList.add('dark')
      } else if (t === 'light') {
        root.classList.remove('dark')
      } else {
        // 'system' — follow OS preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', prefersDark)
      }
    }

    applyTheme(theme)

    // Listen for OS theme changes (only when mode is 'system')
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = (e: MediaQueryListEvent) => root.classList.toggle('dark', e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  useEffect(() => {
    async function init() {
      try {
        const session = await getCurrentSession()
        if (session?.user) {
          setUser({ id: session.user.id, email: session.user.email || '' })
          await initialize(session.user.id)
        }

        try {
          const locations = await getSupabaseLocations()
          await cacheLocations(locations)
          setLocations(locations)
        } catch {
          const cached = await getLocalLocations()
          if (cached.length > 0) setLocations(cached)
        }

        await cacheActivityCodes(ACTIVITY_CODES)
        setActivityCodes(ACTIVITY_CODES)

        // Schedule Monday morning notification if user has it enabled
        const reminderEnabled = await isReminderScheduled()
        if (reminderEnabled) {
          await scheduleMondayReminder()
        }
      } catch (err) {
        console.error('Init error:', err)
      } finally {
        setInitializing(false)
      }
    }

    init()

    // After each background sync, also pull the active week from the cloud so
    // entries recorded on another device (e.g. the phone) appear here without
    // a manual reload — cross-device sync in both directions.
    startBackgroundSync(30000, () => {
      // Only pull when online — loadWeekEntries already re-reads IndexedDB
      // unconditionally, and doing that every 30s while offline would just
      // churn state with a pointless re-render.
      if (!navigator.onLine) return
      useAppStore
        .getState()
        .loadWeekEntries()
        .catch((e) => console.warn('Failed to refresh week after background sync:', e))
    })

    const unsubscribe = onSyncStatusChange((status) => {
      setSyncStatus(status)
    })

    return () => {
      stopBackgroundSync()
      unsubscribe()
    }
    // All deps are stable zustand store actions — listing them is safe and
    // silences the exhaustive-deps error without re-running on every render.
  }, [initialize, setUser, setSyncStatus, setLocations, setActivityCodes])

  if (initializing) {
    return (
      <div className="flex items-center justify-center min-h-dvh bg-auth-ambient dark:bg-auth-ambient-dark relative overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 orb orb-blue opacity-60" />
        <div className="absolute -bottom-32 -left-32 w-72 h-72 orb orb-cyan opacity-40" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] orb orb-purple opacity-20" />

        <div className="flex flex-col items-center gap-6 relative z-10">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl animate-float">
            <div className="flex flex-col items-center">
              <span className="text-4xl font-black text-white tracking-tight">OTIS</span>
              <div className="w-8 h-0.5 bg-white/30 rounded-full mt-0.5" />
            </div>
          </div>

          <div className="relative">
            <div className="w-12 h-12 border-[3px] border-white/15 rounded-full" />
            <div className="absolute inset-0 w-12 h-12 border-[3px] border-transparent border-t-white rounded-full animate-spin" />
          </div>

          <div className="text-center">
            <p className="text-white/80 text-sm font-medium">{t('app.loading')}</p>
            <div className="flex items-center justify-center gap-1.5 mt-3 text-otis-200/50 text-xs">
              <Building2 className="w-3 h-3" />
              <span>{t('common.otis')}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <AppNavigator />
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DashboardPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/spesen"
            element={
              <ProtectedRoute>
                <AppShell>
                  <SpesenPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/weekly"
            element={
              <ProtectedRoute>
                <AppShell>
                  <WeeklyPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/export"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ExportPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppShell>
                  <SettingsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />

          {/* Guided week-entry wizard — standalone, distraction-free */}
          <Route
            path="/wizard"
            element={
              <ProtectedRoute>
                <WizardPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
