import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TriangleAlert, RotateCcw, RefreshCw } from 'lucide-react'
import { useAppStore } from '@/stores/appStore'
import { translate } from '@/lib/translations'
import { reportError } from '@/lib/sentry'

import type { TranslationKey } from '@/lib/translations'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Catches render/lifecycle errors anywhere below it in the tree and shows a
 * readable fallback instead of a blank white screen. Without it, one component
 * throwing (e.g. a Zustand infinite render loop) unmounts the whole React tree
 * → white screen with no hint of what happened.
 *
 * Recovery:
 *  - "Erneut versuchen" → clears the boundary state and re-renders the
 *    subtree WITHOUT a full reload (recovers transient errors instantly).
 *  - "Neu laden"        → full page reload (recovers persistent issues).
 *  - Collapsible details → the error message + stack trace, so the error can
 *    be reported / pasted into a ticket (the user has been doing exactly this
 *    with the console output).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the error visible in devtools for diagnosis.
    console.error('[ErrorBoundary] caught error:', error, info.componentStack)
    // Report to Sentry (no-op without a DSN) — the component stack is the
    // most useful part for locating the failing component.
    reportError(error, { componentStack: info.componentStack })
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    // Read the current language imperatively — class components can't use hooks.
    const lang = useAppStore.getState().language
    const t = (key: TranslationKey): string => translate(key, lang)

    const { error } = this.state
    const message = error?.message || String(error)

    return (
      <div className="min-h-dvh flex items-center justify-center bg-auth-ambient dark:bg-auth-ambient-dark relative overflow-hidden px-4">
        <div className="absolute -top-40 -right-40 w-96 h-96 orb orb-blue opacity-60" />
        <div className="absolute -bottom-32 -left-32 w-72 h-72 orb orb-cyan opacity-40" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] orb orb-purple opacity-20" />

        <div className="relative z-10 w-full max-w-md glass-card dark:glass-card-dark rounded-3xl p-6 shadow-2xl border border-otis-100/50 dark:border-otis-700/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <TriangleAlert className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-otis-800 dark:text-white leading-tight">
                {t('error.title')}
              </h1>
              <p className="text-xs text-gray-600 dark:text-otis-300">{t('error.subtitle')}</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-otis-200 mb-6">{t('error.message')}</p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={this.handleRetry}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-br from-otis-600 to-otis-800 text-white text-sm font-semibold shadow-lg shadow-otis-600/20 active:scale-[0.98] transition-transform"
            >
              <RotateCcw className="w-4 h-4" />
              {t('error.retry')}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl glass dark:glass-dark text-otis-700 dark:text-otis-200 text-sm font-semibold active:scale-[0.98] transition-transform"
            >
              <RefreshCw className="w-4 h-4" />
              {t('error.reload')}
            </button>
          </div>

          <details className="mt-5">
            <summary className="text-xs font-semibold text-otis-500 dark:text-otis-300 cursor-pointer select-none">
              {t('error.details')}
            </summary>
            <pre className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-otis-900/60 text-[11px] leading-relaxed text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
              {message}
              {'\n\n'}
              {error?.stack}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
