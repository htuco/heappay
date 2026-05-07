import { useState } from 'react'
import { Camera, UserRound } from 'lucide-react'

import SettingsCard from '@/components/settings/SettingsCard'
import ProfileField from '@/components/settings/ProfileField'
import UserAvatar from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/button'
import { initialProfile } from '@/lib/mockData'

export default function ProfileSection() {
  const [profile, setProfile] = useState(initialProfile)

  function handleFieldChange(event) {
    const { name, value } = event.target
    setProfile((current) => ({ ...current, [name]: value }))
  }

  function handleReset() {
    setProfile(initialProfile)
  }

  return (
    <SettingsCard
      title="Profile Details"
      icon={UserRound}
      description="Manage the personal information shown across your account and keep your profile details current."
    >
      <div className="space-y-4">
        <div className="bg-emphasis rounded-2xl border border-border p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <UserAvatar
                user={{
                  first_name: profile.fullName?.split(' ')[0],
                  last_name: profile.fullName?.split(' ').slice(1).join(' '),
                }}
                className="h-16 w-16 rounded-3xl text-lg"
              />

              <div>
                <p className="text-sm font-semibold text-card-foreground">{profile.fullName}</p>
                <p className="text-xs text-muted-foreground">@{profile.username}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Personal details appear in your account settings and workspace profile.
                </p>
              </div>
            </div>
            <Button variant="outline" className="w-full sm:w-auto">
              <Camera className="mr-1" />
              Update Photo
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <ProfileField
            label="Full name"
            hint="Used for your account identity and team-facing profile."
            name="fullName"
            value={profile.fullName}
            onChange={handleFieldChange}
            placeholder="Enter your full name"
          />
          <ProfileField
            label="Username"
            hint="Short handle used in mentions and profile links."
            name="username"
            value={profile.username}
            onChange={handleFieldChange}
            placeholder="Enter your username"
          />
          <ProfileField
            label="Email address"
            hint="Primary address for account access and recovery updates."
            name="email"
            type="email"
            value={profile.email}
            onChange={handleFieldChange}
            placeholder="Enter your email address"
          />
          <ProfileField
            label="Location"
            hint="Optional location shown for account context."
            name="location"
            value={profile.location}
            onChange={handleFieldChange}
            placeholder="Enter your location"
          />
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleReset}>
            Reset
          </Button>
          <Button type="button" className="w-full sm:w-auto">
            Save Profile
          </Button>
        </div>
      </div>
    </SettingsCard>
  )
}
