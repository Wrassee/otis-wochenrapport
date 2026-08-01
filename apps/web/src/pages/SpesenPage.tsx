import { useRef, useState } from 'react'
import { useTranslation } from '@/lib/useTranslation'
import { Card, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'
import { useAppStore } from '@/stores/appStore'
import { useDailyExpenses } from '@/hooks/useDailyExpenses'
import { useExpensePhotos } from '@/hooks/useExpensePhotos'
import { getWeekDates } from '@/lib/utils'
import { Clock, Bed, Car, RadioTower, Coins, Wrench, CarFront, Euro, Check, X, Camera, Trash2, ImagePlus, StickyNote } from 'lucide-react'

const EXPENSE_ITEMS = [
  { type: 'entschaedigung_10h' as const, labelKey: 'spesen.10h', icon: Clock },
  { type: 'hotel' as const, labelKey: 'spesen.hotel', icon: Bed },
  { type: 'transport' as const, labelKey: 'spesen.transport', icon: Car },
  { type: 'pikettdienst' as const, labelKey: 'spesen.pikett', icon: RadioTower },
  { type: 'entschaedigung_pikett' as const, labelKey: 'spesen.pikett.ent', icon: Coins },
  { type: 'material' as const, labelKey: 'spesen.material', icon: Wrench, hasValue: true, valueUnit: 'CHF' },
  { type: 'privatfahrzeug' as const, labelKey: 'spesen.privat', icon: CarFront, hasValue: true, valueUnit: 'km' },
]

export function SpesenPage() {
  const { t } = useTranslation()

  // Single week source of truth — same currentWeek the Woche/Export pages use,
  // so the Spesen tab always shows the same week's expenses and Belege photos.
  const { currentWeek } = useAppStore()
  const dates = getWeekDates(currentWeek.year, currentWeek.week)
  const dayNames = t('week.days').split(' | ')

  const { dailyExpenses, toggleExpense, setExpenseValue, syncExpenses } = useDailyExpenses(dates)

  const { photos, addPhoto, removePhoto, updatePhotoNote } = useExpensePhotos(currentWeek.year, currentWeek.week)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState('')

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    setPhotoError(null)
    try {
      await addPhoto(file)
    } catch (err) {
      console.warn('Failed to add receipt photo:', err)
      setPhotoError(t('spesen.photos.error'))
    } finally {
      setPhotoBusy(false)
    }
  }

  const totalActive = Object.values(dailyExpenses).reduce((sum, exps) => sum + exps.length, 0)

  const startNoteEdit = (photoId: string, currentNote?: string) => {
    setNoteDraft(currentNote || '')
    setNoteEditingId(photoId)
  }

  const saveNote = async () => {
    if (!noteEditingId) return
    await updatePhotoNote(noteEditingId, noteDraft)
    setNoteEditingId(null)
    setNoteDraft('')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <Euro className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-otis-800 dark:text-white">{t('day.spesen')}</h2>
          <p className="text-xs text-gray-400">
            {t('week.title', { number: currentWeek.week })} — {t('day.spesen.count', { n: totalActive })}
          </p>
        </div>
        <Badge variant="info" size="sm">{totalActive}</Badge>
      </div>

      {/* Info banner */}
      <div className="p-3.5 bg-amber-50/80 dark:bg-amber-900/20 backdrop-blur rounded-2xl border border-amber-200/40 dark:border-amber-700/30">
        <p className="text-xs text-amber-600 dark:text-amber-300 font-medium">
          {t('day.spesen.editor.hint')}
        </p>
      </div>

      {/* Receipt photos — photographed invoices attached to the weekly report */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <Camera className="w-4 h-4 text-white" />
            </div>
            <div>
              <CardTitle>{t('spesen.photos.title')}</CardTitle>
              <p className="text-[10px] text-gray-400">{t('spesen.photos.subtitle')}</p>
            </div>
          </div>
          <Badge variant={photos.length > 0 ? 'info' : 'default'} size="sm">
            {photos.length}
          </Badge>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoChange}
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={photoBusy}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl border-2 border-dashed border-rose-300/50 dark:border-rose-700/30 text-rose-600 dark:text-rose-300 font-semibold text-sm transition-all hover:border-rose-400/70 hover:bg-rose-50/50 dark:hover:bg-rose-900/10 active:scale-[0.98] disabled:opacity-50"
        >
          {photoBusy ? (
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <ImagePlus className="w-5 h-5" />
          )}
          {photoBusy ? t('spesen.photos.processing') : t('spesen.photos.add')}
        </button>

        {photoError && (
          <p className="text-[11px] text-red-500 mt-2 text-center">{photoError}</p>
        )}

        {photos.length > 0 ? (
          <>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative rounded-xl overflow-hidden border border-otis-200/20 dark:border-white/10 aspect-square bg-otis-100/30 dark:bg-otis-900/30"
                >
                  <img
                    src={photo.dataUrl}
                    alt={photo.filename}
                    className="w-full h-full object-cover"
                  />
                  {/* Note badge overlay — shows the note is set */}
                  {photo.note && (
                    <div className="absolute bottom-0 inset-x-0 px-1.5 py-0.5 bg-black/55 text-white text-[8px] leading-tight truncate">
                      {photo.note}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => startNoteEdit(photo.id, photo.note)}
                    className="absolute bottom-1 right-1 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center shadow-md backdrop-blur-sm transition-colors active:scale-90 hover:bg-black/75"
                    title={t('spesen.photos.note')}
                  >
                    <StickyNote className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-1 right-1 w-7 h-7 rounded-full bg-black/55 text-white flex items-center justify-center shadow-md backdrop-blur-sm transition-colors active:scale-90 hover:bg-black/75"
                    title={t('spesen.photos.delete')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Inline note editor */}
            {noteEditingId && (
              <div className="mt-3 p-3 rounded-2xl bg-otis-50/70 dark:bg-otis-900/30 border border-otis-200/30 dark:border-white/10">
                <p className="text-[11px] font-semibold text-otis-700 dark:text-otis-300 mb-1.5">
                  {t('spesen.photos.note')}
                </p>
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder={t('spesen.photos.note.placeholder')}
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-xl glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none resize-none"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={saveNote}
                    className="flex-1 h-11 rounded-xl bg-otis-600 text-white text-sm font-semibold transition-all active:scale-[0.98] hover:bg-otis-700"
                  >
                    {t('spesen.photos.note.save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNoteEditingId(null); setNoteDraft('') }}
                    className="h-11 px-4 rounded-xl bg-white/60 dark:bg-white/10 text-gray-500 dark:text-gray-300 text-sm font-medium transition-all active:scale-[0.98]"
                  >
                    {t('spesen.photos.note.cancel')}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-[11px] text-gray-400 text-center mt-3">
            {t('spesen.photos.none')}
          </p>
        )}
      </Card>

      {/* Per-day expense cards */}
      {dates.map((date, idx) => {
        const dayExp = dailyExpenses[date] || []
        const dayName = dayNames[idx]

        return (
          <Card key={date}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold',
                  dayExp.length > 0
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                    : 'bg-otis-100/50 dark:bg-otis-800/30 text-gray-400 dark:text-gray-500'
                )}>
                  {dayName}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-otis-800 dark:text-white">{dayName}</span>
                    <span className="text-[10px] text-gray-400 font-mono">{date.slice(5)}</span>
                  </div>
                  {dayExp.length > 0 && (
                    <p className="text-[10px] text-amber-500 font-medium">
                      {t('day.spesen.count', { n: dayExp.length })}
                    </p>
                  )}
                </div>
              </div>
              {dayExp.length > 0 && (
                <Badge variant="info" size="sm">
                  <Check className="w-3 h-3 mr-0.5" />
                  {t('spesen.active')}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {EXPENSE_ITEMS.map((item) => {
                const exp = dayExp.find((e) => e.expense_type === item.type)
                const isActive = !!exp

                const handleToggle = () => {
                  toggleExpense(date, item.type)
                  syncExpenses()
                }

                const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                  const val = item.valueUnit === 'CHF'
                    ? parseFloat(e.target.value) || 0
                    : parseInt(e.target.value) || 0
                  setExpenseValue(date, item.type, Math.max(0, val))
                  syncExpenses()
                }

                return (
                  <div key={item.type} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggle}
                      className={cn(
                        'flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-sm font-medium transition-all duration-150 border min-h-[48px]',
                        'flex-1 text-left',
                        isActive
                          ? 'bg-otis-50 dark:bg-otis-900/30 border-otis-300/60 dark:border-otis-600/40 text-otis-700 dark:text-otis-300 shadow-sm'
                          : 'bg-white/50 dark:bg-white/5 border-gray-200/50 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-otis-200/50 hover:text-otis-600'
                      )}
                    >
                      <item.icon className="w-5 h-5 shrink-0" />
                      <span className="flex-1">{t(item.labelKey as any)}</span>
                      {isActive ? (
                        <Check className="w-4 h-4 text-otis-500" />
                      ) : (
                        <X className="w-4 h-4 text-gray-200 dark:text-gray-700" />
                      )}
                    </button>

                    {/* Value input for Material / Privatfahrzeug */}
                    {isActive && item.hasValue && (
                      <div className="w-24 flex-shrink-0">
                        <input
                          type="number"
                          min="0"
                          step={item.valueUnit === 'CHF' ? '0.50' : '1'}
                          value={exp?.value ?? (item.valueUnit === 'km' ? 10 : 0)}
                          onChange={handleValueChange}
                          className="w-full h-[48px] px-3 rounded-xl text-sm glass-input dark:glass-input-dark text-otis-900 dark:text-white focus:outline-none text-center font-mono"
                          placeholder={item.valueUnit === 'CHF' ? '0.00' : '0'}
                        />
                        <p className="text-[9px] text-gray-400 text-center mt-0.5">{item.valueUnit}</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {dayExp.length === 0 && (
              <p className="text-[11px] text-gray-400 text-center mt-3">
                {t('day.spesen.none')}
              </p>
            )}
          </Card>
        )
      })}
    </div>
  )
}
