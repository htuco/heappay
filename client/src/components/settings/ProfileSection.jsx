import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'

import SettingsCard from '@/components/settings/SettingsCard'
import ProfileField from '@/components/settings/ProfileField'
import UserAvatar from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'

const emptyProfile = {
  firstName: '',
  lastName: '',
  email: '',
}

export default function ProfileSection() {
  const { user, updateProfile } = useAuth()
  const [profile, setProfile] = useState(emptyProfile)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState(null)

  useEffect(() => {
    if (!user) {
      setProfile(emptyProfile)
      return
    }

    setProfile({
      firstName: user.first_name ?? '',
      lastName: user.last_name ?? '',
      email: user.email ?? '',
    })
  }, [user])

  const isDirty =
    Boolean(user) &&
    (profile.firstName !== (user.first_name ?? '') ||
      profile.lastName !== (user.last_name ?? '') ||
      profile.email !== (user.email ?? ''))

  const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ').trim()

  function handleFieldChange(event) {
    const { name, value } = event.target
    setProfile((current) => ({ ...current, [name]: value }))
    setFeedback(null)
  }

  function handleReset() {
    if (!user) {
      setProfile(emptyProfile)
      return
    }

    setProfile({
      firstName: user.first_name ?? '',
      lastName: user.last_name ?? '',
      email: user.email ?? '',
    })
    setFeedback(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (!user || !isDirty || isSaving) {
      return
    }

    setIsSaving(true)
    setFeedback(null)

    try {
      await updateProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
      })
      setFeedback({ tone: 'success', message: 'Profile updated successfully.' })
    } catch (error) {
      setFeedback({
        tone: 'error',
        message: typeof error === 'string' ? error : 'Could not update profile.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <SettingsCard
      title="Profile Details"
      icon={UserRound}
      description="Manage the personal information shown across your account and keep your profile details current."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-[24px] border border-border bg-[linear-gradient(135deg,rgba(167,76,255,0.08),transparent_80%)] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <UserAvatar
                user={{
                  first_name: profile.firstName,
                  last_name: profile.lastName,
                }}
                className="h-16 w-16 rounded-3xl text-lg"
              />

              <div>
                <p className="text-sm font-semibold text-card-foreground">
                  {displayName || 'Your profile'}
                </p>
                <p className="text-xs text-muted-foreground">{profile.email || 'No email loaded'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Personal details appear in your account settings and workspace profile.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileField
            label="First name"
            hint="Used for your account identity."
            name="firstName"
            value={profile.firstName}
            onChange={handleFieldChange}
            placeholder="Enter your first name"
            required
            disabled={!user || isSaving}
          />
          <ProfileField
            label="Last name"
            hint="Used alongside your first name across the workspace."
            name="lastName"
            value={profile.lastName}
            onChange={handleFieldChange}
            placeholder="Enter your last name"
            required
            disabled={!user || isSaving}
          />
          <ProfileField
            label="Email address"
            hint="Primary address for account access and recovery updates."
            name="email"
            type="email"
            value={profile.email}
            onChange={handleFieldChange}
            placeholder="Enter your email address"
            required
            disabled={!user || isSaving}
          />
        </div>
        {feedback ? (
          <p
            className={
              feedback.tone === 'success'
                ? 'text-sm font-medium text-emerald-600'
                : 'text-sm font-medium text-destructive'
            }
          >
            {feedback.message}
          </p>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleReset}
            disabled={!user || isSaving || !isDirty}
          >
            Reset
          </Button>
          <Button type="submit" className="w-full sm:w-auto" disabled={!user || isSaving || !isDirty}>
            {isSaving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </form>
    </SettingsCard>
  )
}
