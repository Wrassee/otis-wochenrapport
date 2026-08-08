import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { UserPlus, Eye, EyeOff, Building2, MailCheck } from 'lucide-react'
import { useTranslation } from '@/lib/useTranslation'

interface RegisterFormProps {
  onRegister: (
    email: string,
    password: string,
    fullName: string,
    personnelNumber: string,
  ) => Promise<void>
  onSwitchToLogin: () => void
  error?: string | null
  /** True after a successful sign-up that requires e-mail confirmation. */
  registered?: boolean
}

export function RegisterForm({
  onRegister,
  onSwitchToLogin,
  error,
  registered = false,
}: RegisterFormProps) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [personnelNumber, setPersonnelNumber] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (password !== confirmPassword) {
      setValidationError(t('auth.password.mismatch'))
      return
    }
    if (password.length < 6) {
      setValidationError(t('auth.password.short'))
      return
    }
    if (!fullName.trim()) {
      setValidationError(t('auth.name.required'))
      return
    }
    if (!personnelNumber.trim()) {
      setValidationError(t('auth.personnel.required'))
      return
    }

    setLoading(true)
    try {
      await onRegister(email, password, fullName, personnelNumber)
    } catch {
      // Error handled by parent
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-dvh p-6 bg-auth-ambient dark:bg-auth-ambient-dark relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute -top-32 -right-32 w-72 h-72 orb orb-blue opacity-50 dark:opacity-35" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 orb orb-cyan opacity-35 dark:opacity-25" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl mb-5">
            <span className="text-3xl font-black text-white">OTIS</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{t('auth.register.title')}</h1>
          <p className="text-otis-200/70 mt-1 text-sm">{t('auth.register.subtitle')}</p>
        </div>

        {registered ? (
          /* E-mail confirmation pending — tell the user what to do next
             instead of leaving them with a silent form or an error. */
          <div className="glass-strong dark:glass-dark rounded-3xl p-7 shadow-2xl space-y-5 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-400/30 mx-auto">
              <MailCheck className="w-8 h-8 text-emerald-300" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">
                {t('auth.register.confirm.title')}
              </h2>
              <p className="text-otis-200/80 text-sm leading-relaxed">
                {t('auth.register.confirm.body', { email })}
              </p>
              <p className="text-otis-200/60 text-xs leading-relaxed">
                {t('auth.register.confirm.hint')}
              </p>
            </div>
            <Button type="button" fullWidth size="lg" variant="primary" onClick={onSwitchToLogin}>
              {t('auth.switch.login')}
            </Button>
          </div>
        ) : (
          <div className="glass-strong dark:glass-dark rounded-3xl p-7 shadow-2xl space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="reg-name"
              label={t('profile.name')}
              type="text"
              placeholder={t('profile.name.placeholder')}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              id="reg-personnel"
              label={t('profile.personnel')}
              type="text"
              placeholder={t('profile.personnel.placeholder')}
              value={personnelNumber}
              onChange={(e) => setPersonnelNumber(e.target.value)}
              required
            />

            <Input
              id="reg-email"
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
                id="reg-password"
                label={t('auth.password')}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
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

            <Input
              id="reg-confirm"
              label={t('auth.password.confirm')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            {(validationError || error) && (
              <div className="flex items-start gap-2 p-3.5 bg-red-500/10 backdrop-blur border border-red-400/30 rounded-2xl">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                <p className="text-sm text-red-300 font-medium">{validationError || error}</p>
              </div>
            )}

            <Button type="submit" fullWidth disabled={loading} size="lg" variant="primary">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t('auth.register.loading')}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  {t('auth.register.btn')}
                </span>
              )}
            </Button>
          </form>
          </div>
        )}

        <p className="text-center mt-6 text-otis-200/70 text-sm">
          {t('auth.has.account')}{' '}
          <button
            onClick={onSwitchToLogin}
            className="text-white font-semibold hover:text-otis-100 transition-colors underline underline-offset-2"
          >
            {t('auth.switch.login')}
          </button>
        </p>

        <div className="text-center mt-8">
          <div className="flex items-center justify-center gap-2 text-otis-200/40 text-xs">
            <Building2 className="w-3 h-3" />
            <span>{t('common.otis')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
