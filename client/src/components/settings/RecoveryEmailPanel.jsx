import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, X } from 'lucide-react'

import IconRow from '@/components/settings/IconRow'
import StatusPill from '@/components/settings/StatusPill'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/input'
import {
  addRecoveryEmail,
  changeRecoveryEmail,
  removeRecoveryEmail,
  resendRecoveryEmailVerification,
} from '@/services/authService'
import { strictEmailSchema } from '@/schemas/emailSchema'
import { getApiErrorMessage } from '@/utils/api'
import { maskEmail } from '@/utils/maskEmail'

function EmailModal({ title, subtitle, initialEmail = '', submitLabel, onClose, onSubmit }) {
  const [email, setEmail] = useState(initialEmail)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSaving) return
    setError('')
    const parsed = strictEmailSchema().safeParse(email)
    if (!parsed.success) {
      setError(parsed.error.issues[0].message)
      return
    }
    setIsSaving(true)
    try {
      await onSubmit(parsed.data)
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save recovery email.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-xs"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-email-modal-title"
    >
      <div className="relative w-full max-w-sm rounded-panel border border-border bg-popover p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-pill bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 id="recovery-email-modal-title" className="mb-1 pr-8 text-base font-semibold text-card-foreground">
          {title}
        </h3>
        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        <FormBanner variant="error" message={error} />
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="recovery-email-input" className="text-sm font-medium text-card-foreground">
              Recovery email
            </label>
            <Input
              id="recovery-email-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSaving}
              autoFocus
            />
          </div>
          <div className="flex gap-2 border-t border-border pt-4">
            <Button type="submit" className="flex-1" disabled={isSaving || !email.trim()}>
              {isSaving ? 'Saving...' : submitLabel}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RemoveModal({ totpEnabled, onClose, onRemoved }) {
  const [password, setPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function handleSubmit(event) {
    event.preventDefault()
    if (isSaving) return
    setError('')
    setIsSaving(true)
    try {
      await removeRecoveryEmail(
        totpEnabled
          ? { totpCode }
          : { password },
      )
      onRemoved()
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not remove recovery email.'))
    } finally {
      setIsSaving(false)
    }
  }

  const canSubmit = totpEnabled ? totpCode.length === 6 : password.length > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-xs"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="remove-recovery-email-title"
    >
      <div className="relative w-full max-w-sm rounded-panel border border-border bg-popover p-6 shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-pill bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h3 id="remove-recovery-email-title" className="mb-1 pr-8 text-base font-semibold text-card-foreground">
          Remove recovery email
        </h3>
        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
          Confirm it&apos;s you before removing this address. Password reset and alerts will go back to your login email.
        </p>
        <FormBanner variant="error" message={error} />
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {totpEnabled ? (
            <div className="space-y-1.5">
              <label htmlFor="remove-recovery-totp" className="text-sm font-medium text-card-foreground">
                Authenticator code
              </label>
              <Input
                id="remove-recovery-totp"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={totpCode}
                onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={isSaving}
                className="max-w-48 font-mono tracking-widest"
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="remove-recovery-password" className="text-sm font-medium text-card-foreground">
                Current password
              </label>
              <Input
                id="remove-recovery-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSaving}
                autoFocus
              />
            </div>
          )}
          <div className="flex gap-2 border-t border-border pt-4">
            <Button type="submit" variant="destructive" className="flex-1" disabled={isSaving || !canSubmit}>
              {isSaving ? 'Removing...' : 'Remove'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function RecoveryEmailPanel({
  recoveryEmail,
  recoveryEmailVerified = false,
  totpEnabled = false,
  onStatusChange,
}) {
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [modal, setModal] = useState(null)
  const [isResending, setIsResending] = useState(false)

  const hasRecovery = Boolean(recoveryEmail)
  const isPending = hasRecovery && !recoveryEmailVerified
  const displayEmail = hasRecovery ? maskEmail(recoveryEmail) : null

  async function handleAddOrChange(email) {
    if (hasRecovery) {
      await changeRecoveryEmail({ email })
      setSuccess('Verification link sent to your new recovery email.')
    } else {
      await addRecoveryEmail({ email })
      setSuccess('Verification link sent. Check your recovery inbox.')
    }
    setError('')
    onStatusChange?.()
  }

  async function handleResend() {
    if (isResending) return
    setSuccess('')
    setError('')
    setIsResending(true)
    try {
      await resendRecoveryEmailVerification()
      setSuccess('Verification link resent.')
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not resend verification email.'))
    } finally {
      setIsResending(false)
    }
  }

  function handleRemoved() {
    setSuccess('Recovery email removed.')
    setError('')
    onStatusChange?.()
  }

  return (
    <>
      {modal === 'email' && (
        <EmailModal
          title={hasRecovery ? 'Change recovery email' : 'Add recovery email'}
          subtitle="Must be different from your login email. We will send a verification link."
          initialEmail={hasRecovery ? recoveryEmail : ''}
          submitLabel={hasRecovery ? 'Send verification link' : 'Add recovery email'}
          onClose={() => setModal(null)}
          onSubmit={handleAddOrChange}
        />
      )}
      {modal === 'remove' && (
        <RemoveModal
          totpEnabled={totpEnabled}
          onClose={() => setModal(null)}
          onRemoved={handleRemoved}
        />
      )}

      <FormBanner variant="success" message={success} />
      <FormBanner variant="error" message={error} />

      <IconRow
        label="Recovery email"
        pill={
          hasRecovery ? (
            recoveryEmailVerified ? (
              <StatusPill tone="success" icon={CheckCircle2}>
                Verified
              </StatusPill>
            ) : (
              <StatusPill tone="warning" icon={Clock3}>
                Pending verification
              </StatusPill>
            )
          ) : (
            <StatusPill>None set</StatusPill>
          )
        }
        detail={hasRecovery ? displayEmail : undefined}
        hint={
          !hasRecovery
            ? 'A separate inbox you can reach if your login email is unavailable.'
            : isPending
              ? 'Until verified, this address is not used for password reset or alerts.'
              : 'Used for password reset and account alerts. Your login email stays the same.'
        }
        action={
          !hasRecovery ? (
            <Button className="w-full sm:w-auto" onClick={() => setModal('email')}>
              Add recovery email
            </Button>
          ) : (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setModal('email')}>
                Change
              </Button>
              {isPending ? (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={handleResend}
                  disabled={isResending}
                >
                  {isResending ? 'Sending...' : 'Resend link'}
                </Button>
              ) : null}
              <Button
                variant="destructive"
                className="w-full sm:w-auto"
                onClick={() => setModal('remove')}
              >
                Remove
              </Button>
            </div>
          )
        }
      />
    </>
  )
}
