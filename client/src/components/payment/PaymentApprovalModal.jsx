import { useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { Modal, ModalTitle } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import FormBanner from '@/components/ui/FormBanner'
import { useAuth } from '@/hooks/useAuth'
import transactionsService from '@/services/transactionsService'
import { DATA_CHANGE_KINDS, emitDataChange } from '@/utils/dataEvents'

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

function formatCountdown(expiresAt) {
  if (!expiresAt) return null
  const end = new Date(expiresAt).getTime()
  const remaining = Math.max(0, end - Date.now())
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export default function PaymentApprovalModal({
  isOpen,
  onClose,
  transaction,
  onApproved,
}) {
  const { user } = useAuth()
  const totpEnabled = user?.totp_enabled ?? false
  const [totpCode, setTotpCode] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(null)

  const transactionId = transaction?.transaction_id ?? transaction?.id
  const expiresAt = transaction?.user_approval_expires_at

  useEffect(() => {
    if (!isOpen) {
      setTotpCode('')
      setPassword('')
      setError('')
      return undefined
    }
    if (!expiresAt) return undefined
    const tick = () => setCountdown(formatCountdown(expiresAt))
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [isOpen, expiresAt])

  async function handleApprove() {
    if (!transactionId || isSubmitting) return
    setError('')
    setIsSubmitting(true)
    try {
      const payload = totpEnabled
        ? { totp_code: totpCode }
        : { password }
      const updated = await transactionsService.approve(transactionId, payload)
      emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
      onApproved?.(updated)
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Approval failed. Check your verification and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canSubmit = totpEnabled
    ? totpCode.length === 6
    : password.length > 0

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="default" className="max-w-sm">
      <div className="px-6 pt-5 pb-6 sm:px-7 sm:pb-7">
        <div className="flex items-start justify-between gap-3">
          <ModalTitle className="text-base font-semibold text-card-foreground">
            Confirm this payment
          </ModalTitle>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-muted/50 text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          This payment is on hold until you verify it&apos;s really you.
        </p>

        <div className="mt-4 rounded-surface bg-muted/40 p-4 ring-1 ring-border">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Amount
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-card-foreground">
            {formatMoney(transaction?.amount)}
          </p>
          {countdown && (
            <p className="mt-2 text-xs text-muted-foreground">
              Expires in <span className="font-mono font-semibold text-foreground">{countdown}</span>
            </p>
          )}
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-card-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            {totpEnabled ? 'Authenticator code' : 'Account password'}
          </div>
          <p className="text-xs text-muted-foreground">
            {totpEnabled
              ? 'Enter the 6-digit code from your authenticator app.'
              : 'Quick identity check with your login password. Turn on two-factor auth in Settings to approve with a code instead.'}
          </p>

          {totpEnabled ? (
            <Input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="max-w-[12rem] font-mono tracking-widest"
              aria-label="Authenticator code"
            />
          ) : (
            <Input
              autoFocus
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="max-w-sm"
              aria-label="Account password"
            />
          )}

          {error && <FormBanner variant="error" message={error} />}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Later
          </Button>
          <Button
            type="button"
            onClick={handleApprove}
            disabled={!canSubmit || isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying…
              </>
            ) : (
              'Approve & settle'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
