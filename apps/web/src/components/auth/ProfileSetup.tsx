import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Save, User, Hash, Mail } from 'lucide-react'
import { useTranslation } from '@/lib/useTranslation'

interface ProfileSetupProps {
  initialName?: string
  initialPersonnel?: string
  initialSupervisorEmail?: string
  onSave: (fullName: string, personnelNumber: string, supervisorEmail: string) => Promise<void>
}

export function ProfileSetup({ initialName = '', initialPersonnel = '', initialSupervisorEmail = '', onSave }: ProfileSetupProps) {
  const { t } = useTranslation()
  const [fullName, setFullName] = useState(initialName)
  const [personnelNumber, setPersonnelNumber] = useState(initialPersonnel)
  const [supervisorEmail, setSupervisorEmail] = useState(initialSupervisorEmail)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave(fullName, personnelNumber, supervisorEmail)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('Failed to save profile:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3 mb-5">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-otis-500 to-otis-700 flex items-center justify-center shadow-lg shadow-otis-500/20 flex-shrink-0">
          <User className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-otis-800 dark:text-white">
            {t('profile.title')}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">{t('profile.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <User className="absolute left-4 top-[42px] w-4 h-4 text-gray-400" />
          <Input
            id="profile-name"
            label={t('profile.name')}
            type="text"
            placeholder={t('profile.name.placeholder')}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="pl-10"
          />
        </div>

        <div className="relative">
          <Hash className="absolute left-4 top-[42px] w-4 h-4 text-gray-400" />
          <Input
            id="profile-personnel"
            label={t('profile.personnel')}
            type="text"
            placeholder={t('profile.personnel.placeholder')}
            value={personnelNumber}
            onChange={(e) => setPersonnelNumber(e.target.value)}
            required
            className="pl-10"
          />
        </div>

        <div className="relative">
          <Mail className="absolute left-4 top-[42px] w-4 h-4 text-gray-400" />
          <Input
            id="profile-supervisor"
            label={t('profile.supervisor')}
            type="email"
            placeholder={t('profile.supervisor.placeholder')}
            value={supervisorEmail}
            onChange={(e) => setSupervisorEmail(e.target.value)}
            className="pl-10"
          />
        </div>

        {success && (
          <div className="flex items-center gap-2 p-3.5 bg-emerald-500/10 backdrop-blur border border-emerald-400/30 rounded-2xl">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <p className="text-sm text-emerald-500 font-medium">{t('profile.saved')}</p>
          </div>
        )}

        <Button type="submit" fullWidth disabled={loading} variant="primary">
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('profile.saving')}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Save className="w-5 h-5" />
              {t('profile.save')}
            </span>
          )}
        </Button>
      </form>
    </Card>
  )
}
