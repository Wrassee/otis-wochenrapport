import { Card, CardTitle } from '@/components/ui/Card'
import { useAppStore } from '@/stores/appStore'
import { LANGUAGES } from '@/lib/translations'
import { useTranslation } from '@/lib/useTranslation'
import { cn } from '@/lib/cn'
import { Languages } from 'lucide-react'
import { Flag } from '@/components/ui/Flag'

export function LanguageSwitcher() {
  const { t } = useTranslation()
  const language = useAppStore((s) => s.language)
  const setLanguage = useAppStore((s) => s.setLanguage)

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
          <Languages className="w-4 h-4 text-white" />
        </div>
        <div>
          <CardTitle>{t('language.title')}</CardTitle>
          <p className="text-[10px] text-gray-500 dark:text-stone-200">{t('language.subtitle')}</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 min-w-0 px-1 py-2.5 rounded-2xl border font-semibold transition-all duration-200 active:scale-95 overflow-hidden',
              language === lang.code
                ? 'bg-otis-50 dark:bg-otis-900/30 border-otis-300/60 dark:border-otis-600/40 text-otis-700 dark:text-otis-300 shadow-sm'
                : 'bg-white/50 dark:bg-white/5 border-gray-200/50 dark:border-white/10 text-gray-600 dark:text-stone-200 hover:border-otis-200/50 hover:text-otis-600',
            )}
          >
            <Flag code={lang.code} />
            <span className="text-[10px] truncate max-w-full">{lang.nativeLabel}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}
