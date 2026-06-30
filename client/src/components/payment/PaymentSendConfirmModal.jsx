import { useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Modal, ModalTitle } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FormBanner from '@/components/ui/FormBanner'
import { useAuth } from '@/hooks/useAuth'

function formatMoney(value) {
  const n = Number(value)
  if (!isFinite(n)) return '$0.00'
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function PaymentSendConfirmModal({
  isOpen,
  onClose,
  amount,
  recipientName,
  onConfirm,
}) {
  const { user } = useAuth()
  const totpEnabled = user?.totp_enabled ?? false
  const [totpCode, setTotpCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function handleClose() {
    setTotpCode('')
    setPassword('')
    setError('')
    onClose?.()
  }

  async function handleSubmit() {
    if (isSubmitting) return
    setError('')
    setIsSubmitting(true)
    try {
      const payload = totpEnabled
        ? { totp_code: totpCode }
        : { password }
      await onConfirm?.(payload)
      handleClose()
    } catch (err) {
      setError(err?.message || 'Verification failed. Try again.')
      setTotpCode('')
      setPassword('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = totpEnabled ? totpCode.length === 6 : password.length > 0

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="default" className="max-w-sm">
      <div className="px-6 pt-5 pb-6 sm:px-7 sm:pb-7">
        <div className="flex items-start justify-between gap-3">
          <ModalTitle className="text-base font-semibold text-card-foreground">
            Confirm before sending
          </ModalTitle>
          <button
            type="button"
            onClick={handleClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify it&apos;s you before this payment leaves your account.
        </p>

        <div className="mt-4 rounded-surface bg-muted/40 p-4 ring-1 ring-border">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sending
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-card-foreground">
            {formatMoney(amount)}
          </p>
          {recipientName ? (
            <p className="mt-1 text-sm text-muted-foreground">to {recipientName}</p>
          ) : null}
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-card-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            {totpEnabled ? 'Authenticator code' : 'Account password'}
          </div>
          <p className="text-xs text-muted-foreground">
            {totpEnabled
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Enter your login password to confirm this payment.'}
          </p>

          {totpEnabled ? (
            <Input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={isSubmitting}
              className="max-w-48 font-mono tracking-widest"
              aria-label="Authenticator code"
            />
          ) : (
            <Input
              autoFocus
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
              className="max-w-sm"
              aria-label="Account password"
            />
          )}

          {error ? <FormBanner variant="error" message={error} /> : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              'Confirm & send'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
