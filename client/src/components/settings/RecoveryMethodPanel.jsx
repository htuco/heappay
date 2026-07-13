import { useState } from 'react'
import { CheckCircle2, KeyRound, Mail, Send, ShieldCheck, Wallet } from 'lucide-react'

import RecoveryEmailPanel from '@/components/settings/RecoveryEmailPanel'
import ActionRow from '@/components/settings/ActionRow'
import AppPinPanel from '@/components/settings/AppPinPanel'
import BiometricPanel from '@/components/settings/BiometricPanel'
import PaymentConfirmPanel from '@/components/settings/PaymentConfirmPanel'
import SettingsSubsection from '@/components/settings/SettingsSubsection'
import TwoFactorPanel from '@/components/settings/TwoFactorPanel'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import { requestPasswordReset } from '@/services/authService'
import { getApiErrorMessage } from '@/utils/api'

export default function RecoveryMethodPanel({
  email,
  recoveryEmail,
  recoveryEmailVerified = false,
  onRecoveryEmailChange,
  onChangePassword,
  totpEnabled = false,
  onTotpStatusChange,
  paymentConfirmEnabled = true,
  paymentConfirmAboveAmount = '0',
  onPaymentConfirmEnabledChange,
  onPaymentConfirmAboveAmountChange,
  paymentPrefsDisabled = false,
}) {
  const [isSending, setIsSending] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [openSection, setOpenSection] = useState(null)
  const hasEmail = Boolean(email)

  // Accordion: opening a section collapses the others; toggling the open one closes it.
  const toggleSection = (section) => (next) => setOpenSection(next ? section : null)

  async function handleSendResetEmail() {
    if (!hasEmail || isSending) return
    setSuccess('')
    setError('')
    setIsSending(true)
    try {
      const response = await requestPasswordReset({ email })
      setSuccess(response.message || 'If the email exists, a password reset link has been sent.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not send password reset email.'))
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="space-y-3">
      <FormBanner variant="success" message={success} />
      <FormBanner variant="error" message={error} />

      <SettingsSubsection
        title="Password & recovery"
        icon={KeyRound}
        description="How you sign back in if you forget your password."
        open={openSection === 'recovery'}
        onToggle={toggleSection('recovery')}
      >
        <div className="rounded-surface border border-border bg-emphasis px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-primary/20 bg-primary/10 text-primary">
                <Mail className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-card-foreground">Login email</p>
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                    <CheckCircle2 className="h-3 w-3" />
                    Sign-in
                  </span>
                </div>
                <p className="mt-1 break-all text-sm font-medium text-card-foreground">
                  {hasEmail ? email : 'No account email loaded'}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Used to sign in. Password reset goes to your verified recovery email when set.
                </p>
              </div>
            </div>
            <ShieldCheck className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
          </div>
        </div>

        <RecoveryEmailPanel
          recoveryEmail={recoveryEmail}
          recoveryEmailVerified={recoveryEmailVerified}
          totpEnabled={totpEnabled}
          onStatusChange={onRecoveryEmailChange}
        />

        <ActionRow
          label="Send reset email"
          hint="Sends a password reset link to your verified recovery email, or login email if none is set."
          action={
            <Button
              className="w-full sm:w-auto"
              onClick={handleSendResetEmail}
              disabled={!hasEmail || isSending}
            >
              <Send className="h-4 w-4" />
              {isSending ? 'Sending...' : 'Send Reset Email'}
            </Button>
          }
        />

        <ActionRow
          label="Change current password"
          hint="Use this when you know your current password."
          action={
            <Button variant="outline" className="w-full sm:w-auto" onClick={onChangePassword}>
              <KeyRound className="h-4 w-4" />
              Change Password
            </Button>
          }
        />
      </SettingsSubsection>

      <SettingsSubsection
        title="Verification methods"
        icon={ShieldCheck}
        description="Ways to prove it's you at login and when approving payments."
        open={openSection === 'verification'}
        onToggle={toggleSection('verification')}
      >
        <TwoFactorPanel enabled={totpEnabled} onStatusChange={onTotpStatusChange ?? (() => {})} />
        <BiometricPanel />
        <AppPinPanel />
      </SettingsSubsection>

      <SettingsSubsection
        title="Payment confirmation"
        icon={Wallet}
        description="When to require one of the methods above before money leaves your account."
        open={openSection === 'payment'}
        onToggle={toggleSection('payment')}
      >
        <PaymentConfirmPanel
          enabled={paymentConfirmEnabled}
          aboveAmount={paymentConfirmAboveAmount}
          onEnabledChange={onPaymentConfirmEnabledChange}
          onAboveAmountChange={onPaymentConfirmAboveAmountChange}
          disabled={paymentPrefsDisabled}
        />
      </SettingsSubsection>
    </div>
  )
}
