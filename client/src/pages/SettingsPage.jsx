import { useEffect, useMemo, useState } from 'react'
import { Bell, Eye, KeyRound, Paintbrush } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'

import ActionRow from '@/components/settings/ActionRow'
import ChangePasswordModal from '@/components/settings/ChangePasswordModal'
import DeactivateAccountModal from '@/components/settings/DeactivateAccountModal'
import ControlRow from '@/components/settings/ControlRow'
import OptionGroup from '@/components/settings/OptionGroup'
import SettingRow from '@/components/settings/SettingRow'
import SettingsCard from '@/components/settings/SettingsCard'
import ProfileSection from '@/components/settings/ProfileSection'
import SettingsHero from '@/components/settings/SettingsHero'
import Toggle from '@/components/settings/Toggle'
import { Button } from '@/components/ui/button'

const formatPreference = (value) => value.charAt(0).toUpperCase() + value.slice(1)

export default function SettingsPage() {
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false)
  const { user } = useAuth()
  const { preference: themePreference, isDark, setTheme } = useTheme()
  const [savedPreferences, setSavedPreferences] = useState({
    billingRemindersEnabled: true,
    theme: themePreference,
  })
  const [draftPreferences, setDraftPreferences] = useState(savedPreferences)

  useEffect(() => {
    setSavedPreferences((current) => ({ ...current, theme: themePreference }))
  }, [themePreference])

  useEffect(() => {
    setDraftPreferences(savedPreferences)
  }, [savedPreferences])

  const isDirty = useMemo(
    () =>
      draftPreferences.billingRemindersEnabled !== savedPreferences.billingRemindersEnabled ||
      draftPreferences.theme !== savedPreferences.theme,
    [draftPreferences, savedPreferences],
  )

  function handleSavePreferences() {
    setSavedPreferences(draftPreferences)

    if (draftPreferences.theme !== themePreference) {
      setTheme(draftPreferences.theme)
    }
  }

  function handleDiscardPreferences() {
    setDraftPreferences(savedPreferences)
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5">
      <SettingsHero
        accessLevel={user?.role_name}
        themePreference={themePreference}
        isDark={isDark}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <ProfileSection />
        </div>

        <SettingsCard
          title="Change Password"
          icon={KeyRound}
          description="Update your password and keep account recovery routed to the right place."
          action={
            <Button className="w-full sm:w-auto" onClick={() => setIsChangePasswordOpen(true)}>
              Change Password
            </Button>
          }
        >
          <div className="space-y-3">
            <SettingRow
              label="Recovery method"
              value="Email link"
              hint="Reset links go to your primary account email."
            />
          </div>
        </SettingsCard>

        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
        />

        <DeactivateAccountModal
          isOpen={isDeactivateOpen}
          onClose={() => setIsDeactivateOpen(false)}
        />

        <SettingsCard
          title="Notification Preferences"
          icon={Bell}
          description="Choose which updates deserve your attention and where they should arrive."
        >
          <div className="space-y-3">
            <ControlRow
              label="Billing reminders"
              hint="Renewal reminders and payment confirmations."
              emphasize
            >
              <Toggle
                enabled={draftPreferences.billingRemindersEnabled}
                label={draftPreferences.billingRemindersEnabled ? 'Enabled' : 'Disabled'}
                onToggle={() =>
                  setDraftPreferences((current) => ({
                    ...current,
                    billingRemindersEnabled: !current.billingRemindersEnabled,
                  }))
                }
              />
            </ControlRow>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Theme & Preferences"
          icon={Paintbrush}
          description="Control how the workspace looks and how the app behaves day to day."
        >
          <div className="space-y-3">
            <ControlRow
              label="Theme"
              hint={`Currently using ${formatPreference(themePreference)} mode. ${
                themePreference === 'system' ? `Resolved to ${isDark ? 'Dark' : 'Light'}.` : ''
              }`}
              emphasize
            >
              <OptionGroup
                options={['Light', 'Dark', 'System']}
                active={formatPreference(draftPreferences.theme)}
                onSelect={(label) =>
                  setDraftPreferences((current) => ({
                    ...current,
                    theme: label.toLowerCase(),
                  }))
                }
              />
            </ControlRow>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Privacy & Account"
          icon={Eye}
          description="Review account visibility, data access, and high-impact account actions."
        >
          <div className="space-y-3">
            <ActionRow
              label="Deactivate account"
              value="Permanent"
              hint="Sets deleted_at on your account. You will be signed out and cannot log back in."
              tone="danger"
              action={
                <Button
                  variant="destructive"
                  className="w-full sm:w-auto"
                  onClick={() => setIsDeactivateOpen(true)}
                >
                  Deactivate
                </Button>
              }
            />
          </div>
        </SettingsCard>
      </div>

      <div className="sticky bottom-0 z-10 rounded-2xl border border-border bg-card/95 p-3 shadow-xs backdrop-blur sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-card-foreground">Unsaved preferences</p>
            <p className="text-xs text-muted-foreground">
              Review your settings and save when you are ready.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleDiscardPreferences}
              disabled={!isDirty}
            >
              Discard
            </Button>
            <Button
              className="w-full px-5 sm:w-auto"
              onClick={handleSavePreferences}
              disabled={!isDirty}
            >
              Save Changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
