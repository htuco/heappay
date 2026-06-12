import { useEffect, useMemo, useState } from 'react'
import { Bell, CreditCard, Eye, KeyRound, Paintbrush } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAppDispatch } from '@/store/hooks'
import { updateNotificationPreferences } from '@/store/slices/authSlice'

import { useWalletCards } from '@/hooks/useWalletCards'

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
import DefaultCardPicker from '@/components/settings/DefaultCardPicker'
import { Button } from '@/components/ui/button'

const formatPreference = (value) => value.charAt(0).toUpperCase() + value.slice(1)

function savedBillingFromUser(user) {
  if (!user) return true
  return user.billing_reminders_enabled !== false
}

export default function SettingsPage() {
  const dispatch = useAppDispatch()
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false)
  const { user } = useAuth()
  const { cards, setMainCard } = useWalletCards()
  const { preference: themePreference, isDark, setTheme } = useTheme()

  const [draftTheme, setDraftTheme] = useState(themePreference)
  const [draftBillingReminders, setDraftBillingReminders] = useState(true)
  const [savePending, setSavePending] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    setDraftTheme(themePreference)
  }, [themePreference])

  useEffect(() => {
    if (user) {
      setDraftBillingReminders(savedBillingFromUser(user))
    }
  }, [user?.billing_reminders_enabled, user?.id])

  const savedBilling = useMemo(() => savedBillingFromUser(user), [user])

  const isThemeDirty = useMemo(() => draftTheme !== themePreference, [draftTheme, themePreference])
  const isBillingDirty = useMemo(
    () => Boolean(user) && draftBillingReminders !== savedBilling,
    [user, draftBillingReminders, savedBilling],
  )
  const isDirty = isThemeDirty || isBillingDirty

  function handleDiscard() {
    setDraftTheme(themePreference)
    if (user) {
      setDraftBillingReminders(savedBillingFromUser(user))
    }
    setSaveError(null)
  }

  async function handleSaveChanges() {
    if (!isDirty || savePending) return
    setSavePending(true)
    setSaveError(null)
    try {
      if (isBillingDirty && user) {
        await dispatch(
          updateNotificationPreferences({ billingRemindersEnabled: draftBillingReminders }),
        ).unwrap()
      }
    } catch (err) {
      setSaveError(typeof err === 'string' ? err : 'Could not save notification preferences.')
    } finally {
      setSavePending(false)
    }
    if (isThemeDirty) {
      setTheme(draftTheme)
    }
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
          title="Default Card"
          icon={CreditCard}
          description="The card pre-selected for Top Up, Pay, and Transfer actions."
        >
          <DefaultCardPicker cards={cards} onSelect={setMainCard} />
        </SettingsCard>

        <SettingsCard
          title="Change Password"
          icon={KeyRound}
          description="Update your password and recovery email."
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
              hint="Reset links sent to your account email."
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
          description="Email and in-app notices for billing activity. Use Save changes below to update your account."
        >
          <div className="space-y-3">
            <ControlRow
              label="Billing reminders"
              hint="Renewal reminders and payment confirmations."
              emphasize
            >
              <Toggle
                enabled={draftBillingReminders}
                label={draftBillingReminders ? 'Enabled' : 'Disabled'}
                onToggle={() =>
                  setDraftBillingReminders((current) => !current)
                }
                disabled={!user || savePending}
              />
            </ControlRow>
            {!user ? (
              <p className="text-xs text-muted-foreground">Sign in to manage notification preferences.</p>
            ) : null}
          </div>
        </SettingsCard>

        <SettingsCard
          title="Theme & Preferences"
          icon={Paintbrush}
          description="Control how the app looks. Theme is stored on this device only; use Save changes below to apply."
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
                active={formatPreference(draftTheme)}
                onSelect={(label) =>
                  setDraftTheme(label.toLowerCase())
                }
              />
            </ControlRow>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Privacy & Account"
          icon={Eye}
          description="Review account access and destructive actions."
        >
          <div className="space-y-3">
            <ActionRow
              label="Deactivate account"
              value="Permanent"
              hint="Permanently disables your account. You will be signed out."
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

      {isDirty ? (
        <div className="sticky bottom-0 z-10 rounded-surface border border-border bg-card/95 p-3 shadow-xs backdrop-blur sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-card-foreground">Unsaved changes</p>
              <p className="text-xs text-muted-foreground">
                {isBillingDirty && isThemeDirty
                  ? 'Billing preferences sync to your account; theme applies on this device only.'
                  : isBillingDirty
                    ? 'Billing preferences will sync to your account when you save.'
                    : 'Theme is kept on this device. Save to apply, or discard.'}
              </p>
              {saveError ? (
                <p className="mt-2 text-xs text-destructive">{saveError}</p>
              ) : null}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleDiscard}
                disabled={savePending}
              >
                Discard
              </Button>
              <Button
                className="w-full px-5 sm:w-auto"
                onClick={handleSaveChanges}
                disabled={savePending || (isBillingDirty && !user)}
              >
                {savePending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
