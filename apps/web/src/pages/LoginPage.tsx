import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LoginForm } from '@/components/auth/LoginForm'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { signIn, signUp, upsertProfile, getCurrentSession } from '@/db/supabase'
import { useAppStore } from '@/stores/appStore'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from '@/lib/useTranslation'

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
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
        navigate('/dashboard')
      }
    } catch (err: any) {
      setError(err.message || t('auth.login.failed'))
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
    setLoading(true)
    try {
      const data = await signUp(email, password)
      if (data.user) {
        // Create profile with language preference
        await upsertProfile({
          id: data.user.id,
          email: data.user.email || email,
          full_name: fullName,
          personnel_number: personnelNumber,
          supervisor_email: '',
          language,
        })
        setUser({ id: data.user.id, email: data.user.email || '' })
        setProfile({
          id: data.user.id,
          email: data.user.email || email,
          full_name: fullName,
          personnel_number: personnelNumber,
          supervisor_email: '',
          language,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        await initialize(data.user.id)
        navigate('/settings')
      }
    } catch (err: any) {
      setError(err.message || t('auth.register.failed'))
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'login') {
    return (
      <LoginForm
        onLogin={handleLogin}
        onSwitchToRegister={() => setMode('register')}
        error={error}
      />
    )
  }

  return (
    <RegisterForm
      onRegister={handleRegister}
      onSwitchToLogin={() => setMode('login')}
      error={error}
    />
  )
}
