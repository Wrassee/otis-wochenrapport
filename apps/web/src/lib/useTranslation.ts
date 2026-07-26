/**
 * useTranslation hook — access translated strings from the app store.
 */
import { useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import type { Language } from './translations'
import { translations } from './translations'

export function useTranslation() {
  const language = useAppStore((s) => s.language)

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const entry = translations[key]
      if (!entry) return key

      let text = entry[language] ?? entry.de ?? key

      if (params) {
        for (const [k, v] of Object.entries(params)) {
          text = text.replace(`{${k}}`, String(v))
        }
      }

      return text
    },
    [language]
  )

  return { t, language }
}
