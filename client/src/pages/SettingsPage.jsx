import { useEffect, useRef, useState } from 'react'
import { Bell, CreditCard, Download, FileDown, KeyRound, Paintbrush, SlidersHorizontal, TriangleAlert, UserRound, WalletCards } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAppDispatch } from '@/store/hooks'
import { refreshSession, updateNotificationPreferences, updatePaymentSecurityPreferences } from '@/store/slices/authSlice'

import { useWalletCards } from '@/hooks/useWalletCards'

import ChangePasswordModal from '@/components/settings/ChangePasswordModal'
import DeactivateAccountModal from '@/components/settings/DeactivateAccountModal'
import ActionRow from '@/components/settings/ActionRow'
import ControlRow from '@/components/settings/ControlRow'
import OptionGroup from '@/components/settings/OptionGroup'
import RecoveryMethodPanel from '@/components/settings/RecoveryMethodPanel'
import SettingsCard from '@/components/settings/SettingsCard'
import ProfileSection from '@/components/settings/ProfileSection'
import Toggle from '@/components/settings/Toggle'
import DefaultCardPicker from '@/components/settings/DefaultCardPicker'
import SettingsNav from '@/components/settings/SettingsNav'
import AllCardsModal from '@/components/wallet/AllCardsModal'
import { Button } from '@/components/ui/button'
import { exportService } from '@/services/exportService'
import { maskEmail } from '@/utils/maskEmail'
import { useNotifications } from '@/context/NotificationContext'

const NAV_ITEMS = [
  { id: 'profile', label: 'Profile', description: 'Personal information', icon: UserRound },
  { id: 'security', label: 'Security', description: 'Password and 2FA', icon: KeyRound },
  { id: 'notifications', label: 'Notifications', description: 'Email and in-app', icon: Bell },
  { id: 'payment', label: 'Payment methods', description: 'Cards and defaults', icon: CreditCard },
  { id: 'data', label: 'Data & reports', description: 'Export PDFs', icon: FileDown },
  { id: 'preferences', label: 'Preferences', description: 'Appearance and theme', icon: SlidersHorizontal },
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
  const { notify } = useNotifications()
  const [exportingReport, setExportingReport] = useState(null)

  // Auto-save model: preferences are mirrored locally for instant feedback, the
  // change is applied optimistically, and the update is dispatched right away.
  // On failure we roll back to the last saved value and surface the error.
  const [notifPrefs, setNotifPrefs] = useState(() => savedNotificationPrefs(user))
  const [paymentPrefs, setPaymentPrefs] = useState(() => savedPaymentSecurityPrefs(user))
  const [saveError, setSaveError] = useState(null)

  // Re-sync the local mirror when the server-side user record changes (login,
  // refresh, save landing). Render-time adjustment keyed on user identity;
  // avoids the setState-in-effect cascade while still reacting to new data.
  const [syncedUserId, setSyncedUserId] = useState(user?.id ?? null)
  if (user && user.id !== syncedUserId) {
    setSyncedUserId(user.id)
    setNotifPrefs(savedNotificationPrefs(user))
    setPaymentPrefs(savedPaymentSecurityPrefs(user))
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
    <SettingsCard
      title="Default Card"
      icon={CreditCard}
      description="The card pre-selected for Top Up, Pay, and Transfer actions."
    >
      <DefaultCardPicker cards={cards} onSelect={setMainCard} />
      {cards.length > 0 && (
        <div className="mt-4 flex flex-col gap-4 rounded-surface border border-border bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-border bg-muted/40 text-muted-foreground">
              <WalletCards className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-card-foreground">Manage your cards</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Set your main card, remove a card, or request a freeze if one is lost or stolen.
              </p>
            </div>
          </div>
          <div className="w-full shrink-0 sm:w-auto">
            <AllCardsModal
              items={cards}
              triggerLabel="Manage cards"
              triggerVariant="outline"
              triggerClassName="w-full border-border/80 bg-background/90 shadow-sm hover:bg-muted dark:border-white/20 dark:bg-card/70 dark:hover:border-white/30 dark:hover:bg-card sm:w-auto"
              onSetMain={setMainCard}
              onRemove={removeCard}
            />
          </div>
        </div>
      )}
    </SettingsCard>
  )

  const recoveryCard = (
    <SettingsCard
      title="Security & Recovery"
      icon={KeyRound}
      description="Passwords, two-factor authentication, and the methods used to recover your account."
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
    </SettingsCard>
  )

  const notificationRows = [
    { key: 'emailPaymentSent', label: 'Payment sent', hint: 'Email when money you send completes.', emphasize: true },
    { key: 'emailPaymentReceived', label: 'Payment received', hint: 'Email when you receive a transfer.' },
    { key: 'emailTopup', label: 'Top-up', hint: 'Email when a card top-up completes.' },
    { key: 'emailRefundStatus', label: 'Refund status', hint: 'Email when a refund request is approved or declined.' },
    { key: 'billingReminders', label: 'Billing reminders', hint: 'Renewal reminders and recurring payment confirmations.' },
  ]

  const notificationsCard = (
    <SettingsCard
      title="Notification Preferences"
      icon={Bell}
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
    </SettingsCard>
  )

  const appearanceCard = (
    <SettingsCard
      title="Appearance"
      icon={Paintbrush}
      description="How the app looks on this device."
    >
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
    </SettingsCard>
  )

  const dataReportsCard = (
    <SettingsCard
      title="Data & Reports"
      icon={FileDown}
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
                className="w-full gap-1.5 sm:w-auto"
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
    </SettingsCard>
  )

  // Sensitive account actions live apart at the bottom of the pane, but the card
  // blends with the rest of settings, only the status pill and button carry the
  // accent color, not the whole surface. Deactivation is reversible.
  const dangerZoneCard = (
    <SettingsCard
      title="Account status"
      icon={TriangleAlert}
      description="Sensitive account actions. Read carefully before continuing."
    >
      <div className="flex flex-col gap-4 rounded-surface border border-border bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-card-foreground">Deactivate account</p>
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              Reversible
            </span>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Signs you out and hides your account and cards. Nothing is deleted, and you can
            restore it later by contacting support.
          </p>
        </div>
        <Button
          variant="destructive"
          className="w-full shrink-0 sm:w-auto"
          onClick={() => setIsDeactivateOpen(true)}
        >
          Deactivate
        </Button>
      </div>
    </SettingsCard>
  )

  const panes = {
    profile: <ProfileSection />,
    security: (
      <div className="space-y-4">
        {recoveryCard}
        {dangerZoneCard}
      </div>
    ),
    notifications: notificationsCard,
    payment: defaultCardCard,
    data: dataReportsCard,
    preferences: appearanceCard,
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 sm:space-y-5">
      {/* Section switcher (left rail on desktop, horizontal scroll on mobile) + detail pane. */}
      <div className="grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)] xl:gap-6">
        <div className="xl:rounded-surface xl:border xl:border-border xl:bg-card xl:p-3 xl:shadow-xs">
          <SettingsNav items={NAV_ITEMS} active={section} onSelect={setSection} />
        </div>
        <div>{panes[section]}</div>
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
