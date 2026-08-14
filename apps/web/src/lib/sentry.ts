import * as Sentry from '@sentry/react'

/**
 * Sentry error monitoring — OPTIONAL.
 *
 * Only initializes when VITE_SENTRY_DSN is set (Vercel dashboard / CI), so a
 * missing DSN is a clean no-op: local dev and deployments without a Sentry
 * account keep working untouched, and the bundle cost stays near zero.
 *
 * Import this module as a side effect BEFORE the app renders (main.tsx) so
 * early errors (e.g. in App init) are also captured.
 */
const dsn = (import.meta.env.VITE_SENTRY_DSN as string | undefined) || undefined

export const isSentryEnabled = Boolean(dsn)

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.PROD ? 'production' : 'development',
    // Low tracing sample rate — this is a small app; we mainly want crashes
    // and exceptions, not full performance tracing.
    tracesSampleRate: 0.1,
    // The Vite Sentry plugin tags the release automatically from the git
    // commit when source maps are uploaded; fall back to nothing otherwise.
    release: (import.meta.env.VITE_SENTRY_RELEASE as string | undefined) || undefined,
  })
}

/**
 * Report a caught error to Sentry (ErrorBoundary, promise rejections, …).
 * No-op when Sentry is not configured.
 */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!dsn) return
  Sentry.captureException(error, context ? { extra: context } : undefined)
}
