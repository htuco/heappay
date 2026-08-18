import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, X } from 'lucide-react'

import IconRow from '@/components/settings/IconRow'
import StatusPill from '@/components/settings/StatusPill'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { getApiErrorMessage } from '@/utils/api'
import { maskEmail } from '@/utils/maskEmail'

function ChangeEmailModal({ currentEmail, onClose, onSubmit }) {
  const [email, setEmail] = useState(currentEmail)
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
      await onSubmit(email.trim())
      onClose()
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not update login email.'))
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
      aria-labelledby="login-email-modal-title"
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
        <h3 id="login-email-modal-title" className="mb-1 pr-8 text-base font-semibold text-card-foreground">
          Change login email
        </h3>
        <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
          We will send a verification link to the new address. Payments and cards stay locked until
          you verify it.
        </p>
        <FormBanner variant="error" message={error} />
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email-input" className="text-sm font-medium text-card-foreground">
              New login email
            </label>
            <Input
              id="login-email-input"
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
              {isSaving ? 'Saving...' : 'Save and send link'}
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

/**
 * The login-email row. Rendered in two places, as the design calls for: under
 * Profile's "Account email" group (with the mail icon) and inside Security's
 * "Password & recovery" (icon-less, with the sign-in hint). Both instances own
 * their own change-email modal, so neither depends on the other.
 */
export default function LoginEmailPanel({ icon, hint }) {
  const { user, updateProfile } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)
  const [success, setSuccess] = useState('')

  const email = user?.email ?? ''
  const isVerified = Boolean(user?.email_verified_at)

  async function handleEmailChange(nextEmail) {
    const normalized = nextEmail.trim().toLowerCase()
    if (!normalized || normalized === email.trim().toLowerCase()) {
      throw new Error('Enter a different email address.')
    }
    await updateProfile({ email: normalized })
    setSuccess(`Verification link sent to ${maskEmail(normalized)}.`)
  }

  return (
    <>
      {modalOpen && (
        <ChangeEmailModal
          currentEmail={email}
          onClose={() => setModalOpen(false)}
          onSubmit={handleEmailChange}
        />
      )}

      <IconRow
        icon={icon}
        label="Login email"
        pill={
          isVerified ? (
            <StatusPill tone="success" icon={CheckCircle2}>
              Verified
            </StatusPill>
          ) : (
            <StatusPill tone="warning" icon={Clock3}>
              Verification required
            </StatusPill>
          )
        }
        detail={email ? maskEmail(email) : 'No email loaded'}
        hint={
          isVerified
            ? hint
            : 'Verify this address to unlock payments, cards, and other money actions.'
        }
        action={
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={!user}
            onClick={() => {
              setSuccess('')
              setModalOpen(true)
            }}
          >
            Change email
          </Button>
        }
      />

      {success ? <FormBanner variant="success" message={success} /> : null}
    </>
  )
}
