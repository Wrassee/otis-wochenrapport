import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoginForm } from '@/components/auth/LoginForm'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { signIn, signUp, upsertProfile } from '@/db/supabase'
import { useAppStore } from '@/stores/appStore'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from '@/lib/useTranslation'
import { PENDING_REGISTRATION_KEY } from '@/lib/constants'
import type { TranslationKey } from '@/lib/translations'

/**
 * Map raw Supabase auth errors to friendly, localized messages. Registration
 * throws raw English errors (rate limits, duplicate users, invalid e-mail, …)
 * that would otherwise confuse users — every known case gets a translated
 * equivalent, unknown ones fall back to a generic localized failure text.
 */
function friendlyAuthError(
  err: unknown,
  t: (key: TranslationKey) => string,
  fallback: TranslationKey = 'auth.register.failed',
): string {
  const msg = String((err as any)?.message || (err as any)?.error_description || '').toLowerCase()
  const status = Number((err as any)?.status)
  const code = String((err as any)?.code || '')

  // Supabase rate-limits signups/logins per address & IP ("For security
  // purposes, you can only request this after 25 seconds.").
  if (
    status === 429 ||
    code.includes('rate_limit') ||
    code === 'over_email_send_rate_limit' ||
    code === 'over_request_rate_limit' ||
    msg.includes('security purposes') ||
    msg.includes('25 seconds')
  ) {
    return t('auth.error.rate_limit')
  }
  if (
    code === 'user_already_exists' ||
    msg.includes('already registered') ||
    msg.includes('already been registered')
  ) {
    return t('auth.error.exists')
  }
  if (code === 'weak_password' || msg.includes('at least 6 characters')) {
    return t('auth.password.short')
  }
  if (
    code === 'invalid_email' ||
    msg.includes('unable to validate email') ||
    msg.includes('invalid email')
  ) {
    return t('auth.error.email.invalid')
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return t('auth.login.failed')
  }
  if (!navigator.onLine) return t('auth.error.network')
  return t(fallback)
}

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)
  const [registered, setRegistered] = useState(false)
  const [_loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { setUser, setProfile, initialize, language } = useAppStore(
    useShallow((s) => ({
      setUser: s.setUser,
      setProfile: s.setProfile,
      initialize: s.initialize,
      language: s.language,
    })),
  )

  const handleLogin = async (email: string, password: string) => {
    setError(null)
    setLoading(true)
    try {
      const data = await signIn(email, password)
      if (data.user) {
        setUser({ id: data.user.id, email: data.user.email || '' })
        await initialize(data.user.id)
        // Guard: as soon as the session arrives, PublicRoute already redirects
        // /login → /dashboard. A slow initialize() (its Supabase calls carry
        // 8s timeouts) may finish SECONDS later — navigating then would yank
        // the user out of whatever screen they moved to (e.g. the wizard).
        if (window.location.pathname.startsWith('/login')) {
          navigate('/dashboard')
        }
      }
    } catch (err: any) {
      // Surface the REAL error to the console — the friendly message below
      // maps many different failures to the same text, so without this the
      // actual cause (e.g. an initialize() step, a schema issue, rate limit)
      // is invisible.
      console.error('Login failed — raw error:', err)
      setError(friendlyAuthError(err, t, 'auth.login.failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (
    email: string,
    password: string,
    fullName: string,
    personnelNumber: string,
  ) => {
    setError(null)
    setRegistered(false)
    setLoading(true)
    try {
      const data = await signUp(email, password)
      const user = data.user

      // E-mail confirmation enabled → Supabase returns the user WITHOUT a
      // session, so the account is not usable yet. Keep the entered profile
      // data on this device (the profiles row can only be written to the
      // cloud once a real session exists) and tell the user to confirm their
      // inbox — instead of pretending they are logged in.
      if (!data.session) {
        if (user) {
          localStorage.setItem(
            PENDING_REGISTRATION_KEY,
            JSON.stringify({ email, fullName, personnelNumber }),
          )
        }
        setRegistered(true)
        return
      }

      if (user) {
        // E-mail confirmation OFF → the account is immediately usable.
        // The profile row is best-effort: a cloud schema hiccup (e.g. a
        // missing column) must never block the account from being usable —
        // the user can still proceed and the background sync re-sends the
        // profile later.
        try {
          await upsertProfile({
            id: user.id,
            email: user.email || email,
            full_name: fullName,
            personnel_number: personnelNumber,
            supervisor_email: '',
            language,
          })
        } catch (err) {
          console.warn('Failed to sync new profile to Supabase:', err)
        }
        setUser({ id: user.id, email: user.email || '' })
        setProfile({
          id: user.id,
          email: user.email || email,
          full_name: fullName,
          personnel_number: personnelNumber,
          supervisor_email: '',
          language,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        await initialize(user.id)
        // Same guard as handleLogin: only navigate when still on the auth
        // screen, so a slow initialize cannot redirect away from a page the
        // user already reached.
        if (window.location.pathname.startsWith('/login')) {
          navigate('/settings')
        }
      }
    } catch (err: any) {
      console.error('Register failed — raw error:', err)
      setError(friendlyAuthError(err, t))
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'login') {
    return (
      <LoginForm
        onLogin={handleLogin}
        onSwitchToRegister={() => {
          setError(null)
          setRegistered(false)
          setMode('register')
        }}
        onForgotPassword={() => navigate('/reset-password')}
        error={error}
      />
    )
  }

  return (
    <RegisterForm
      onRegister={handleRegister}
      onSwitchToLogin={() => {
        setError(null)
        setRegistered(false)
        setMode('login')
      }}
      error={error}
      registered={registered}
    />
  )
}
