import { useEffect, useState } from 'react'
import { CheckCircle2, Clock3, Mail, X } from 'lucide-react'

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
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

export default function LoginEmailPanel() {
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
    <div className="bg-emphasis rounded-surface border border-border p-4">
      {modalOpen && (
        <ChangeEmailModal
          currentEmail={email}
          onClose={() => setModalOpen(false)}
          onSubmit={handleEmailChange}
        />
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-card-foreground">Login email</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{email ? maskEmail(email) : 'No email loaded'}</p>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-pill border border-border px-2 py-0.5 text-xs font-medium">
              {isVerified ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span className="text-success">Verified</span>
                </>
              ) : (
                <>
                  <Clock3 className="h-3 w-3 text-warning" />
                  <span className="text-warning">Verification required</span>
                </>
              )}
            </div>
            {!isVerified && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Verify this address to unlock payments, cards, and other money actions.
              </p>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          disabled={!user}
          onClick={() => {
            setSuccess('')
            setModalOpen(true)
          }}
        >
          Change email
        </Button>
      </div>

      {success ? (
        <div className="mt-4">
          <FormBanner variant="success" message={success} />
        </div>
      ) : null}
    </div>
  )
}
