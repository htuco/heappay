import { useState } from 'react'
import { KeyRound, ShieldCheck, Wallet } from 'lucide-react'

import RecoveryEmailPanel from '@/components/settings/RecoveryEmailPanel'
import AppPinPanel from '@/components/settings/AppPinPanel'
import BiometricPanel from '@/components/settings/BiometricPanel'
import IconRow from '@/components/settings/IconRow'
import LoginEmailPanel from '@/components/settings/LoginEmailPanel'
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
        <LoginEmailPanel hint="Used to sign in. Password reset goes to your recovery email when set." />

        <RecoveryEmailPanel
          recoveryEmail={recoveryEmail}
          recoveryEmailVerified={recoveryEmailVerified}
          totpEnabled={totpEnabled}
          onStatusChange={onRecoveryEmailChange}
        />

        <IconRow
          label="Password"
          hint="Use this when you know your current password."
          action={
            <Button variant="outline" className="w-full sm:w-auto" onClick={onChangePassword}>
              Change password
            </Button>
          }
        />

        <IconRow
          label="Send reset email"
          hint="Sends a reset link to your recovery email, or login email if none is set."
          action={
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleSendResetEmail}
              disabled={!hasEmail || isSending}
            >
              {isSending ? 'Sending...' : 'Send reset email'}
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
