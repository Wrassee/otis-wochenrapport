import { useState, useEffect } from 'react'
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

export function ExportPage() {
  const { t } = useTranslation()
  const { currentWeek, weekSummary, loadWeekEntries, calculateWeekSummary, profile, timeEntries, dailyExpenses, locations, favoriteLocations } = useAppStore()
  const [exporting, setExporting] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadFilename, setDownloadFilename] = useState<string>('')

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
   * Save a Blob to the device. Tries three methods in order:
   * 1. Web Share API (mobile, native share sheet with the file)
   * 2. window.open(blobUrl) (fallback — might work in WebView)
   * 3. Visible manual download link (ALWAYS works — real user tap)
   */
  const saveBlob = async (blob: Blob, filename: string) => {
    // Clean up any previous download URL
    if (downloadUrl) {
      window.URL.revokeObjectURL(downloadUrl)
      setDownloadUrl(null)
    }

    // Create the blob URL (sync, no gesture issues)
    const url = window.URL.createObjectURL(blob)

    // 1. Try Share API (mobile) — best UX, user chooses where to save.
    //    Note: canShare() is NOT checked because it can throw on some WebViews.
    //    We just try navigator.share() directly — if it fails, we fall through.
    if (typeof navigator.share !== 'undefined') {
      try {
        const file = new File([blob], filename, {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
        await navigator.share({
          title: `Wochenrapport KW${currentWeek.week}`,
          files: [file],
        })
        // Share succeeded — user either saved it or sent it
        setTimeout(() => window.URL.revokeObjectURL(url), 1000)
        return
      } catch {
        // User cancelled share or API not supported — fall through
      }
    }

    // 2. Try window.open — might work in some WebViews or desktop browsers.
    window.open(url, '_blank')

    // 3. ALWAYS provide a visible manual download link.
    //    The user can tap it — real gesture, always works.
    //    The blob URL stays alive until the user taps the link
    //    (10s cleanup in onClick) or a new export replaces it.
    setDownloadUrl(url)
    setDownloadFilename(filename)
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
    setExporting(true)
    setStatus(null)
    try {
      const state = useAppStore.getState()
      const entriesData = buildEntriesData()
      const allExpenses = collectWeekExpenses()
      const renderUrl = import.meta.env.VITE_RENDER_URL || 'http://localhost:8000'

      let blob: Blob
      let usedOffline = false

      // Try backend
      try {
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
          signal: AbortSignal.timeout(30000),
        })

        if (!response.ok) {
          const detail = await response.text().catch(() => '')
          throw new Error(detail.slice(0, 200))
        }

        blob = await response.blob()
      } catch {
        // Backend unreachable — fall back to offline generation
        blob = await generateExcelOffline({
          year: currentWeek.year,
          week_number: currentWeek.week,
          personnel_number: state.profile?.personnel_number || '',
          full_name: state.profile?.full_name || '',
          entries: entriesData,
          expenses: allExpenses,
        })
        usedOffline = true
      }

      await triggerDownload(blob, usedOffline)
    } catch (err: any) {
      const msg = err?.message || t('export.failed')
      setStatus(`${t('common.error')}: ${msg}`)
    } finally {
      setExporting(false)
    }
  }

  /** Generate Excel offline and save via Share API / anchor */
  const generateAndSaveLocally = async (
    entriesData: OfflineEntry[],
    allExpenses: OfflineExpense[],
  ) => {
    const blob = await generateExcelOffline({
      year: currentWeek.year,
      week_number: currentWeek.week,
      personnel_number: profile?.personnel_number || '',
      full_name: profile?.full_name || '',
      entries: entriesData,
      expenses: allExpenses,
    })
    const filename = `Wochenrapport_KW${currentWeek.week}_${currentWeek.year}.xlsx`
    await saveBlob(blob, filename)
  }

  const handleSendEmail = async () => {
    setSending(true)
    setStatus(null)
    try {
      const state = useAppStore.getState()
      const entriesData = buildEntriesData()
      const allExpenses = collectWeekExpenses()
      const renderUrl = import.meta.env.VITE_RENDER_URL || 'http://localhost:8000'

      let usedOffline = false

      // Try backend
      try {
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
          signal: AbortSignal.timeout(30000),
        })

        if (!response.ok) throw new Error(t('export.email.failed'))

        // Email sent via backend — still save a local copy on the device
        await generateAndSaveLocally(entriesData, allExpenses)
      } catch {
        // Backend unreachable — generate offline and share via native Share API
        await generateAndSaveLocally(entriesData, allExpenses)
        usedOffline = true
      }

      setStatus(usedOffline
        ? `${t('export.email.success')} (${t('export.offline.generated')})`
        : t('export.email.success'),
      )
    } catch (err: any) {
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

      {/* Manual download link — shown when auto-download fails */}
      {downloadUrl && (
        <Card className="!border-amber-200/60 dark:!border-amber-700/40 !bg-amber-50/80 dark:!bg-amber-900/20">
          <a
            href={downloadUrl}
            download={downloadFilename}
            className="flex items-center gap-3 py-1"
            onClick={() => {
              // Revoke after user taps the link
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
