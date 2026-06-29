import { useEffect, useState } from 'react'
import { Fingerprint, Loader2, ShieldCheck } from 'lucide-react'
import { Modal, ModalTitle } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import AppPinPad from '@/components/payment/AppPinPad'
import { getBiometricStatus } from '@/services/authService'
import transactionsService from '@/services/transactionsService'
import { DATA_CHANGE_KINDS, emitDataChange } from '@/utils/dataEvents'
import { getBiometricAssertion, isWebAuthnAssertionAvailable } from '@/utils/webauthn'

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
  const [pin, setPin] = useState('')
  const [biometricEnabled, setBiometricEnabled] = useState(false)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isBiometricSubmitting, setIsBiometricSubmitting] = useState(false)
  const [countdown, setCountdown] = useState(null)

  const transactionId = transaction?.transaction_id ?? transaction?.id
  const expiresAt = transaction?.user_approval_expires_at

  useEffect(() => {
    if (!isOpen) {
      setPin('')
      setError('')
      return undefined
    }
    if (!expiresAt) return undefined
    const tick = () => setCountdown(formatCountdown(expiresAt))
    tick()
    const interval = window.setInterval(tick, 1000)
    return () => window.clearInterval(interval)
  }, [isOpen, expiresAt])

  useEffect(() => {
    let ignore = false

    async function loadBiometricStatus() {
      if (!isOpen) return
      try {
        const status = await getBiometricStatus()
        if (!ignore) {
          setBiometricEnabled(Boolean(status.enabled))
        }
      } catch {
        if (!ignore) {
          setBiometricEnabled(false)
        }
      }
    }

    loadBiometricStatus()
    return () => {
      ignore = true
    }
  }, [isOpen])

  async function handleApprove() {
    if (!transactionId || isSubmitting) return
    setError('')
    setIsSubmitting(true)
    try {
      const updated = await transactionsService.approve(transactionId, { app_pin: pin })
      emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
      onApproved?.(updated)
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Approval failed. Check your verification and try again.')
      setPin('')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleBiometricApprove() {
    if (!transactionId || isBiometricSubmitting) return
    setError('')

    if (!window.HeapNativeBiometrics?.getAssertion && !isWebAuthnAssertionAvailable()) {
      setError('Biometric authentication is not available on this device or browser.')
      return
    }

    setIsBiometricSubmitting(true)
    try {
      const options = await transactionsService.beginBiometricApproval(transactionId)
      const credential = await getBiometricAssertion(options.publicKey)
      const updated = await transactionsService.approve(transactionId, {
        biometric: {
          challenge_id: options.challenge_id,
          credential,
        },
      })
      emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
      onApproved?.(updated)
      onClose?.()
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        setError('Biometric verification was cancelled or timed out. Use a fallback method or try again.')
      } else {
        setError(err?.message || 'Biometric approval failed. Use a fallback method or try again.')
      }
    } finally {
      setIsBiometricSubmitting(false)
    }
  }

  const isBusy = isSubmitting || isBiometricSubmitting

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
          {biometricEnabled && (
            <div className="rounded-surface border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-input bg-primary/10 text-primary">
                  <Fingerprint className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-card-foreground">Use Face ID / fingerprint</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Confirm it&apos;s you with the biometric credential enrolled in Settings.
                  </p>
                  <Button
                    type="button"
                    className="mt-3 w-full"
                    onClick={handleBiometricApprove}
                    disabled={isBusy}
                    aria-busy={isBiometricSubmitting}
                  >
                    {isBiometricSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Waiting for biometric…
                      </>
                    ) : (
                      <>
                        <Fingerprint className="mr-2 h-4 w-4" />
                        Approve with biometrics
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm font-medium text-card-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            {biometricEnabled ? 'Fallback app PIN' : 'App PIN'}
          </div>
          <p className="text-xs text-muted-foreground">
            {biometricEnabled
              ? 'If biometrics are unavailable, use your separate payment PIN.'
              : 'Enter your 4-digit app PIN to approve this payment.'}
          </p>

          <AppPinPad
            value={pin}
            onChange={setPin}
            onSubmit={handleApprove}
            isSubmitting={isSubmitting}
            error={error}
            title="Enter app PIN"
            subtitle="Use your 4-digit payment PIN to approve this transfer."
            submitLabel="Approve & settle"
          />
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
            Later
          </Button>
        </div>
      </div>
    </Modal>
  )
}
