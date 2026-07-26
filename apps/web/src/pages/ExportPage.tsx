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

  const triggerDownload = (blob: Blob, usedOffline: boolean) => {
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Wochenrapport_KW${currentWeek.week}_${currentWeek.year}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    setStatus(usedOffline
      ? `${t('export.success')} (${t('export.offline.generated')})`
      : t('export.success'),
    )

    // Share sheet
    if (typeof navigator.share !== 'undefined' && navigator.canShare({ files: [new File([blob], 'report.xlsx')] })) {
      navigator.share({
        title: `Wochenrapport KW${currentWeek.week}`,
        files: [new File([blob], `Wochenrapport_KW${currentWeek.week}.xlsx`)],
      }).catch(() => {})
    }
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

      triggerDownload(blob, usedOffline)
    } catch (err: any) {
      const msg = err?.message || t('export.failed')
      setStatus(`${t('common.error')}: ${msg}`)
    } finally {
      setExporting(false)
    }
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
      } catch {
        // Backend unreachable — generate offline + open mailto:
        const blob = await generateExcelOffline({
          year: currentWeek.year,
          week_number: currentWeek.week,
          personnel_number: state.profile?.personnel_number || '',
          full_name: state.profile?.full_name || '',
          entries: entriesData,
          expenses: allExpenses,
        })
        usedOffline = true

        // Download the generated file
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Wochenrapport_KW${currentWeek.week}_${currentWeek.year}.xlsx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)

        // Open mailto: link with pre-filled details
        const supervisorEmail = profile?.supervisor_email || ''
        const subject = encodeURIComponent(`Wochenrapport KW${currentWeek.week}/${currentWeek.year} - ${state.profile?.full_name || ''}`)
        const body = encodeURIComponent(
          `Hallo,\n\n` +
          `anbei der Wochenrapport für KW${currentWeek.week}/${currentWeek.year}.\n` +
          `Bitte die heruntergeladene Excel-Datei manuell anhängen.\n\n` +
          `Vielen Dank.\n` +
          `${state.profile?.full_name || ''}`
        )
        if (supervisorEmail) {
          window.open(`mailto:${supervisorEmail}?subject=${subject}&body=${body}`, '_blank')
        } else {
          window.open(`mailto:?subject=${subject}&body=${body}`, '_blank')
        }
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
