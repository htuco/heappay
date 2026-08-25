import { useEffect, useRef, useState } from 'react'
import { Download, WalletCards } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useBalanceScopePreference } from '@/hooks/useBalanceScopePreference'
import { useTheme } from '@/hooks/useTheme'
import { useAppDispatch } from '@/store/hooks'
import { refreshSession, updateDisplayPreferences, updateNotificationPreferences, updatePaymentSecurityPreferences, updateProfileUser } from '@/store/slices/authSlice'

import { useWalletCards } from '@/hooks/useWalletCards'

import ChangePasswordModal from '@/components/settings/ChangePasswordModal'
import DeactivateAccountModal from '@/components/settings/DeactivateAccountModal'
import ActionRow from '@/components/settings/ActionRow'
import ControlRow from '@/components/settings/ControlRow'
import IconRow from '@/components/settings/IconRow'
import OptionGroup from '@/components/settings/OptionGroup'
import RecoveryMethodPanel from '@/components/settings/RecoveryMethodPanel'
import SettingsSection from '@/components/settings/SettingsSection'
import StatusPill from '@/components/settings/StatusPill'
import ProfileSection from '@/components/settings/ProfileSection'
import Toggle from '@/components/settings/Toggle'
import DefaultCardPicker from '@/components/settings/DefaultCardPicker'
import SettingsNav from '@/components/settings/SettingsNav'
import AllCardsModal from '@/components/wallet/AllCardsModal'
import { Button } from '@/components/ui/button'
import { exportService } from '@/services/exportService'
import { BALANCE_SCOPE_LABELS, BALANCE_SCOPES } from '@/utils/balanceScope'
import { normalizeCurrency } from '@/utils/money'
import DisplayCurrencyRow from '@/components/settings/DisplayCurrencyRow'
import { maskEmail } from '@/utils/maskEmail'
import { useNotifications } from '@/context/NotificationContext'

// The rail carries labels only, grouped: the section title and its description
// live in the content column (see SettingsSection).
const NAV_GROUPS = [
  {
    label: 'Account',
    items: [
      { id: 'profile', label: 'Profile' },
      { id: 'security', label: 'Security' },
      { id: 'notifications', label: 'Notifications' },
    ],
  },
  {
    label: 'Billing',
    items: [{ id: 'payment', label: 'Payment methods' }],
  },
  {
    label: 'Workspace',
    items: [
      { id: 'data', label: 'Data & reports' },
      { id: 'preferences', label: 'Preferences' },
    ],
  },
]

const EXPORT_REPORTS = [
  {
    key: 'walletSummary',
    label: 'Wallet summary',
    hint: 'Total balance and a breakdown of every card.',
    run: () => exportService.walletSummaryPdf(),
  },
  {
    key: 'transactions',
    label: 'All transactions',
    hint: 'Your full transaction history as a PDF statement.',
    run: () => exportService.transactionsPdf(),
  },
  {
    key: 'monthlyReport',
    label: 'Monthly report',
    hint: "Last month's income, expenses, and spending by category.",
    run: () => exportService.monthlyReportPdf({ months: 1 }),
  },
]

const formatPreference = (value) => value.charAt(0).toUpperCase() + value.slice(1)

function prefEnabled(user, key) {
  if (!user) return true
  return user[key] !== false
}

function savedNotificationPrefs(user) {
  return {
    billingReminders: prefEnabled(user, 'billing_reminders_enabled'),
    emailPaymentSent: prefEnabled(user, 'email_payment_sent_enabled'),
    emailPaymentReceived: prefEnabled(user, 'email_payment_received_enabled'),
    emailTopup: prefEnabled(user, 'email_topup_enabled'),
    emailRefundStatus: prefEnabled(user, 'email_refund_status_enabled'),
    emailOutflow: prefEnabled(user, 'email_outflow_enabled'),
    emailFamilyActivity: prefEnabled(user, 'email_family_activity_enabled'),
    // Opt-out by default (staff only) — treat missing as false.
    notifyOnUserRequests: user?.notify_on_user_requests === true,
  }
}

function savedPaymentSecurityPrefs(user) {
  return {
    paymentConfirmEnabled: user?.payment_confirm_enabled !== false,
    paymentConfirmAboveAmount: String(user?.payment_confirm_above_amount ?? 0),
  }
}

export default function SettingsPage() {
  const dispatch = useAppDispatch()
  const [section, setSection] = useState('profile')
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false)
  const { user, isStaff } = useAuth()
  const { cards, setMainCard, removeCard } = useWalletCards()
  const { preference: themePreference, isDark, setTheme } = useTheme()
  const { preference: balanceScope, setBalanceScope } = useBalanceScopePreference()
  const { notify } = useNotifications()
  const [exportingReport, setExportingReport] = useState(null)

  // Auto-save model: preferences are mirrored locally for instant feedback, the
  // change is applied optimistically, and the update is dispatched right away.
  // On failure we roll back to the last saved value and surface the error.
  const [notifPrefs, setNotifPrefs] = useState(() => savedNotificationPrefs(user))
  const [paymentPrefs, setPaymentPrefs] = useState(() => savedPaymentSecurityPrefs(user))
  const [discoverable, setDiscoverable] = useState(() => user?.is_discoverable !== false)
  const [saveError, setSaveError] = useState(null)
  const [displayCurrency, setDisplayCurrency] = useState(
    () => normalizeCurrency(user?.display_currency),
  )
  const [isSavingCurrency, setIsSavingCurrency] = useState(false)

  // Re-sync the local mirror when the server-side user record changes (login,
  // refresh, save landing). Render-time adjustment keyed on user identity;
  // avoids the setState-in-effect cascade while still reacting to new data.
  const [syncedUserId, setSyncedUserId] = useState(user?.id ?? null)
  if (user && user.id !== syncedUserId) {
    setSyncedUserId(user.id)
    setNotifPrefs(savedNotificationPrefs(user))
    setPaymentPrefs(savedPaymentSecurityPrefs(user))
    setDiscoverable(user.is_discoverable !== false)
    setDisplayCurrency(normalizeCurrency(user.display_currency))
  }

  async function handleExportReport(report) {
    if (exportingReport) return
    setExportingReport(report.key)
    try {
      await report.run()
      notify({ type: 'success', message: `${report.label} exported as PDF.`, surface: 'toast' })
    } catch (err) {
      notify({
        type: 'error',
        message: err?.message ?? `Could not export ${report.label.toLowerCase()}.`,
        surface: 'toast',
      })
    } finally {
      setExportingReport(null)
    }
  }

  async function persistNotifPrefs(next) {
    const previous = notifPrefs
    setNotifPrefs(next)
    setSaveError(null)
    try {
      await dispatch(
        updateNotificationPreferences({
          billingRemindersEnabled: next.billingReminders,
          emailPaymentSentEnabled: next.emailPaymentSent,
          emailPaymentReceivedEnabled: next.emailPaymentReceived,
          emailTopupEnabled: next.emailTopup,
          emailRefundStatusEnabled: next.emailRefundStatus,
          emailOutflowEnabled: next.emailOutflow,
          emailFamilyActivityEnabled: next.emailFamilyActivity,
          notifyOnUserRequests: next.notifyOnUserRequests,
        }),
      ).unwrap()
    } catch (err) {
      setNotifPrefs(previous)
      setSaveError(typeof err === 'string' ? err : 'Could not save your notification settings.')
    }
  }

  const toggleNotif = (key) => () => {
    if (!user) return
    persistNotifPrefs({ ...notifPrefs, [key]: !notifPrefs[key] })
  }

  async function toggleDiscoverable() {
    if (!user) return
    const previous = discoverable
    const next = !previous
    setDiscoverable(next)
    setSaveError(null)
    try {
      await dispatch(updateProfileUser({ isDiscoverable: next })).unwrap()
    } catch (err) {
      setDiscoverable(previous)
      setSaveError(typeof err === 'string' ? err : 'Could not save your privacy settings.')
    }
  }

  const savedPaymentRef = useRef(paymentPrefs)
  const amountTimerRef = useRef(null)
  useEffect(() => {
    savedPaymentRef.current = savedPaymentSecurityPrefs(user)
  }, [user])

  async function pushPaymentPrefs(next) {
    setSaveError(null)
    try {
      await dispatch(
        updatePaymentSecurityPreferences({
          paymentConfirmEnabled: next.paymentConfirmEnabled,
          paymentConfirmAboveAmount: next.paymentConfirmAboveAmount,
        }),
      ).unwrap()
      savedPaymentRef.current = next
    } catch (err) {
      setPaymentPrefs(savedPaymentRef.current)
      setSaveError(typeof err === 'string' ? err : 'Could not save your payment settings.')
    }
  }

  // Toggling / mode change persists immediately.
  function persistPaymentPrefs(next) {
    setPaymentPrefs(next)
    if (amountTimerRef.current) clearTimeout(amountTimerRef.current)
    pushPaymentPrefs(next)
  }

  // Typing the threshold updates instantly but persists after a short pause,
  // so we don't fire a request per keystroke.
  function changePaymentAmount(value) {
    const next = { ...paymentPrefs, paymentConfirmAboveAmount: value }
    setPaymentPrefs(next)
    if (amountTimerRef.current) clearTimeout(amountTimerRef.current)
    amountTimerRef.current = setTimeout(() => pushPaymentPrefs(next), 700)
  }

  useEffect(() => () => amountTimerRef.current && clearTimeout(amountTimerRef.current), [])

  // Theme applies immediately (and persists on this device), no draft, no refresh.
  const handleThemeSelect = (value) => setTheme(value)

  const defaultCardCard = (
    <SettingsSection
      title="Default Card"
      description="The card pre-selected for Top Up, Pay, and Transfer actions."
    >
      <DefaultCardPicker cards={cards} onSelect={setMainCard} />
      {cards.length > 0 && (
        <div className="mt-4">
          <IconRow
            icon={WalletCards}
            label="Manage your cards"
            hint="Set your main card, remove a card, or request a freeze if one is lost or stolen."
            action={
              <AllCardsModal
                items={cards}
                triggerLabel="Manage cards"
                triggerVariant="outline"
                triggerClassName="w-full sm:w-auto"
                onSetMain={setMainCard}
                onRemove={removeCard}
              />
            }
          />
        </div>
      )}
    </SettingsSection>
  )

  const recoveryCard = (
    <SettingsSection
      title="Security"
      description="Protect your account and approvals."
    >
      <RecoveryMethodPanel
        email={user?.email}
        recoveryEmail={user?.recovery_email}
        recoveryEmailVerified={user?.recovery_email_verified ?? false}
        onRecoveryEmailChange={() => dispatch(refreshSession())}
        onChangePassword={() => setIsChangePasswordOpen(true)}
        totpEnabled={user?.totp_enabled ?? false}
        onTotpStatusChange={() => dispatch(refreshSession())}
        paymentConfirmEnabled={paymentPrefs.paymentConfirmEnabled}
        paymentConfirmAboveAmount={paymentPrefs.paymentConfirmAboveAmount}
        onPaymentConfirmEnabledChange={(value) =>
          persistPaymentPrefs({ ...paymentPrefs, paymentConfirmEnabled: value })
        }
        onPaymentConfirmAboveAmountChange={changePaymentAmount}
        paymentPrefsDisabled={!user}
      />
    </SettingsSection>
  )

  const notificationRows = [
    { key: 'emailPaymentSent', label: 'Payment sent', hint: 'Email when money you send completes.', emphasize: true },
    { key: 'emailOutflow', label: 'Outflow alert', hint: 'Email with your new balance whenever money leaves your account.' },
    { key: 'emailPaymentReceived', label: 'Payment received', hint: 'Email when you receive a transfer.' },
    { key: 'emailTopup', label: 'Top-up', hint: 'Email when a card top-up completes.' },
    { key: 'emailRefundStatus', label: 'Refund status', hint: 'Email when a refund request is approved or declined.' },
    { key: 'billingReminders', label: 'Billing reminders', hint: 'Renewal reminders and recurring payment confirmations.' },
    { key: 'emailFamilyActivity', label: 'Family activity', hint: 'Invites, allowance, and spending-limit changes for your family account.' },
  ]

  const notificationsCard = (
    <SettingsSection
      title="Notification Preferences"
      description="Email notices for payments and refunds, plus in-app billing reminders. Changes save automatically."
    >
      <div className="space-y-3">
        {user?.email ? (
          <p className="rounded-surface border border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
            Transaction emails are sent to{' '}
            <span className="break-all font-medium text-card-foreground">
              {user.recovery_email_verified && user.recovery_email
                ? maskEmail(user.recovery_email)
                : user.email}
            </span>
            {user.recovery_email_verified && user.recovery_email ? (
              <span> (verified recovery email)</span>
            ) : null}
          </p>
        ) : null}
        {notificationRows.map(({ key, label, hint, emphasize }) => (
          <ControlRow key={key} label={label} hint={hint} emphasize={emphasize} alignToggle>
            <Toggle
              compact
              enabled={notifPrefs[key]}
              label={notifPrefs[key] ? 'Enabled' : 'Disabled'}
              onToggle={toggleNotif(key)}
              disabled={!user}
            />
          </ControlRow>
        ))}
        {user && isStaff ? (
          <div className="mt-2 border-t border-border pt-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Staff
            </p>
            <ControlRow
              label="User request alerts"
              hint="Email me when a user submits a refund or card freeze/unfreeze request, or a transaction is flagged for manual review."
              alignToggle
            >
              <Toggle
                compact
                enabled={notifPrefs.notifyOnUserRequests}
                label={notifPrefs.notifyOnUserRequests ? 'Enabled' : 'Disabled'}
                onToggle={toggleNotif('notifyOnUserRequests')}
                disabled={!user}
              />
            </ControlRow>
          </div>
        ) : null}
        {!user ? (
          <p className="text-xs text-muted-foreground">Sign in to manage notification preferences.</p>
        ) : null}
      </div>
    </SettingsSection>
  )

  const privacyCard = (
    <SettingsSection
      title="Privacy"
      description="Control how others can find you when sending money. Changes save automatically."
    >
      <ControlRow
        label="Discoverable in search"
        hint="When on, others can find you by name or email. When off, you stay hidden from search but people can still reach you by your exact email or if you're already in their contacts."
        emphasize
        alignToggle
      >
        <Toggle
          compact
          enabled={discoverable}
          label={discoverable ? 'Discoverable' : 'Hidden'}
          onToggle={toggleDiscoverable}
          disabled={!user}
        />
      </ControlRow>
    </SettingsSection>
  )

  const appearanceCard = (
    <SettingsSection
      title="Appearance"
      description="How the app looks on this device."
    >
      {/* SettingsSection doesn't space its children — sections with more than one
          row own that themselves, as Data & Reports does. */}
      <div className="space-y-3">
        <ControlRow
          label="Theme"
          hint={`Currently using ${formatPreference(themePreference)} mode. ${
            themePreference === 'system' ? `Resolved to ${isDark ? 'Dark' : 'Light'}.` : ''
          } Applies instantly, stored on this device only.`}
          emphasize
        >
          <OptionGroup
            options={['Light', 'Dark', 'System']}
            active={formatPreference(themePreference)}
            onSelect={(label) => handleThemeSelect(label.toLowerCase())}
          />
        </ControlRow>

        <ControlRow
          label="Default balance view"
          hint="Which figure the dashboard balance opens on. You can still switch from the widget itself. Stored on this device only."
          emphasize
          alignToggle
        >
          <OptionGroup
            options={BALANCE_SCOPES.map((scope) => BALANCE_SCOPE_LABELS[scope])}
            active={BALANCE_SCOPE_LABELS[balanceScope]}
            onSelect={(label) =>
              setBalanceScope(
                BALANCE_SCOPES.find((scope) => BALANCE_SCOPE_LABELS[scope] === label) ?? 'combined',
              )
            }
          />
        </ControlRow>

        <DisplayCurrencyRow
          value={displayCurrency}
          onSelect={handleDisplayCurrencyChange}
          disabled={isSavingCurrency}
        />
      </div>
    </SettingsSection>
  )

  async function handleDisplayCurrencyChange(next) {
    if (next === displayCurrency || isSavingCurrency) return
    const previous = displayCurrency
    setDisplayCurrency(next)
    setIsSavingCurrency(true)
    setSaveError(null)
    try {
      await dispatch(updateDisplayPreferences({ displayCurrency: next })).unwrap()
    } catch (error) {
      setDisplayCurrency(previous)
      setSaveError(typeof error === 'string' ? error : 'Could not save the display currency.')
    } finally {
      setIsSavingCurrency(false)
    }
  }

  const dataReportsCard = (
    <SettingsSection
      title="Data & Reports"
      description="Download a branded PDF of your wallet, transactions, or monthly activity."
    >
      <div className="space-y-3">
        {EXPORT_REPORTS.map((report) => (
          <ActionRow
            key={report.key}
            label={report.label}
            hint={report.hint}
            action={
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={exportingReport !== null}
                onClick={() => handleExportReport(report)}
              >
                <Download className="h-4 w-4" />
                {exportingReport === report.key ? 'Exporting…' : 'Download PDF'}
              </Button>
            }
          />
        ))}
      </div>
    </SettingsSection>
  )

  // Sensitive account actions live apart at the bottom of the pane. The section
  // itself stays plain — only the row is tinted, so the warning is scoped to the
  // action rather than colouring the whole surface. Deactivation is reversible.
  const dangerZoneCard = (
    <SettingsSection
      title="Account status"
      description="Sensitive account actions. Read carefully before continuing."
    >
      <IconRow
        tone="danger"
        label="Deactivate account"
        pill={<StatusPill tone="warning">Reversible</StatusPill>}
        hint="Signs you out and hides your account and cards. Nothing is deleted, and you can restore it later by contacting support."
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
    </SettingsSection>
  )

  const panes = {
    profile: <ProfileSection />,
    security: (
      <div className="space-y-8">
        {recoveryCard}
        {dangerZoneCard}
      </div>
    ),
    notifications: (
      <div className="space-y-8">
        {notificationsCard}
        {privacyCard}
      </div>
    ),
    payment: defaultCardCard,
    data: dataReportsCard,
    preferences: appearanceCard,
  }

  return (
    <div className="w-full max-w-400 space-y-4 sm:space-y-5">
      {/* Section switcher (left rail on desktop, horizontal scroll on mobile) + detail pane.
          The rail sits flat on the page background while the pane is the one elevated
          surface, so the two read as clearly separate areas without nesting a card
          inside a card. The rail is left-aligned under the page hero and the pane takes
          the remaining width, so the row actions stay at the eye's right edge. */}
      <div className="grid items-start gap-4 xl:grid-cols-[220px_minmax(0,1fr)] xl:gap-8">
        <SettingsNav groups={NAV_GROUPS} active={section} onSelect={setSection} />
        <div className="rounded-surface border border-border bg-card p-4 shadow-xs sm:p-6">
          {panes[section]}
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      <DeactivateAccountModal
        isOpen={isDeactivateOpen}
        onClose={() => setIsDeactivateOpen(false)}
      />

      {saveError ? (
        <div
          role="alert"
          className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-10 rounded-surface border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive shadow-xs md:bottom-0"
        >
          {saveError}
        </div>
      ) : null}
    </div>
  )
}
