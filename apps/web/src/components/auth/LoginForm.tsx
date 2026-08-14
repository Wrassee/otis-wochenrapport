import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LogIn, Eye, EyeOff, Building2 } from 'lucide-react'
import { useTranslation } from '@/lib/useTranslation'

interface LoginFormProps {
  onLogin: (email: string, password: string) => Promise<void>
  onSwitchToRegister: () => void
  onForgotPassword: () => void
  error?: string | null
}

export function LoginForm({
  onLogin,
  onSwitchToRegister,
  onForgotPassword,
  error,
}: LoginFormProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onLogin(email, password)
    } catch {
      // Error handled by parent
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
        {/* Logo area */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl mb-6 animate-float">
            <div className="flex flex-col items-center">
              <span className="text-4xl font-black text-white tracking-tight">OTIS</span>
              <div className="w-8 h-0.5 bg-white/30 rounded-full mt-0.5" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">{t('app.name')}</h1>
          <p className="text-otis-200/80 mt-2 text-sm font-medium">{t('app.subtitle')}</p>
        </div>

        {/* Glass login card */}
        <div className="glass-strong dark:glass-dark rounded-3xl p-7 shadow-2xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="login-email"
              label={t('auth.email')}
              type="email"
              placeholder={t('auth.email.placeholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />

            <div className="relative">
              <Input
                id="login-password"
                label={t('auth.password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-[42px] text-gray-500 dark:text-stone-200 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3.5 bg-red-500/10 backdrop-blur border border-red-400/30 rounded-2xl">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <p className="text-sm text-red-300 font-medium">{error}</p>
              </div>
            )}

            <div className="text-right -mt-1">
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-xs text-otis-200/70 hover:text-white transition-colors underline underline-offset-2"
              >
                {t('auth.forgot.password')}
              </button>
            </div>

            <Button type="submit" fullWidth disabled={loading} size="lg" variant="primary" glow>
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('auth.login.loading')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <LogIn className="w-5 h-5" />
                  {t('auth.login.btn')}
                </span>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center mt-8 text-otis-200/70 text-sm">
          {t('auth.no.account')}{' '}
          <button
            onClick={onSwitchToRegister}
            className="text-white font-semibold hover:text-otis-100 transition-colors underline underline-offset-2"
          >
            {t('auth.switch.register')}
          </button>
        </p>

        {/* Footer */}
        <div className="text-center mt-12">
          <div className="flex items-center justify-center gap-2 text-otis-200/40 text-xs">
            <Building2 className="w-3 h-3" />
            <span>{t('common.otis')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
