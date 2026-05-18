import { useState } from 'react'
import { UserRound } from 'lucide-react'

import AvatarUploadModal from '@/components/settings/AvatarUploadModal'
import SettingsCard from '@/components/settings/SettingsCard'
import ProfileField from '@/components/settings/ProfileField'
import UserAvatar from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { useNotifications } from '@/context/NotificationContext'
import { useAuth } from '@/hooks/useAuth'

export default function ProfileSection() {
  const { notify } = useNotifications()
  const { user, uploadProfileAvatar } = useAuth()
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)

  const firstName = user?.first_name ?? ''
  const lastName = user?.last_name ?? ''
  const email = user?.email ?? ''
  const displayName = [firstName, lastName].filter(Boolean).join(' ').trim()

  async function handleAvatarUpload(file) {
    await uploadProfileAvatar(file)
    notify({ type: 'success', message: 'Profile photo updated.' })
  }

  return (
    <SettingsCard
      title="Profile Details"
      icon={UserRound}
      description="Personal information shown across your account."
    >
      <AvatarUploadModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
        onUpload={handleAvatarUpload}
      />

      <div className="space-y-4">
        <div className="bg-emphasis rounded-2xl border border-border p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <UserAvatar
                user={{
                  first_name: firstName,
                  last_name: lastName,
                  avatar_url: user?.avatar_url,
                }}
                useStockPlaceholder={false}
                className="h-16 w-16 rounded-3xl text-lg"
              />

              <div>
                <p className="text-sm font-semibold text-card-foreground">
                  {displayName || 'Your profile'}
                </p>
                <p className="text-xs text-muted-foreground">{email || 'No email loaded'}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Shown across your account.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={!user}
                onClick={() => setAvatarModalOpen(true)}
              >
                Change photo
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileField
            label="First name"
            value={firstName}
          />
          <ProfileField
            label="Last name"
            value={lastName}
          />
          <ProfileField
            label="Email address"
            hint="Used for sign-in and recovery."
            value={email}
          />
        </div>
      </div>
    </SettingsCard>
  )
}
