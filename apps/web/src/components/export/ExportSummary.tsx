import { useState } from 'react'
import type { WeekSummary } from '@/lib/types'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  FileSpreadsheet,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  MapPin,
  UtensilsCrossed,
  Eye,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from 'lucide-react'
import { formatDateShort } from '@/lib/utils'
import { cn } from '@/lib/cn'
import { useTranslation } from '@/lib/useTranslation'

interface ExportSummaryProps {
  weekSummary: WeekSummary
  onExport: () => Promise<void>
  onSendEmail: () => Promise<void>
  exporting: boolean
  sending: boolean
}

export function ExportSummary({
  weekSummary,
  onExport,
  onSendEmail,
  exporting,
  sending,
}: ExportSummaryProps) {
  const { t } = useTranslation()
  const [showPreview, setShowPreview] = useState(false)
  const validDays = weekSummary.days.filter((d) => d.isValid).length
  const allValid = validDays === 5

  return (
    <div className="space-y-4">
      {/* Preview toggle */}
      <button
        onClick={() => setShowPreview(!showPreview)}
        className="w-full flex items-center justify-center gap-2 h-14 rounded-2xl glass dark:glass-dark font-semibold text-otis-600 dark:text-otis-300 hover:border-otis-300/40 transition-all border border-otis-200/20 dark:border-white/5 active:scale-[0.98]"
      >
        <Eye className="w-5 h-5" />
        {showPreview ? t('export.preview.hide') : t('export.preview.show')}
        {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {/* Preview */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-otis-500" />
              {t('export.preview.title', { week: weekSummary.weekNumber })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {weekSummary.days.map((day) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between p-3 rounded-xl bg-otis-50/50 dark:bg-white/3 border border-otis-200/20 dark:border-white/5"
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        'w-2 h-2 rounded-full',
                        day.isValid ? 'bg-emerald-500' : 'bg-amber-500',
                      )}
                    />
                    <span className="font-semibold text-sm text-otis-800 dark:text-white min-w-[80px]">
                      {day.dayName}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock className="w-3 h-3 text-gray-400 dark:text-stone-300" />
                      <span className="text-gray-500 dark:text-stone-400 font-medium">
                        {day.totalHours.toFixed(1)}h
                      </span>
                    </div>
                    {day.hasLunch && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-stone-300">
                        <UtensilsCrossed className="w-3 h-3" />
                        <span>{Math.round(day.lunchMinutes)}'</span>
                      </div>
                    )}
                    {day.maxZone > 0 && (
                      <Badge variant="zone" size="sm">
                        Z{day.maxZone}
                      </Badge>
                    )}
                  </div>
                  {day.isValid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                </div>
              ))}
            </div>

            {/* Zone summary */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/10 border border-purple-200/40 dark:border-purple-700/30">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="font-semibold text-sm text-purple-700 dark:text-purple-300">
                  {t('export.zones')}
                </span>
              </div>
              <div className="space-y-1.5 text-sm">
                {weekSummary.days
                  .filter((d) => d.maxZone > 0)
                  .map((day) => (
                    <div key={day.date} className="flex justify-between items-center">
                      <span className="text-purple-600 dark:text-purple-400">
                        {day.dayName} ({formatDateShort(day.date)})
                      </span>
                      <Badge variant="zone" size="sm">
                        {t('day.zone', { n: day.maxZone })}
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>

            {/* Daily hours summary */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-otis-50 to-otis-100/50 dark:from-otis-900/20 dark:to-otis-800/10 border border-otis-200/40 dark:border-otis-700/30">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-otis-500/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-otis-600 dark:text-otis-400" />
                </div>
                <span className="font-semibold text-sm text-otis-700 dark:text-otis-300">
                  {t('export.total', { hours: weekSummary.totalHours.toFixed(1) })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export button */}
      <Card variant={allValid ? 'default' : 'warning'}>
        <CardContent className="space-y-3">
          {!allValid && (
            <div className="flex items-start gap-2.5 p-3.5 bg-amber-500/10 backdrop-blur rounded-2xl border border-amber-400/20">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-sm font-medium text-amber-600 dark:text-amber-300">
                  {t('export.incomplete.title')}
                </span>
                <p className="text-xs text-amber-500/80 mt-0.5">{t('export.incomplete.hint')}</p>
              </div>
            </div>
          )}

          <Button
            onClick={onExport}
            fullWidth
            variant="primary"
            size="xl"
            disabled={exporting}
            glow
          >
            {exporting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('export.excel.loading')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Download className="w-6 h-6" />
                {t('export.excel.btn')}
              </span>
            )}
          </Button>

          <Button
            onClick={onSendEmail}
            fullWidth
            variant="success"
            size="lg"
            disabled={sending || !weekSummary.days.some((d) => d.totalHours > 0)}
          >
            {sending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                {t('export.email.loading')}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Send className="w-5 h-5" />
                {t('export.email.btn')}
              </span>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
