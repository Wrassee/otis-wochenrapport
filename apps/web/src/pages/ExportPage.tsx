import { useState, useEffect, useRef } from 'react'
import { ExportSummary } from '@/components/export/ExportSummary'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/lib/useTranslation'
import { getWeekDates, formatDateShort } from '@/lib/utils'
import { cn } from '@/lib/cn'
import { Calendar, FileSpreadsheet, Info, Bug } from 'lucide-react'
import { generateExcelOffline } from '@/services/offlineGenerator'
import type { OfflineEntry, OfflineExpense } from '@/services/offlineGenerator'

export function ExportPage() {
  const { t } = useTranslation()
  const { currentWeek, weekSummary, loadWeekEntries, calculateWeekSummary, profile, timeEntries, dailyExpenses, locations, favoriteLocations } = useAppStore()
  const [exporting, setExporting] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadFilename, setDownloadFilename] = useState<string>('')
  const [showDebug, setShowDebug] = useState(false)
  const [debugLog, setDebugLog] = useState<string[]>([])
  const debugRef = useRef<HTMLPreElement>(null)

  /** Debug logger — writes to console and hidden UI panel */
  const dbg = (msg: string) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`
    console.log(line)
    setDebugLog(prev => {
      if (prev.length >= 50) return [...prev.slice(-49), line]
      return [...prev, line]
    })
  }

  useEffect(() => {
    if (debugRef.current) {
      debugRef.current.scrollTop = debugRef.current.scrollHeight
    }
  }, [debugLog])

  useEffect(() => {
    loadWeekEntries()
  }, [currentWeek, loadWeekEntries])

  useEffect(() => {
    calculateWeekSummary()
  }, [timeEntries, calculateWeekSummary])

  const buildEntriesData = (): OfflineEntry[] => {
    return timeEntries.map((e) => {
      let zone = e.location_zone || 0
      if (!zone && e.location_anlagenummer) {
        const key = e.location_anlagenummer.toUpperCase()
        const loc = locations.find((l) => l.anlagenummer.toUpperCase() === key)
        if (loc) {
          zone = loc.manual_zone ?? loc.zone ?? 0
        } else {
          const fav = favoriteLocations.find((f) => f.anlagenummer.toUpperCase() === key)
          zone = fav?.manual_zone ?? fav?.zone ?? 0
        }
      }
      return {
        date: e.date,
        start_time: e.start_time,
        duration: e.duration,
        anlagenummer: e.location_anlagenummer || '',
        project_id: e.location_project_id || '',
        address: e.location_address || '',
        activity_code: e.activity_code || '',
        is_lunch: e.is_lunch,
        zone,
      }
    })
  }

  const collectWeekExpenses = (): OfflineExpense[] => {
    const all: OfflineExpense[] = []
    const weekDates = getWeekDates(currentWeek.year, currentWeek.week)
    for (const d of weekDates) {
      const dayExp = dailyExpenses[d]
      if (dayExp && dayExp.length > 0) {
        all.push(...dayExp)
      }
    }
    return all
  }

  /**
   * Save a Blob to the device.
   * Strategy — the simplest approach that actually works:
   *   1. Programmatic <a download> click (works on web and Android WebView)
   *   2. Manual download link (always visible as backup)
   */
  const saveBlob = (blob: Blob, filename: string) => {
    const blobUrl = window.URL.createObjectURL(blob)

    // 1. Programmatic <a download> click
    dbg('⬇️  <a download> programmatic click…')
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    dbg('✅ <a> click dispatched')

    // 2. Manual download link (always available as backup)
    dbg('🟠 Setting manual amber download link…')
    setDownloadUrl(blobUrl)
    setDownloadFilename(filename)
    dbg('=== saveBlob complete ===')
  }

  const triggerDownload = async (blob: Blob, usedOffline: boolean) => {
    const filename = `Wochenrapport_KW${currentWeek.week}_${currentWeek.year}.xlsx`
    saveBlob(blob, filename)
    setStatus(usedOffline
      ? `${t('export.success')} (${t('export.offline.generated')})`
      : t('export.success'),
    )
  }

  const handleExport = async () => {
    setExporting(true)
    setStatus(null)
    setDebugLog([])
    try {
      const state = useAppStore.getState()
      const entriesData = buildEntriesData()
      const allExpenses = collectWeekExpenses()

      let blob: Blob
      let usedOffline = false

      // Try backend first
      try {
        const renderUrl = import.meta.env.VITE_RENDER_URL || 'http://localhost:8000'
        dbg(`🌐 Backend: ${renderUrl}/generate-excel`)
        const response = await fetch(`${renderUrl}/generate-excel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: currentWeek.year,
            week_number: currentWeek.week,
            user_id: state.user?.id,
            personnel_number: state.profile?.personnel_number || '',
            full_name: state.profile?.full_name || '',
            entries: entriesData,
            expenses: allExpenses,
          }),
          signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) {
          const detail = await response.text().catch(() => '')
          throw new Error(detail.slice(0, 200))
        }
        blob = await response.blob()
        dbg(`✅ Backend blob: ${blob.size} bytes`)
      } catch (innerErr: any) {
        dbg(`❌ Backend failed: ${innerErr?.message || 'unknown'}`)
        dbg('🔄 Generating offline…')
        try {
          blob = await generateExcelOffline({
            year: currentWeek.year,
            week_number: currentWeek.week,
            personnel_number: state.profile?.personnel_number || '',
            full_name: state.profile?.full_name || '',
            entries: entriesData,
            expenses: allExpenses,
          })
          dbg(`✅ Offline blob: ${blob.size} bytes`)
          usedOffline = true
        } catch (offlineErr: any) {
          dbg(`❌ Offline generation FAILED: ${offlineErr?.message || 'unknown'}`)
          setStatus(`${t('common.error')}: ${offlineErr?.message || t('export.failed')}`)
          setExporting(false)
          return
        }
      }

      await triggerDownload(blob, usedOffline)
    } catch (err: any) {
      const msg = err?.message || 'Unknown error'
      dbg(`🔥 CRASH: ${msg}`)
      setStatus(`${t('common.error')}: ${msg}`)
    } finally {
      setExporting(false)
    }
  }

  const generateAndSaveLocally = async (
    entriesData: OfflineEntry[],
    allExpenses: OfflineExpense[],
  ) => {
    dbg('🔄 generateAndSaveLocally…')
    const blob = await generateExcelOffline({
      year: currentWeek.year,
      week_number: currentWeek.week,
      personnel_number: profile?.personnel_number || '',
      full_name: profile?.full_name || '',
      entries: entriesData,
      expenses: allExpenses,
    })
    dbg(`✅ Blob ready: ${blob.size} bytes`)
    const filename = `Wochenrapport_KW${currentWeek.week}_${currentWeek.year}.xlsx`
    saveBlob(blob, filename)
    dbg('✅ generateAndSaveLocally complete')
  }

  const handleSendEmail = async () => {
    setSending(true)
    setStatus(null)
    setDebugLog([])
    try {
      const state = useAppStore.getState()
      const entriesData = buildEntriesData()
      const allExpenses = collectWeekExpenses()
      const renderUrl = import.meta.env.VITE_RENDER_URL || 'http://localhost:8000'
      let usedOffline = false

      try {
        dbg(`🌐 Backend: ${renderUrl}/send-email`)
        const response = await fetch(`${renderUrl}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: currentWeek.year,
            week_number: currentWeek.week,
            user_id: state.user?.id,
            personnel_number: state.profile?.personnel_number || '',
            full_name: state.profile?.full_name || '',
            supervisor_email: profile?.supervisor_email,
            entries: entriesData,
          }),
          signal: AbortSignal.timeout(5000),
        })
        if (!response.ok) throw new Error(t('export.email.failed'))
        dbg('✅ Email sent via backend')
        await generateAndSaveLocally(entriesData, allExpenses)
      } catch (innerErr: any) {
        dbg(`❌ Backend email failed: ${innerErr?.message || 'unknown'}`)
        await generateAndSaveLocally(entriesData, allExpenses)
        usedOffline = true
      }

      setStatus(usedOffline
        ? `${t('export.email.success')} (${t('export.offline.generated')})`
        : t('export.email.success'),
      )
    } catch (err: any) {
      dbg(`🔥 Email CRASH: ${err?.message || 'unknown'}`)
      setStatus(`${t('common.error')}: ${err.message || t('export.email.failed')}`)
    } finally {
      setSending(false)
    }
  }

  if (!weekSummary) return null

  const dates = getWeekDates(currentWeek.year, currentWeek.week)

  return (
    <div className="space-y-4">
      {/* Week header */}
      <Card>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-otis-500 to-otis-700 flex items-center justify-center shadow-lg shadow-otis-500/20 flex-shrink-0">
            <FileSpreadsheet className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-otis-800 dark:text-white">{t('export.title', { week: currentWeek.week })}</h2>
              <Badge variant={weekSummary.totalHours > 0 ? 'info' : 'warning'}>
                {weekSummary.totalHours.toFixed(1)}h
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs text-gray-500">
                {formatDateShort(dates[0])} – {formatDateShort(dates[4])}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Status message */}
      {status && (
        <Card variant={status.startsWith(t('common.error')) ? 'danger' : 'success'}>
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-2 h-2 rounded-full flex-shrink-0',
              status.startsWith(t('common.error')) ? 'bg-red-500' : 'bg-emerald-500'
            )} />
            <p className="text-sm font-medium">{status}</p>
          </div>
        </Card>
      )}

      {/* Export summary */}
      <ExportSummary
        weekSummary={weekSummary}
        onExport={handleExport}
        onSendEmail={handleSendEmail}
        exporting={exporting}
        sending={sending}
      />

      {/* Manual download link — shown when auto-download needs user action */}
      {downloadUrl && (
        <Card className="!border-amber-200/60 dark:!border-amber-700/40 !bg-amber-50/80 dark:!bg-amber-900/20">
          <a
            href={downloadUrl}
            download={downloadFilename}
            className="flex items-center gap-3 py-1"
            onClick={() => {
              setTimeout(() => {
                window.URL.revokeObjectURL(downloadUrl!)
                setDownloadUrl(null)
              }, 10000)
            }}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-amber-500/20">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {t('export.download.manual')}
              </p>
              <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 truncate">
                {downloadFilename}
              </p>
            </div>
          </a>
        </Card>
      )}

      {/* Hidden debug panel — toggleable via bug icon */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex items-center gap-1"
          title={showDebug ? 'Hide debug panel' : 'Show debug panel'}
        >
          <Bug className="w-3 h-3" />
          <span>{showDebug ? `${t('common.hide')} Debug` : 'Debug'}</span>
        </button>
      </div>

      {showDebug && (
        <Card className="!border-red-500/80 dark:!border-red-600/60 !bg-red-50 dark:!bg-red-950/90 !shadow-lg !shadow-red-500/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-sm shadow-red-500/50" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">
                EXPORT DEBUG
              </span>
              <span className="text-[10px] text-red-500/60 font-mono">
                ({debugLog.length} lines)
              </span>
            </div>
          </div>
          <pre
            ref={debugRef}
            className="text-[11px] leading-relaxed text-red-900 dark:text-red-200 font-mono max-h-[280px] overflow-y-auto whitespace-pre-wrap break-all bg-white/30 dark:bg-black/20 rounded-xl p-3 border border-red-200/40 dark:border-red-800/30"
          >
            {debugLog.length === 0 ? (
              <span className="italic text-red-400/60">Waiting for debug output…</span>
            ) : (
              debugLog.join('\n')
            )}
          </pre>
          {debugLog.length > 0 && (
            <button
              onClick={() => {
                const text = debugLog.join('\n')
                navigator.clipboard?.writeText(text).catch(() => {})
              }}
              className="mt-1.5 text-[10px] text-red-500/70 hover:text-red-600 font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border border-red-300/30 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              📋 Kopieren
            </button>
          )}
        </Card>
      )}

      {/* Info tip */}
      <Card variant="outline">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-otis-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 leading-relaxed">
            {t('export.info')}
          </p>
        </div>
      </Card>
    </div>
  )
}
