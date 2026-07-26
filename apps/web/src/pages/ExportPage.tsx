import { useState, useEffect, useCallback } from 'react'
import { ExportSummary } from '@/components/export/ExportSummary'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAppStore } from '@/stores/appStore'
import { useTranslation } from '@/lib/useTranslation'
import { getWeekDates, formatDateShort } from '@/lib/utils'
import { cn } from '@/lib/cn'
import { Calendar, FileSpreadsheet, Info, Zap, Loader2, CheckCircle2 } from 'lucide-react'

export function ExportPage() {
  const { t } = useTranslation()
  const { currentWeek, weekSummary, loadWeekEntries, calculateWeekSummary, profile, timeEntries, dailyExpenses } = useAppStore()
  const [exporting, setExporting] = useState(false)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [warming, setWarming] = useState(false)
  const [isWarm, setIsWarm] = useState(false)

  const handleWarmup = useCallback(async () => {
    if (warming || isWarm) return
    setWarming(true)
    const renderUrl = import.meta.env.VITE_RENDER_URL || 'http://localhost:8000'
    try {
      // Longer timeout for cold start (up to 30s)
      const hc = await fetch(`${renderUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(30000),
      })
      if (hc.ok) {
        setIsWarm(true)
      }
    } catch {
      // Silent — user will see full error on export
    } finally {
      setWarming(false)
    }
  }, [warming, isWarm])

  useEffect(() => {
    loadWeekEntries()
  }, [currentWeek, loadWeekEntries])

  useEffect(() => {
    calculateWeekSummary()
  }, [timeEntries, calculateWeekSummary])

  // Auto-warmup: fire when the user navigates to the Export page
  useEffect(() => {
    handleWarmup()
  }, [handleWarmup])

  const handleExport = async () => {
    setExporting(true)
    setStatus(null)
    try {
      const state = useAppStore.getState()
      const entriesData = timeEntries.map((e) => ({
        date: e.date,
        start_time: e.start_time,
        duration: e.duration,
        anlagenummer: e.location_anlagenummer || '',
        project_id: e.location_project_id || '',
        address: e.location_address || '',
        activity_code: e.activity_code || '',
        is_lunch: e.is_lunch,
        zone: e.location_zone || 0,
      }))

      const renderUrl = import.meta.env.VITE_RENDER_URL || 'http://localhost:8000'

      // Health check before full request
      try {
        const hc = await fetch(`${renderUrl}/health`, { method: 'GET', signal: AbortSignal.timeout(3000) })
        if (!hc.ok) throw new Error(t('common.backend.unreachable', { url: renderUrl }))
      } catch {
        throw new Error(
          `${t('export.backend.error')} (${renderUrl}). ${t('export.backend.hint')}`
        )
      }

      // Collect all expenses for the week
      const allExpenses: Array<{date: string; expense_type: string; value: number}> = []
      const weekDates = getWeekDates(currentWeek.year, currentWeek.week)
      for (const d of weekDates) {
        const dayExp = dailyExpenses[d]
        if (dayExp && dayExp.length > 0) {
          allExpenses.push(...dayExp)
        }
      }

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
        throw new Error(`${t('export.failed')}${detail ? ': ' + detail.slice(0, 200) : ''}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Wochenrapport_KW${currentWeek.week}_${currentWeek.year}.xlsx`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)

      setStatus(t('export.success'))

      if (typeof navigator.share !== 'undefined' && navigator.canShare({ files: [new File([blob], 'report.xlsx')] })) {
        try {
          await navigator.share({
            title: `Wochenrapport KW${currentWeek.week}`,
            files: [new File([blob], `Wochenrapport_KW${currentWeek.week}.xlsx`)],
          })
        } catch {
          // User cancelled share
        }
      }
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError' || err?.name === 'TimeoutError'
      const msg = isTimeout
        ? t('export.timeout')
        : (err?.message || t('export.failed'))
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
      const entriesData = timeEntries.map((e) => ({
        date: e.date,
        start_time: e.start_time,
        duration: e.duration,
        anlagenummer: e.location_anlagenummer || '',
        project_id: e.location_project_id || '',
        address: e.location_address || '',
        activity_code: e.activity_code || '',
        is_lunch: e.is_lunch,
        zone: e.location_zone || 0,
      }))

      const renderUrl = import.meta.env.VITE_RENDER_URL || 'http://localhost:8000'
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
      })

      if (!response.ok) throw new Error(t('export.email.failed'))

      setStatus(t('export.email.success'))
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

      {/* Backend warm-up card */}
      <Card variant={isWarm ? 'success' : 'outline'}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-500',
            isWarm
              ? 'bg-emerald-500/10'
              : warming
                ? 'bg-amber-500/10 animate-pulse'
                : 'bg-otis-50 dark:bg-white/5'
          )}>
            {isWarm ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            ) : warming ? (
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            ) : (
              <Zap className="w-5 h-5 text-otis-400 dark:text-otis-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={cn(
              'text-sm font-semibold',
              isWarm ? 'text-emerald-600 dark:text-emerald-400' : 'text-otis-700 dark:text-gray-300'
            )}>
              {isWarm ? t('common.backend.warm') : warming ? t('common.backend.warming') : t('common.backend.warmup')}
            </p>
            <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
              {t('common.backend.warmup.desc')}
            </p>
          </div>
          {!isWarm && !warming && (
            <Button
              onClick={handleWarmup}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              <Zap className="w-4 h-4" />
              {t('common.backend.warmup')}
            </Button>
          )}
        </div>
      </Card>

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
