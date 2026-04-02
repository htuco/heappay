import { useState } from 'react'
import { Camera, UserRound } from 'lucide-react'

import SettingsCard from '@/components/settings/SettingsCard'
import { Button } from '@/components/ui/button'

const initialProfile = {
  fullName: 'Selim Kovacevic',
  username: 'selimk',
  email: 'selim@example.com',
  location: 'Sarajevo, Bosnia and Herzegovina',
}

function getInitials(name) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function Field({ label, hint, ...props }) {
  return (
    <label className="block space-y-2">
      <div>
        <span className="text-sm font-semibold text-card-foreground">{label}</span>
        {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
      <input
        className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition focus:border-primary"
        {...props}
      />
    </label>
  )
}

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
        <div className="rounded-[24px] border border-border bg-[linear-gradient(135deg,rgba(167,76,255,0.08),transparent_80%)] p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-lg font-semibold text-primary-foreground">
                {getInitials(profile.fullName)}
              </div>
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
          <Field
            label="Full name"
            hint="Used for your account identity and team-facing profile."
            name="fullName"
            value={profile.fullName}
            onChange={handleFieldChange}
            placeholder="Enter your full name"
          />
          <Field
            label="Username"
            hint="Short handle used in mentions and profile links."
            name="username"
            value={profile.username}
            onChange={handleFieldChange}
            placeholder="Enter your username"
          />
          <Field
            label="Email address"
            hint="Primary address for account access and recovery updates."
            name="email"
            type="email"
            value={profile.email}
            onChange={handleFieldChange}
            placeholder="Enter your email address"
          />
          <Field
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
