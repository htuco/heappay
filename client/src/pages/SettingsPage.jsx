import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Eye, KeyRound, Paintbrush, ShieldCheck } from 'lucide-react'

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

export default function SettingsPage() {
  const navigate = useNavigate()
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false)
  const [billingRemindersEnabled, setBillingRemindersEnabled] = useState(true)
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true)
  const [securityAlertChannel, setSecurityAlertChannel] = useState('Email')
  const [productUpdatesFrequency, setProductUpdatesFrequency] = useState('Weekly')
  const [themePreference, setThemePreference] = useState('System')
  const [densityPreference, setDensityPreference] = useState('Comfortable')
  const [startPagePreference, setStartPagePreference] = useState('Dashboard')

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5">
      <SettingsHero onBack={() => navigate('/dashboard')} />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <ProfileSection />    
        </div>

        <SettingsCard
          title="Change Password"
          icon={KeyRound}
          description="Keep access secure with clear password hygiene and recovery controls."
          action={
            <Button className="w-full sm:w-auto" onClick={() => setIsChangePasswordOpen(true)}>
              Change Password
            </Button>
          }
        >
          <div className="space-y-3">
            <SettingRow
              label="Password status"
              value="Healthy"
              hint="Password hash exists and was last rotated on 18 Feb 2026."
              emphasize
            />
            <SettingRow
              label="Recovery method"
              value="Email link"
              hint="Reset links go to your primary account email."
            />
            <SettingRow
              label="Password rules"
              value="Min 8 · Max 255"
              hint="No complexity requirements are enforced beyond minimum length."
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
              label="Security alerts"
              hint="Recommended for password resets, new logins, and suspicious activity."
              emphasize
            >
              <OptionGroup
                options={['Email', 'In-app', 'SMS']}
                active={securityAlertChannel}
                onSelect={setSecurityAlertChannel}
              />
            </ControlRow>
            <ControlRow
              label="Billing reminders"
              hint="Renewal reminders and payment confirmations."
            >
              <Toggle
                enabled={billingRemindersEnabled}
                label={billingRemindersEnabled ? 'Enabled' : 'Disabled'}
                onToggle={() => setBillingRemindersEnabled((current) => !current)}
              />
            </ControlRow>
            <ControlRow
              label="Product updates"
              hint="Low-frequency product announcements and release notes."
            >
              <OptionGroup
                options={['Off', 'Weekly', 'Monthly']}
                active={productUpdatesFrequency}
                onSelect={setProductUpdatesFrequency}
              />
            </ControlRow>
          </div>
        </SettingsCard>

        <SettingsCard
          title="Security Settings"
          icon={ShieldCheck}
          description="Review sign-in protection, session visibility, and account safety controls."
        >
          <div className="space-y-3">
            <SettingRow
              label="Two-factor authentication"
              value="Not enabled"
              hint="Add a second step to strengthen account access."
              emphasize
            />
            <ControlRow
              label="Login alerts"
              hint="Get notified when a new device signs in to your account."
            >
              <Toggle
                enabled={loginAlertsEnabled}
                label={loginAlertsEnabled ? 'Enabled' : 'Disabled'}
                onToggle={() => setLoginAlertsEnabled((current) => !current)}
              />
            </ControlRow>
            <SettingRow
              label="Active sessions"
              value="4 devices"
              hint="Review current signed-in devices and remove anything suspicious."
            />
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
              hint="Follow the light or dark mode set by your device."
              emphasize
            >
              <OptionGroup
                options={['Light', 'Dark', 'System']}
                active={themePreference}
                onSelect={setThemePreference}
              />
            </ControlRow>
            <ControlRow
              label="Density"
              hint="Balanced spacing for tables, cards, and page layouts."
            >
              <OptionGroup
                options={['Compact', 'Comfortable']}
                active={densityPreference}
                onSelect={setDensityPreference}
              />
            </ControlRow>
            <ControlRow
              label="Start page"
              hint="Choose which area opens first after sign-in."
            >
              <OptionGroup
                options={['Dashboard', 'Activity', 'Settings']}
                active={startPagePreference}
                onSelect={setStartPagePreference}
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

      <div className="sticky bottom-0 z-10 rounded-[24px] border border-border bg-card/95 p-3 shadow-xs backdrop-blur sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-card-foreground">Unsaved preferences</p>
            <p className="text-xs text-muted-foreground">
              Review your settings and save when you are ready.
            </p>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" className="w-full sm:w-auto">
              Discard
            </Button>
            <Button className="w-full px-5 sm:w-auto">Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
