import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { KeyRound, Mail, LogIn, Building2, CheckCircle2 } from 'lucide-react'
import { useTranslation } from '@/lib/useTranslation'
import { supabase, resetPassword, updatePassword } from '@/db/supabase'
import { reportError } from '@/lib/sentry'

/**
 * Password reset, two modes on one page:
 *  1. Request — user enters their e-mail, we send the Supabase reset link.
 *  2. Set new password — reached via the e-mail link: supabase-js detects the
 *     recovery session from the URL fragment, so the user can type a new
 *     password. Once set, the session becomes a normal one and they can log in.
 *
 * NOTE: this route deliberately is NOT wrapped in PublicRoute — after clicking
 * the e-mail link a (recovery) session exists, and PublicRoute would redirect
 * to /dashboard before the new password could be entered.
 */
export function ResetPasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [hasRecovery, setHasRecovery] = useState(false)
  const [checking, setChecking] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // A recovery link carries #access_token=…&type=recovery — supabase-js
    // picks the session up from the fragment and emits PASSWORD_RECOVERY.
    const hash = window.location.hash
    const fromHash = hash.includes('type=recovery')
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setHasRecovery(true)
    })
    if (fromHash) setHasRecovery(true)
    setChecking(false)
    return () => data.subscription.unsubscribe()
  }, [])

  const handleRequest = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await resetPassword(email)
      setSent(true)
    } catch (err) {
      console.error('Password reset request failed:', err)
      reportError(err)
      setError(t('auth.reset.request.error'))
    } finally {
      setLoading(false)
    }
  }

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError(t('auth.password.short'))
      return
    }
    if (password !== passwordConfirm) {
      setError(t('auth.password.mismatch'))
      return
    }
    setLoading(true)
    try {
      await updatePassword(password)
      // The recovery hash is now consumed — drop it so a later refresh of the
      // page doesn't re-enter recovery mode.
      window.history.replaceState({}, '', window.location.pathname)
      setDone(true)
    } catch (err) {
      console.error('Password update failed:', err)
      reportError(err)
      setError(t('auth.reset.set.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh p-6 bg-auth-ambient dark:bg-auth-ambient-dark relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute -top-40 -right-40 w-80 h-80 orb orb-blue opacity-60 dark:opacity-40" />
      <div className="absolute -bottom-32 -left-32 w-64 h-64 orb orb-cyan opacity-40 dark:opacity-30" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] orb orb-purple opacity-20" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl mb-5 animate-float">
            <KeyRound className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {t(hasRecovery ? 'auth.reset.set.title' : 'auth.reset.title')}
          </h1>
          <p className="text-otis-200/80 mt-1.5 text-sm font-medium">
            {t(hasRecovery ? 'auth.reset.set.subtitle' : 'auth.reset.subtitle')}
          </p>
        </div>

        {checking ? null : done ? (
          <div className="glass-strong dark:glass-dark rounded-3xl p-7 shadow-2xl space-y-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-white font-semibold">{t('auth.reset.set.success')}</p>
            <p className="text-otis-200/80 text-sm">{t('auth.reset.set.success.desc')}</p>
            <Button
              onClick={() => navigate('/login')}
              fullWidth
              size="lg"
              variant="primary"
              glow
              className="mt-2"
            >
              <LogIn className="w-5 h-5" />
              {t('auth.switch.login')}
            </Button>
          </div>
        ) : hasRecovery ? (
          <div className="glass-strong dark:glass-dark rounded-3xl p-7 shadow-2xl space-y-5">
            <form onSubmit={handleSetPassword} className="space-y-4">
              <Input
                id="reset-password"
                label={t('auth.reset.new.password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <Input
                id="reset-password-confirm"
                label={t('auth.reset.confirm')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-otis-200/70 hover:text-white transition-colors"
              >
                {showPassword ? t('auth.reset.hide') : t('auth.reset.show')}
              </button>

              {error && (
                <div className="flex items-start gap-2 p-3.5 bg-red-500/10 backdrop-blur border border-red-400/30 rounded-2xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <p className="text-sm text-red-300 font-medium">{error}</p>
                </div>
              )}

              <Button type="submit" fullWidth disabled={loading} size="lg" variant="primary" glow>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('auth.reset.set.loading')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-5 h-5" />
                    {t('auth.reset.set.submit')}
                  </span>
                )}
              </Button>
            </form>
          </div>
        ) : sent ? (
          <div className="glass-strong dark:glass-dark rounded-3xl p-7 shadow-2xl space-y-4 text-center">
            <Mail className="w-12 h-12 text-otis-300 mx-auto" />
            <p className="text-white font-semibold">{t('auth.reset.sent')}</p>
            <p className="text-otis-200/80 text-sm">{t('auth.reset.sent.desc')}</p>
            <Button
              onClick={() => navigate('/login')}
              fullWidth
              size="lg"
              variant="primary"
              glow
              className="mt-2"
            >
              <LogIn className="w-5 h-5" />
              {t('auth.switch.login')}
            </Button>
          </div>
        ) : (
          <div className="glass-strong dark:glass-dark rounded-3xl p-7 shadow-2xl space-y-5">
            <form onSubmit={handleRequest} className="space-y-4">
              <Input
                id="reset-email"
                label={t('auth.email')}
                type="email"
                placeholder={t('auth.email.placeholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />

              {error && (
                <div className="flex items-start gap-2 p-3.5 bg-red-500/10 backdrop-blur border border-red-400/30 rounded-2xl">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                  <p className="text-sm text-red-300 font-medium">{error}</p>
                </div>
              )}

              <Button type="submit" fullWidth disabled={loading} size="lg" variant="primary" glow>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('auth.reset.loading')}
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    {t('auth.reset.send')}
                  </span>
                )}
              </Button>
            </form>

            <p className="text-center text-otis-200/70 text-sm">
              <Link
                to="/login"
                className="text-white font-semibold hover:text-otis-100 transition-colors underline underline-offset-2"
              >
                {t('auth.switch.login')}
              </Link>
            </p>
          </div>
        )}

        <div className="text-center mt-10">
          <div className="flex items-center justify-center gap-2 text-otis-200/40 text-xs">
            <Building2 className="w-3 h-3" />
            <span>{t('common.otis')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
