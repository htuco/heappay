import { useState } from 'react'
import { Camera, Mail } from 'lucide-react'

import AvatarUploadModal from '@/components/settings/AvatarUploadModal'
import LoginEmailPanel from '@/components/settings/LoginEmailPanel'
import SettingsSection from '@/components/settings/SettingsSection'
import UserAvatar from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNotifications } from '@/context/NotificationContext'
import { CATEGORIES } from '@/context/notifications/categories'
import { useAuth } from '@/hooks/useAuth'
import { getApiErrorMessage } from '@/utils/api'

export default function ProfileSection() {
  const { notify } = useNotifications()
  const { user, uploadProfileAvatar, updateProfile } = useAuth()
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)

  const savedFirstName = user?.first_name ?? ''
  const savedLastName = user?.last_name ?? ''
  const email = user?.email ?? ''
  const displayName = [savedFirstName, savedLastName].filter(Boolean).join(' ').trim()

  const [firstName, setFirstName] = useState(savedFirstName)
  const [lastName, setLastName] = useState(savedLastName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Keep the editable fields in sync when the user record changes (login/refresh).
  const [syncedId, setSyncedId] = useState(user?.id ?? null)
  if (user && user.id !== syncedId) {
    setSyncedId(user.id)
    setFirstName(savedFirstName)
    setLastName(savedLastName)
  }

  const isDirty =
    Boolean(user) && (firstName.trim() !== savedFirstName || lastName.trim() !== savedLastName)

  async function handleAvatarUpload(file) {
    await uploadProfileAvatar(file)
    notify({
      type: 'success',
      category: CATEGORIES.SECURITY,
      message: 'Profile photo updated.',
      link: { route: '/settings' },
    })
  }

  function handleReset() {
    if (saving) return
    setFirstName(savedFirstName)
    setLastName(savedLastName)
    setError('')
  }

  async function handleSave() {
    if (!isDirty || saving) return
    setSaving(true)
    setError('')
    try {
      await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim() })
      notify({
        type: 'success',
        category: CATEGORIES.SECURITY,
        message: 'Profile updated.',
        link: { route: '/settings' },
      })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update your profile.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsSection
      title="Profile"
      description="Manage your personal information."
    >
      <AvatarUploadModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        onUpload={handleAvatarUpload}
      />

      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setAvatarModalOpen(true)}
            disabled={!user}
            aria-label="Change profile photo"
            className="group relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none"
          >
            <UserAvatar
              user={{ first_name: savedFirstName, last_name: savedLastName, avatar_url: user?.avatar_url }}
              useStockPlaceholder={false}
              className="h-16 w-16 rounded-full text-lg"
            />
            <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground transition-transform group-hover:scale-105">
              <Camera className="h-3 w-3" />
            </span>
          </button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-card-foreground">{displayName || 'Your profile'}</p>
            <p className="truncate text-xs text-muted-foreground">{email || 'No email loaded'}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="profile-first-name" className="text-sm font-semibold text-card-foreground">
              First name
            </label>
            <Input
              id="profile-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              disabled={!user || saving}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="profile-last-name" className="text-sm font-semibold text-card-foreground">
              Last name
            </label>
            <Input
              id="profile-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              disabled={!user || saving}
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Account email
          </p>
          <LoginEmailPanel icon={Mail} />
        </div>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}

        <div className="flex flex-col justify-end gap-2 border-t border-border pt-4 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={handleReset}
            disabled={!isDirty || saving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!isDirty || saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
