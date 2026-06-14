import { useState } from 'react'
import { CheckCircle2, KeyRound, Mail, Send, ShieldCheck } from 'lucide-react'

import ActionRow from '@/components/settings/ActionRow'
import SettingRow from '@/components/settings/SettingRow'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import { requestPasswordReset } from '@/services/authService'
import { getApiErrorMessage } from '@/utils/api'

export default function RecoveryMethodPanel({ email, onChangePassword }) {
  const [isSending, setIsSending] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const hasEmail = Boolean(email)

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
      <div className="rounded-surface border border-border bg-emphasis px-4 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-input border border-primary/20 bg-primary/10 text-primary">
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-card-foreground">Email recovery</p>
                <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                  <CheckCircle2 className="h-3 w-3" />
                  Active
                </span>
              </div>
              <p className="mt-1 break-all text-sm font-medium text-card-foreground">
                {hasEmail ? email : 'No account email loaded'}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Reset links are sent to the email address used for sign-in.
              </p>
            </div>
          </div>
          <ShieldCheck className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
        </div>
      </div>

      <ActionRow
        label="Send reset email"
        value="Email link"
        hint="Sends a time-limited password reset link to your account email."
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
        value="Signed in"
        hint="Use this when you know your current password."
        action={
          <Button variant="outline" className="w-full sm:w-auto" onClick={onChangePassword}>
            <KeyRound className="h-4 w-4" />
            Change Password
          </Button>
        }
      />

      <SettingRow
        label="Additional verification"
        value="Not enabled"
        hint="MFA can be added later without changing the current email recovery method."
      />
    </div>
  )
}
