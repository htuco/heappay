import { useEffect, useMemo, useState } from 'react'
import { Bell, CreditCard, Eye, KeyRound, Paintbrush } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useAppDispatch } from '@/store/hooks'
import { refreshSession, updateNotificationPreferences, updatePaymentSecurityPreferences } from '@/store/slices/authSlice'

import { useWalletCards } from '@/hooks/useWalletCards'

import ActionRow from '@/components/settings/ActionRow'
import ChangePasswordModal from '@/components/settings/ChangePasswordModal'
import DeactivateAccountModal from '@/components/settings/DeactivateAccountModal'
import ControlRow from '@/components/settings/ControlRow'
import OptionGroup from '@/components/settings/OptionGroup'
import RecoveryMethodPanel from '@/components/settings/RecoveryMethodPanel'
import SettingsCard from '@/components/settings/SettingsCard'
import ProfileSection from '@/components/settings/ProfileSection'
import SettingsHero from '@/components/settings/SettingsHero'
import Toggle from '@/components/settings/Toggle'
import DefaultCardPicker from '@/components/settings/DefaultCardPicker'
import AllCardsModal from '@/components/wallet/AllCardsModal'
import { Button } from '@/components/ui/button'

import { maskEmail } from '@/utils/maskEmail'

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
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false)
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false)
  const { user } = useAuth()
  const { cards, setMainCard, removeCard } = useWalletCards()
  const { preference: themePreference, isDark, setTheme } = useTheme()

  const [draftBillingReminders, setDraftBillingReminders] = useState(true)
  const [draftEmailPaymentSent, setDraftEmailPaymentSent] = useState(true)
  const [draftEmailPaymentReceived, setDraftEmailPaymentReceived] = useState(true)
  const [draftEmailTopup, setDraftEmailTopup] = useState(true)
  const [draftEmailRefundStatus, setDraftEmailRefundStatus] = useState(true)
  const [draftPaymentConfirmEnabled, setDraftPaymentConfirmEnabled] = useState(true)
  const [draftPaymentConfirmAboveAmount, setDraftPaymentConfirmAboveAmount] = useState('0')
  const [savePending, setSavePending] = useState(false)
  const [saveError, setSaveError] = useState(null)

  useEffect(() => {
    if (user) {
      const saved = savedNotificationPrefs(user)
      setDraftBillingReminders(saved.billingReminders)
      setDraftEmailPaymentSent(saved.emailPaymentSent)
      setDraftEmailPaymentReceived(saved.emailPaymentReceived)
      setDraftEmailTopup(saved.emailTopup)
      setDraftEmailRefundStatus(saved.emailRefundStatus)
      const paymentPrefs = savedPaymentSecurityPrefs(user)
      setDraftPaymentConfirmEnabled(paymentPrefs.paymentConfirmEnabled)
      setDraftPaymentConfirmAboveAmount(paymentPrefs.paymentConfirmAboveAmount)
    }
  }, [user])

  const saved = useMemo(() => savedNotificationPrefs(user), [user])
  const savedPayment = useMemo(() => savedPaymentSecurityPrefs(user), [user])

  const isBillingDirty = useMemo(
    () =>
      Boolean(user) &&
      (draftBillingReminders !== saved.billingReminders ||
        draftEmailPaymentSent !== saved.emailPaymentSent ||
        draftEmailPaymentReceived !== saved.emailPaymentReceived ||
        draftEmailTopup !== saved.emailTopup ||
        draftEmailRefundStatus !== saved.emailRefundStatus),
    [
      user,
      draftBillingReminders,
      draftEmailPaymentSent,
      draftEmailPaymentReceived,
      draftEmailTopup,
      draftEmailRefundStatus,
      saved,
    ],
  )
  const isPaymentSecurityDirty = useMemo(
    () =>
      Boolean(user) &&
      (draftPaymentConfirmEnabled !== savedPayment.paymentConfirmEnabled ||
        draftPaymentConfirmAboveAmount !== savedPayment.paymentConfirmAboveAmount),
    [user, draftPaymentConfirmEnabled, draftPaymentConfirmAboveAmount, savedPayment],
  )
  const isDirty = isBillingDirty || isPaymentSecurityDirty

  function handleDiscard() {
    if (user) {
      const next = savedNotificationPrefs(user)
      setDraftBillingReminders(next.billingReminders)
      setDraftEmailPaymentSent(next.emailPaymentSent)
      setDraftEmailPaymentReceived(next.emailPaymentReceived)
      setDraftEmailTopup(next.emailTopup)
      setDraftEmailRefundStatus(next.emailRefundStatus)
      const paymentPrefs = savedPaymentSecurityPrefs(user)
      setDraftPaymentConfirmEnabled(paymentPrefs.paymentConfirmEnabled)
      setDraftPaymentConfirmAboveAmount(paymentPrefs.paymentConfirmAboveAmount)
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
          updateNotificationPreferences({
            billingRemindersEnabled: draftBillingReminders,
            emailPaymentSentEnabled: draftEmailPaymentSent,
            emailPaymentReceivedEnabled: draftEmailPaymentReceived,
            emailTopupEnabled: draftEmailTopup,
            emailRefundStatusEnabled: draftEmailRefundStatus,
          }),
        ).unwrap()
      }
      if (isPaymentSecurityDirty && user) {
        await dispatch(
          updatePaymentSecurityPreferences({
            paymentConfirmEnabled: draftPaymentConfirmEnabled,
            paymentConfirmAboveAmount: draftPaymentConfirmAboveAmount,
          }),
        ).unwrap()
      }
    } catch (err) {
      setSaveError(typeof err === 'string' ? err : 'Could not save your settings.')
    } finally {
      setSavePending(false)
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
          {cards.length > 0 && (
            <div className="mt-4 border-t border-border/60 pt-4">
              <AllCardsModal
                items={cards}
                triggerLabel="Manage cards"
                triggerVariant="outline"
                onSetMain={setMainCard}
                onRemove={removeCard}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Set your main card, remove a card, or request a freeze if a card is lost or stolen.
              </p>
            </div>
          )}
        </SettingsCard>

        <SettingsCard
          title="Account Recovery"
          icon={KeyRound}
          description="Login email, recovery email, password reset, and payment security."
        >
          <RecoveryMethodPanel
            email={user?.email}
            recoveryEmail={user?.recovery_email}
            recoveryEmailVerified={user?.recovery_email_verified ?? false}
            onRecoveryEmailChange={() => dispatch(refreshSession())}
            onChangePassword={() => setIsChangePasswordOpen(true)}
            totpEnabled={user?.totp_enabled ?? false}
            onTotpStatusChange={() => dispatch(refreshSession())}
            paymentConfirmEnabled={draftPaymentConfirmEnabled}
            paymentConfirmAboveAmount={draftPaymentConfirmAboveAmount}
            onPaymentConfirmEnabledChange={setDraftPaymentConfirmEnabled}
            onPaymentConfirmAboveAmountChange={setDraftPaymentConfirmAboveAmount}
            paymentPrefsDisabled={!user || savePending}
          />
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
          description="Email notices for payments and refunds, plus in-app billing reminders. Use Save changes below to update your account."
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
            <ControlRow
              label="Payment sent"
              hint="Email when money you send completes."
              emphasize
              alignToggle
            >
              <Toggle
                compact
                enabled={draftEmailPaymentSent}
                label={draftEmailPaymentSent ? 'Enabled' : 'Disabled'}
                onToggle={() => setDraftEmailPaymentSent((current) => !current)}
                disabled={!user || savePending}
              />
            </ControlRow>
            <ControlRow
              label="Payment received"
              hint="Email when you receive a transfer."
              alignToggle
            >
              <Toggle
                compact
                enabled={draftEmailPaymentReceived}
                label={draftEmailPaymentReceived ? 'Enabled' : 'Disabled'}
                onToggle={() => setDraftEmailPaymentReceived((current) => !current)}
                disabled={!user || savePending}
              />
            </ControlRow>
            <ControlRow
              label="Top-up"
              hint="Email when a card top-up completes."
              alignToggle
            >
              <Toggle
                compact
                enabled={draftEmailTopup}
                label={draftEmailTopup ? 'Enabled' : 'Disabled'}
                onToggle={() => setDraftEmailTopup((current) => !current)}
                disabled={!user || savePending}
              />
            </ControlRow>
            <ControlRow
              label="Refund status"
              hint="Email when a refund request is approved or declined."
              alignToggle
            >
              <Toggle
                compact
                enabled={draftEmailRefundStatus}
                label={draftEmailRefundStatus ? 'Enabled' : 'Disabled'}
                onToggle={() => setDraftEmailRefundStatus((current) => !current)}
                disabled={!user || savePending}
              />
            </ControlRow>
            <ControlRow
              label="Billing reminders"
              hint="Renewal reminders and recurring payment confirmations."
              alignToggle
            >
              <Toggle
                compact
                enabled={draftBillingReminders}
                label={draftBillingReminders ? 'Enabled' : 'Disabled'}
                onToggle={() => setDraftBillingReminders((current) => !current)}
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
          description="Control how the app looks. Changes apply immediately on this device."
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
                active={formatPreference(themePreference)}
                onSelect={(label) => setTheme(label.toLowerCase())}
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
              hint="Disables your account and signs you out."
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
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] z-10 rounded-surface border border-border bg-card/95 p-3 shadow-xs backdrop-blur sm:p-4 md:bottom-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-card-foreground">Unsaved changes</p>
              <p className="text-xs text-muted-foreground">
                {isBillingDirty && isPaymentSecurityDirty
                  ? 'Account preferences will sync to your account when you save.'
                  : isBillingDirty
                    ? 'Notification preferences will sync to your account when you save.'
                    : 'Payment security preferences will sync to your account when you save.'}
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
                disabled={savePending || ((isBillingDirty || isPaymentSecurityDirty) && !user)}
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
