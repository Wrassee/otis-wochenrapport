import { useState, useEffect } from 'react'
import { ExportSummary } from '@/components/export/ExportSummary'
import { ReceiptPhotos } from '@/components/export/ReceiptPhotos'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useAppStore } from '@/stores/appStore'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from '@/lib/useTranslation'
import { getWeekDates, formatDateShort } from '@/lib/utils'
import { cn } from '@/lib/cn'
import { Calendar, FileSpreadsheet, Info } from 'lucide-react'
import { generateExcelOffline } from '@/services/offlineGenerator'
import type { OfflineEntry, OfflineExpense } from '@/services/offlineGenerator'
import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { dataUrlToBase64 } from '@/lib/photoUtils'
import { loadWeekExpensePhotos } from '@/lib/expensePhotos'
import { useExpensePhotos } from '@/hooks/useExpensePhotos'
import type { ExpensePhoto } from '@/lib/types'

export function ExportPage() {
  const { t } = useTranslation()
  const {
    currentWeek,
    weekSummary,
    loadWeekEntries,
    calculateWeekSummary,
    timeEntries,
    dailyExpenses,
    locations,
    favoriteLocations,
    user,
  } = useAppStore(
    useShallow((s) => ({
      currentWeek: s.currentWeek,
      weekSummary: s.weekSummary,
      loadWeekEntries: s.loadWeekEntries,
      calculateWeekSummary: s.calculateWeekSummary,
      timeEntries: s.timeEntries,
      dailyExpenses: s.dailyExpenses,
      locations: s.locations,
      favoriteLocations: s.favoriteLocations,
      user: s.user,
    })),
  )
  const [exporting, setExporting] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadFilename, setDownloadFilename] = useState<string>('')
  // Receipt photos come from the store-backed hook — Dashboard/Woche share the
  // same data, and the Export page just renders the merged week's photos.
  const { photos } = useExpensePhotos(currentWeek.year, currentWeek.week)
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

  /** Photographed receipts (Spesen Belege) for the current week — merged local + cloud. */
  const collectWeekPhotos = async (): Promise<ExpensePhoto[]> => {
    try {
      return await loadWeekExpensePhotos(user?.id, currentWeek.year, currentWeek.week)
    } catch (e) {
      console.warn('Failed to load receipt photos:', e)
      return []
    }
  }

  /** Non-empty photo notes for the current week, in display order. */
  const collectPhotoNotes = (): string[] => {
    return photos.map((p) => p.note?.trim() || '').filter((n) => n.length > 0)
  }

  /**
   * Export filename incl. the week's date range,
   * e.g. Wochenrapport_KW31_2026_27_07-31_07.xlsx (Mon–Fri, DD_MM).
   */
  const buildFilename = (): string => {
    const dates = getWeekDates(currentWeek.year, currentWeek.week)
    const fmt = (d: string) => {
      const [, mm, dd] = d.split('-') // YYYY-MM-DD → DD_MM
      return `${dd}_${mm}`
    }
    return `Wochenrapport_KW${currentWeek.week}_${currentWeek.year}_${fmt(dates[0])}-${fmt(dates[4])}.xlsx`
  }

  /**
   * Generate the week's Excel blob — backend first, offline fallback.
   * Shared by both the export and email buttons.
   */
  const generateWeekBlob = async (): Promise<{ blob: Blob; usedOffline: boolean }> => {
    const state = useAppStore.getState()
    const entriesData = buildEntriesData()
    const allExpenses = collectWeekExpenses()
    const photoNotes = collectPhotoNotes()

    try {
      const renderUrl = import.meta.env.VITE_RENDER_URL || 'http://localhost:8000'
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
          photo_notes: photoNotes,
        }),
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok) {
        const detail = await response.text().catch(() => '')
        throw new Error(detail.slice(0, 200))
      }
      const blob = await response.blob()
      return { blob, usedOffline: false }
    } catch (innerErr: any) {
      // Backend unreachable — fall back to offline generation (expected on mobile).
      console.warn('Backend unreachable, generating Excel offline:', innerErr)
      const blob = await generateExcelOffline({
        year: currentWeek.year,
        week_number: currentWeek.week,
        personnel_number: state.profile?.personnel_number || '',
        full_name: state.profile?.full_name || '',
        entries: entriesData,
        expenses: allExpenses,
        photo_notes: photoNotes,
      })
      return { blob, usedOffline: true }
    }
  }

  /**
   * Save a Blob (+ optional receipt photos) to the device.
   * Strategy — two approaches in order:
   *   1. Capacitor Filesystem.writeFile + Share.share() — main file first, then
   *      each receipt photo; all URIs are passed to the Share dialog so the
   *      email attachment includes the photographed invoices too.
   *   2. Manual download link (user taps it — always visible)
   */
  const saveBlob = async (
    blob: Blob,
    filename: string,
    dialogTitle?: string,
    attachments: { filename: string; dataUrl: string }[] = [],
  ) => {
    const blobUrl = window.URL.createObjectURL(blob)

    // 1. Capacitor native file write (silent, best-effort)
    const isNative = Capacitor.getPlatform() !== 'web'
    if (isNative) {
      try {
        const reader = new FileReader()
        const base64 = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result as string
            resolve(result.split(',')[1])
          }
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })

        await Filesystem.writeFile({
          path: filename,
          data: base64,
          directory: Directory.Data,
        })

        // Write each receipt photo to internal storage
        const photoUris: string[] = []
        for (let i = 0; i < attachments.length; i++) {
          const att = attachments[i]
          await Filesystem.writeFile({
            path: att.filename,
            data: dataUrlToBase64(att.dataUrl),
            directory: Directory.Data,
          })
          const stat = await Filesystem.getUri({
            path: att.filename,
            directory: Directory.Data,
          })
          photoUris.push(stat.uri)
        }

        // 1b. Open native Share dialog so user can save/email the file(s)
        try {
          const fileStat = await Filesystem.getUri({
            path: filename,
            directory: Directory.Data,
          })
          const allUris = [fileStat.uri, ...photoUris]
          await Share.share({
            // urls is Android-only. Pass url: allUris[0] alongside urls so iOS
            // still shares the Excel file (Android ignores url when urls is set).
            ...(allUris.length > 1 ? { urls: allUris, url: allUris[0] } : { url: allUris[0] }),
            title: filename,
            dialogTitle: dialogTitle || t('export.excel.btn'),
          })
        } catch (shareErr: any) {
          // Share sheet cancelled or failed — the manual download link remains as fallback.
          console.warn('Share cancelled or failed:', shareErr)
        }
      } catch (e: any) {
        console.error('Capacitor native write failed — falling back to download link:', e)
      }
    }

    // 2. Manual download link (always available as backup)
    setDownloadUrl(blobUrl)
    setDownloadFilename(filename)
  }

  const handleExport = async () => {
    setExporting(true)
    setStatus(null)
    try {
      const { blob, usedOffline } = await generateWeekBlob()
      const filename = buildFilename()
      await saveBlob(blob, filename, t('export.excel.btn'))
      setStatus(
        usedOffline
          ? `${t('export.success')} (${t('export.offline.generated')})`
          : t('export.success'),
      )
    } catch (err: any) {
      const msg = err?.message || 'Unknown error'
      console.error('Excel export failed:', err)
      setStatus(`${t('common.error')}: ${msg}`)
    } finally {
      setExporting(false)
    }
  }

  const handleSendEmail = async () => {
    setSending(true)
    setStatus(null)
    try {
      const { blob, usedOffline } = await generateWeekBlob()
      const filename = buildFilename()

      // Collect photographed receipts for this week and attach them to the
      // Share sheet — the email app receives the Excel + all Belege together.
      const photos = await collectWeekPhotos()
      const attachments = photos.map((p, i) => ({
        filename: p.filename || `Beleg_${currentWeek.week}_${i + 1}.jpg`,
        dataUrl: p.dataUrl,
      }))

      // Open the native Share sheet — the user picks their email app from there,
      // same pattern as the export button.
      await saveBlob(blob, filename, t('export.email.btn'), attachments)
      const photoNote =
        attachments.length > 0
          ? ` (${t('export.email.attachments', { n: attachments.length })})`
          : ''
      setStatus(
        usedOffline
          ? `${t('export.email.success')}${photoNote} (${t('export.offline.generated')})`
          : `${t('export.email.success')}${photoNote}`,
      )
    } catch (err: any) {
      console.error('Email send failed:', err)
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
              <h2 className="font-bold text-lg text-otis-800 dark:text-white">
                {t('export.title', { week: currentWeek.week })}
              </h2>
              <Badge variant={weekSummary.totalHours > 0 ? 'info' : 'warning'}>
                {weekSummary.totalHours.toFixed(1)}h
              </Badge>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-stone-300" />
              <p className="text-xs text-gray-500 dark:text-stone-400">
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
            <div
              className={cn(
                'w-2 h-2 rounded-full flex-shrink-0',
                status.startsWith(t('common.error')) ? 'bg-red-500' : 'bg-emerald-500',
              )}
            />
            <p className="text-sm font-medium">{status}</p>
          </div>
        </Card>
      )}

      {/* Receipt photos attached to this week's report */}
      <ReceiptPhotos photos={photos} />

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

      {/* Info tip */}
      <Card variant="outline">
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-otis-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 dark:text-stone-300 leading-relaxed">
            {t('export.info')}
          </p>
        </div>
      </Card>
    </div>
  )
}
