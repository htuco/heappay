import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Bell, Eye, KeyRound, Paintbrush, ShieldCheck, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'

const quickStats = [
  { label: 'Access', value: 'Admin', helper: 'Workspace-level permissions enabled' },
  { label: 'Security', value: 'Strong', helper: 'Password rotated recently' },
  { label: 'Theme', value: 'System', helper: 'Following device preference' },
]

function SettingsCard({ title, description, icon: Icon, action, children }) {
  return (
    <section className="rounded-[24px] border border-border bg-card p-4 shadow-xs sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-muted p-2.5 text-primary">
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold sm:text-xl">{title}</h2>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{description}</p>
            </div>
          </div>
        </div>
        {action ? <div className="w-full sm:w-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  )
}

function ControlRow({ label, hint, children, emphasize = false }) {
  return (
    <div
      className={`rounded-2xl border border-border px-4 py-4 ${
        emphasize
          ? 'bg-[linear-gradient(135deg,rgba(167,76,255,0.08),transparent_75%)]'
          : 'bg-background'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-card-foreground">{label}</p>
          {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
        </div>
        <div className="w-full min-w-0 sm:ml-4 sm:w-auto">{children}</div>
      </div>
    </div>
  )
}

function SettingRow({ label, value, hint, emphasize = false }) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between ${
        emphasize
          ? 'bg-[linear-gradient(135deg,rgba(167,76,255,0.08),transparent_75%)]'
          : 'bg-background'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-card-foreground">{label}</p>
        {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
      <p className="text-sm font-medium text-card-foreground sm:max-w-[15rem] sm:text-right">
        {value}
      </p>
    </div>
  )
}

function ActionRow({ label, value, hint, action, tone = 'default' }) {
  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between ${
        tone === 'danger' ? 'bg-destructive/5' : 'bg-background'
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-card-foreground">{label}</p>
        {hint ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p> : null}
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:max-w-[15rem] sm:items-end">
        <p className="text-sm font-medium text-card-foreground sm:text-right">{value}</p>
        {action}
      </div>
    </div>
  )
}

function Toggle({ enabled = false, label, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      className="flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-border bg-background px-3 py-2 transition-colors hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:w-auto sm:min-w-[11rem]"
    >
      {label ? (
        <span className="min-w-0 text-left text-sm font-medium text-card-foreground">{label}</span>
      ) : null}
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-200 ${
          enabled
            ? 'border-primary bg-primary'
            : 'border-border bg-muted'
        }`}
      >
        <span
          className={`absolute h-5 w-5 rounded-full bg-card shadow-xs transition-transform duration-200 ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  )
}

function OptionGroup({ options, active, onSelect }) {
  return (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto sm:justify-end">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onSelect(option)}
          aria-pressed={option === active}
          className={`rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
            option === active
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-background text-card-foreground'
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  )
}

function HeroCard({ onBack }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-border bg-card shadow-xs">
      <div className="border-b border-border/70 bg-[linear-gradient(135deg,rgba(167,76,255,0.12),rgba(167,76,255,0.02)_55%,transparent)] p-4 sm:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="outline" className="w-full sm:w-auto" onClick={onBack}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary sm:text-xs">
              <Sparkles className="h-3.5 w-3.5" />
              Settings
            </div>
          </div>

          <div className="max-w-4xl">
            <h1 className="text-2xl font-bold tracking-tight text-card-foreground sm:text-4xl">
              Account settings that feel like a control center
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
              Password, notifications, security, theme preferences, and account privacy all live
              here in one focused space without an extra sidebar.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-0 sm:grid-cols-3">
        {quickStats.map((stat, index) => (
          <div
            key={stat.label}
            className={`p-4 sm:p-5 ${index < quickStats.length - 1 ? 'border-b border-border/70 sm:border-r sm:border-b-0' : ''}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-bold text-card-foreground">{stat.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.helper}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [billingRemindersEnabled, setBillingRemindersEnabled] = useState(true)
  const [loginAlertsEnabled, setLoginAlertsEnabled] = useState(true)
  const [securityAlertChannel, setSecurityAlertChannel] = useState('Email')
  const [productUpdatesFrequency, setProductUpdatesFrequency] = useState('Weekly')
  const [themePreference, setThemePreference] = useState('System')
  const [densityPreference, setDensityPreference] = useState('Comfortable')
  const [startPagePreference, setStartPagePreference] = useState('Dashboard')

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5">
      <HeroCard onBack={() => navigate(-1)} />

      <div className="grid gap-4 xl:grid-cols-2">
        <SettingsCard
          title="Change Password"
          icon={KeyRound}
          description="Keep access secure with clear password hygiene and recovery controls."
          action={<Button className="w-full sm:w-auto">Change Password</Button>}
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
              label="Password requirements"
              value="Enabled"
              hint="Minimum length, complexity, and password reuse protection."
            />
          </div>
        </SettingsCard>

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
            <SettingRow
              label="Profile visibility"
              value="Private"
              hint="Only you and workspace admins can see personal account metadata."
              emphasize
            />
            <SettingRow
              label="Data export"
              value="Available"
              hint="Generate a downloadable copy of personal settings and account activity."
            />
            <ActionRow
              label="Deactivate account"
              value="Manual review"
              hint="High-impact account actions should require confirmation and recovery steps."
              tone="danger"
              action={
                <Button variant="destructive" className="w-full sm:w-auto">
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
