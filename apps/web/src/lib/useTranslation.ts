/**
 * useTranslation hook — access translated strings from the app store.
 */
import { useCallback } from 'react'
import { useAppStore } from '@/stores/appStore'
import { translate } from './translations'

export function useTranslation() {
  const language = useAppStore((s) => s.language)

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      return translate(key, language, params)
    },
    [language]
  )

  return { t, language }
}
