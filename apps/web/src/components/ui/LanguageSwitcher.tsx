import { Card, CardTitle } from '@/components/ui/Card'
import { useAppStore } from '@/stores/appStore'
import type { Language } from '@/lib/translations'
import { LANGUAGES } from '@/lib/translations'
import { cn } from '@/lib/cn'
import { Languages } from 'lucide-react'

export function LanguageSwitcher() {
  const language = useAppStore((s) => s.language)
  const setLanguage = useAppStore((s) => s.setLanguage)

  return (
    <Card>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
          <Languages className="w-4 h-4 text-white" />
        </div>
        <div>
          <CardTitle>Sprache</CardTitle>
          <p className="text-[10px] text-gray-400">App-Sprache ändern</p>
        </div>
      </div>

      <div className="flex gap-2">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1.5 px-3 py-3 rounded-2xl border text-sm font-semibold transition-all duration-200 active:scale-95',
              language === lang.code
                ? 'bg-otis-50 dark:bg-otis-900/30 border-otis-300/60 dark:border-otis-600/40 text-otis-700 dark:text-otis-300 shadow-sm'
                : 'bg-white/50 dark:bg-white/5 border-gray-200/50 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:border-otis-200/50 hover:text-otis-600'
            )}
          >
            <span className="text-lg leading-none">{lang.code === 'de' ? '🇩🇪' : lang.code === 'fr' ? '🇫🇷' : '🇮🇹'}</span>
            <span className="text-xs">{lang.nativeLabel}</span>
          </button>
        ))}
      </div>
    </Card>
  )
}
