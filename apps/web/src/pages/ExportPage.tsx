import { useState, useEffect, useRef, useCallback } from 'react'
import { ExportSummary } from '@/components/export/ExportSummary'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/lib/useTranslation'
import { getWeekDates, formatDateShort } from '@/lib/utils'
import { cn } from '@/lib/cn'
import { Calendar, FileSpreadsheet, Info } from 'lucide-react'
import { generateExcelOffline } from '@/services/offlineGenerator'
import type { OfflineEntry, OfflineExpense } from '@/services/offlineGenerator'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share as CapacitorShare } from '@capacitor/share'


/** Wrap a promise in a timeout — rejects after `ms` milliseconds */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
    ),
  ])
}

/** Blob → base64 with 5s safety timeout */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timer = setTimeout(() => {
      reader.abort()
      reject(new Error('blobToBase64 timeout after 5s'))
    }, 5000)
    const reader = new FileReader()
    reader.onloadend = () => {
      clearTimeout(timer)
      const result = reader.result as string
      const b64 = result.split(',')[1]
      if (!b64) return reject(new Error('Failed to extract base64 from data URL'))
      resolve(b64)
    }
    reader.onerror = () => {
      clearTimeout(timer)
      reject(reader.error || new Error('FileReader error'))
    }
    reader.readAsDataURL(blob)
  })
}


export function ExportPage() {
  const { t } = useTranslation()
  const { currentWeek, weekSummary, loadWeekEntries, calculateWeekSummary, profile, timeEntries, dailyExpenses, locations, favoriteLocations } = useAppStore()
  const [exporting, setExporting] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadFilename, setDownloadFilename] = useState<string>('')
  const [debugLog, setDebugLog] = useState<string[]>([])
  const debugRef = useRef<HTMLPreElement>(null)

  const dbg = useCallback((msg: string) => {
    const line = `[${new Date().toLocaleTimeString()}] ${msg}`
    console.log(line)
    setDebugLog(prev => {
      if (prev.length >= 50) return [...prev.slice(-49), line]
      return [...prev, line]
    })
  }, [])

  // Alert on mount to confirm component renders
  useEffect(() => {
    window.alert('🔍 ExportPage geladen! Debug-Log erscheint beim Export-Klick.')
  }, [])

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
   * Strategy:
   *   1. Capacitor Filesystem.writeFile(Directory.Data) + CapacitorShare.share()  ← APK
   *   2. Programmatic <a download> click                                           ← web fallback
   *   3. Manual amber download link (always rendered as last resort)
   */
  const saveBlob = async (blob: Blob, filename: string) => {
    dbg(`🟦 saveBlob() called — filename: ${filename}, size: ${blob.size} bytes`)
    setDownloadUrl(null)

    // ── 1. Capacitor NATIV (APK) ──
    const isCapacitor = (window as any).Capacitor?.isNative
    dbg(`📱 Capacitor native: ${isCapacitor ? 'YES' : 'NO'}`)
    if (isCapacitor) {
      dbg('📁 Converting blob to base64…')
      try {
        const b64 = await blobToBase64(blob)
        dbg(`✅ base64: ${b64.length} chars`)

        // Try Directory.Data first (Android MediaStore, no extra permissions on 10+)
        try {
          dbg('💾 Filesystem.writeFile(Directory.Data)…')
          const result = await withTimeout(
            Filesystem.writeFile({
              path: filename,
              data: b64,
              directory: Directory.Data,
            }),
            8000,
            'Filesystem.Data',
          )
          dbg(`✅ File written! URI: ${result.uri}`)
          dbg('📤 CapacitorShare.share()…')
          await withTimeout(
            CapacitorShare.share({
              title: `Wochenrapport KW${currentWeek.week}`,
              files: [result.uri],
            }),
            8000,
            'CapacitorShare',
          )
          dbg('✅ Share dialog opened — user can save or send the file')
          return
        } catch (dataErr: any) {
          dbg(`❌ Directory.Data failed: ${dataErr?.message || 'unknown'}`)
          // Try Directory.Cache as fallback
          try {
            dbg('💾 Fallback: Filesystem.writeFile(Directory.Cache)…')
            const result = await withTimeout(
              Filesystem.writeFile({
                path: filename,
                data: b64,
                directory: Directory.Cache,
              }),
              8000,
              'Filesystem.Cache',
            )
            dbg(`✅ Cache file written! URI: ${result.uri}`)
            await withTimeout(
              CapacitorShare.share({
                title: `Wochenrapport KW${currentWeek.week}`,
                files: [result.uri],
              }),
              8000,
              'CapacitorShare',
            )
            dbg('✅ Share dialog opened (Cache fallback)')
            return
          } catch (cacheErr: any) {
            dbg(`❌ Cache also failed: ${cacheErr?.message || 'unknown'}`)
          }
        }
      } catch (b64Err: any) {
        dbg(`❌ blobToBase64 failed: ${b64Err?.message || 'unknown'}`)
      }
      dbg('⬇️  All Capacitor attempts failed — falling through to web fallbacks…')
    }

    // ── 2. Programmatic <a download> click (works in web browsers) ──
    try {
      dbg('⬇️  <a download> programmatic click…')
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      dbg('✅ <a> click dispatched')
      setTimeout(() => window.URL.revokeObjectURL(url), 5000)
    } catch (dlErr: any) {
      dbg(`❌ <a> click failed: ${dlErr?.message || 'unknown'}`)
    }

    // ── 3. Web Share API (web fallback) ──
    if (typeof navigator.share !== 'undefined' && typeof navigator.canShare !== 'undefined') {
      try {
        dbg('📤 Web Share API…')
        const blobCopy = blob.slice(0, blob.size, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        const file = new File([blobCopy], filename, {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: `Wochenrapport KW${currentWeek.week}`, files: [file] })
          dbg('✅ Web Share succeeded')
          return
        } else {
          dbg('⚠️ navigator.canShare says: cannot share this file')
        }
      } catch (shareErr: any) {
        dbg(`❌ Web Share failed: ${shareErr?.message || 'cancelled'}`)
      }
    } else {
      dbg('ℹ️ navigator.share not available in this browser')
    }

    // ── 4. Manual download link (always shown) ──
    dbg('🟠 Setting manual amber download link…')
    const url = window.URL.createObjectURL(blob)
    setDownloadUrl(url)
    setDownloadFilename(filename)
    dbg('✅ Manual link ready — user can tap to download')
    dbg('=== saveBlob complete ===')
  }

  const triggerDownload = async (blob: Blob, usedOffline: boolean) => {
    const filename = `Wochenrapport_KW${currentWeek.week}_${currentWeek.year}.xlsx`
    await saveBlob(blob, filename)
    setStatus(usedOffline
      ? `${t('export.success')} (${t('export.offline.generated')})`
      : t('export.success'),
    )
  }

  const handleExport = async () => {
    dbg('=== 🚀 Export gestartet ===')
    setExporting(true)
    setStatus(null)
    setDebugLog([])
    try {
      const state = useAppStore.getState()
      dbg(`📅 Woche ${currentWeek.week}/${currentWeek.year}`)
      dbg('🔨 buildEntriesData…')
      const entriesData = buildEntriesData()
      dbg(`✅ entriesData: ${entriesData.length} entries`)
      dbg('🔨 collectWeekExpenses…')
      const allExpenses = collectWeekExpenses()
      dbg(`✅ allExpenses: ${allExpenses.length} items`)

      let blob: Blob
      let usedOffline = false

      // Try backend first
      try {
        const renderUrl = import.meta.env.VITE_RENDER_URL || 'http://localhost:8000'
        dbg(`🌐 Fetching backend: ${renderUrl}/generate-excel`)
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
        dbg(`❌ Backend failed: ${innerErr?.message || 'unknown error'}`)
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

      dbg('⬇️  triggerDownload…')
      await triggerDownload(blob, usedOffline)
      dbg('=== ✅ Export erfolgreich abgeschlossen ===')
    } catch (err: any) {
      const msg = err?.message || 'Unknown error'
      dbg(`🔥 CRASH: ${msg}`)
      setStatus(`${t('common.error')}: ${msg}`)
    } finally {
      setExporting(false)
    }
  }

  /** Generate Excel offline and save via Capacitor / Share API / anchor */
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
    await saveBlob(blob, filename)
    dbg('✅ generateAndSaveLocally complete')
  }

  const handleSendEmail = async () => {
    setSending(true)
    setStatus(null)
    setDebugLog([])
    dbg('=== 📧 Email Export gestartet ===')
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

      {/* DEBUG PANEL — ALWAYS visible (removed showDebug condition) */}
      <Card className="!border-red-500/80 dark:!border-red-600/60 !bg-red-50 dark:!bg-red-950/90 !shadow-lg !shadow-red-500/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-sm shadow-red-500/50" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">
                🔍 EXPORT DEBUG
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
          {/* Quick copy button */}
          {debugLog.length > 0 && (
            <button
              onClick={() => {
                const text = debugLog.join('\n')
                navigator.clipboard?.writeText(text).catch(() => {})
                dbg('📋 Debug log copied to clipboard')
              }}
              className="mt-1.5 text-[10px] text-red-500/70 hover:text-red-600 font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg border border-red-300/30 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
            >
              📋 Kopieren
            </button>
          )}
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

      {/* Manual download link — shown when auto-download fails */}
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
