import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, HandCoins, Loader2, X } from 'lucide-react'

import UserAvatar from '@/components/ui/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import FormBanner from '@/components/ui/FormBanner'
import { Modal, ModalTitle } from '@/components/ui/modal'
import AppPinPad from '@/components/payment/AppPinPad'
import PaymentApprovalModal from '@/components/payment/PaymentApprovalModal'
import PaymentSendConfirmModal from '@/components/payment/PaymentSendConfirmModal'
import { CardOption } from '@/components/payment/wizardPrimitives'
import { timeAgo } from '@/components/notifications/timeUtils'
import { useAuth } from '@/hooks/useAuth'
import { useCardBrandResolver } from '@/hooks/useCardBrandResolver'
import { useNotifications } from '@/context/NotificationContext'
import { CATEGORIES } from '@/context/notifications/categories'
import { getAppPinStatus, getBiometricStatus } from '@/services/authService'
import { listCards } from '@/services/cardsService'
import transactionsService from '@/services/transactionsService'
import { DATA_CHANGE_KINDS, emitDataChange, subscribeDataChange } from '@/utils/dataEvents'
import { formatMoney } from '@/utils/amount'
import { getBiometricAssertion, isWebAuthnAssertionAvailable } from '@/utils/webauthn'
import { paymentConfirmationLabel, userRequiresPaymentConfirmation } from '@/utils/paymentSecurity'

function requesterLabel(req) {
  return (
    req?.money_request_detail?.requester_name ||
    req?.requester_name ||
    'Someone'
  )
}

function RequestCard({ req, onPay, onDecline, isBusy }) {
  const name = requesterLabel(req)
  const amount = req.money_request_detail?.amount
  const nameParts = name.split(' ')

  return (
    <div className="relative overflow-hidden rounded-card border border-border bg-card py-3.5 pl-5 pr-4 shadow-sm transition-shadow hover:shadow-md">
      <span className="absolute inset-y-0 left-0 w-1.5 bg-warning" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <UserAvatar
            user={{
              first_name: nameParts[0],
              last_name: nameParts.slice(1).join(' '),
            }}
            className="size-10 text-sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-card-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {req.note || 'Requested money from you'}
              {req.created_at ? ` · ${timeAgo(new Date(req.created_at).getTime())}` : ''}
            </p>
          </div>
        </div>
        <p className="shrink-0 tabular-nums text-sm font-bold text-card-foreground">
          {formatMoney(amount)}
        </p>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isBusy}
          onClick={() => onDecline(req)}
        >
          Decline
        </Button>
        <Button type="button" size="sm" disabled={isBusy} onClick={() => onPay(req)}>
          Pay
        </Button>
      </div>
    </div>
  )
}

export default function IncomingMoneyRequests() {
  const { user } = useAuth()
  const { notify } = useNotifications()
  const { maskCard, resolveBrand } = useCardBrandResolver()

  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const [payTarget, setPayTarget] = useState(null)
  const [cards, setCards] = useState([])
  const [senderCardId, setSenderCardId] = useState(null)
  const [payError, setPayError] = useState('')
  const [isPaying, setIsPaying] = useState(false)

  const [pinConfirmOpen, setPinConfirmOpen] = useState(false)
  const [sendConfirmOpen, setSendConfirmOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [pinSubtitle, setPinSubtitle] = useState('Enter your app PIN to send this payment.')
  const [isPinSubmitting, setIsPinSubmitting] = useState(false)
  const [pendingApprovalTx, setPendingApprovalTx] = useState(null)
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const page = await transactionsService.listIncomingMoneyRequests({
        page: 1,
        pageSize: 20,
      })
      setItems(Array.isArray(page?.items) ? page.items : [])
      setLoadError('')
    } catch (err) {
      setLoadError(err?.message || "Couldn't load money requests.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(
    () =>
      subscribeDataChange((kind) => {
        if (
          kind === DATA_CHANGE_KINDS.MONEY_REQUEST ||
          kind === DATA_CHANGE_KINDS.TRANSACTION
        ) {
          refresh()
        }
      }),
    [refresh]
  )

  function closePayModal() {
    if (isPaying || isPinSubmitting) return
    setPayTarget(null)
    setPayError('')
    setPinConfirmOpen(false)
    setSendConfirmOpen(false)
  }

  async function openPay(req) {
    setPayTarget(req)
    setPayError('')
    setSenderCardId(null)
    try {
      const rawCards = await listCards({ user_id: user?.id, limit: 100 })
      const list = (Array.isArray(rawCards) ? rawCards : []).filter((c) => !c.deleted_at)
      setCards(list)
      const main = list.find((c) => c.is_main) ?? list[0]
      setSenderCardId(main?.card_id ?? null)
    } catch {
      setCards([])
      setPayError('Could not load your cards.')
    }
  }

  async function handleDecline(req) {
    if (busyId) return
    setBusyId(req.request_id)
    try {
      await transactionsService.declineMoneyRequest(req.request_id)
      notify({
        type: 'info',
        category: CATEGORIES.MONEY_REQUEST_RECEIVED,
        message: `Declined ${requesterLabel(req)}'s request for ${formatMoney(req.money_request_detail?.amount)}.`,
        link: { route: '/transactions' },
      })
      emitDataChange(DATA_CHANGE_KINDS.MONEY_REQUEST)
      await refresh()
    } catch (err) {
      notify({
        type: 'error',
        category: CATEGORIES.SYSTEM,
        message: err?.message || 'Could not decline this request.',
      })
    } finally {
      setBusyId(null)
    }
  }

  async function getCreateBiometricPayload() {
    const status = await getBiometricStatus()
    if (!status.enabled) return null
    if (!window.HeapNativeBiometrics?.getAssertion && !isWebAuthnAssertionAvailable()) {
      throw new Error('Biometric authentication is not available on this device or browser.')
    }
    const options = await transactionsService.beginBiometricTransactionVerification()
    const credential = await getBiometricAssertion(options.publicKey)
    return { challenge_id: options.challenge_id, credential }
  }

  async function submitPay(confirmation = {}) {
    const amount = payTarget?.money_request_detail?.amount
    const created = await transactionsService.payMoneyRequest(payTarget.request_id, {
      sender_card_id: senderCardId,
      ...confirmation,
    })

    if (created?.money_request_detail?.requires_user_approval) {
      setPendingApprovalTx({
        transaction_id: created.money_request_detail.settled_transaction_id,
        amount: created.money_request_detail.amount,
        user_approval_expires_at: created.money_request_detail.user_approval_expires_at,
        requires_user_approval: true,
      })
      setApprovalModalOpen(true)
      setPayTarget(null)
      return
    }

    notify({
      type: 'success',
      category: CATEGORIES.PAYMENT_SENT,
      message: `${formatMoney(amount)} sent to ${requesterLabel(payTarget)}.`,
      link: created?.money_request_detail?.settled_transaction_id
        ? { route: '/transactions', modal: { kind: 'transaction', id: created.money_request_detail.settled_transaction_id } }
        : { route: '/transactions' },
    })
    emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
    emitDataChange(DATA_CHANGE_KINDS.MONEY_REQUEST)
    setPayTarget(null)
    await refresh()
  }

  async function startPay() {
    if (isPaying || !senderCardId || !payTarget) return
    setIsPaying(true)
    setPayError('')
    try {
      const amount = payTarget.money_request_detail?.amount
      const biometric = await getCreateBiometricPayload()
      if (biometric) {
        await submitPay({ biometric })
      } else if ((await getAppPinStatus()).enabled) {
        setPin('')
        setPinError('')
        setPinSubtitle('Enter your app PIN to send this payment.')
        setPinConfirmOpen(true)
      } else if (userRequiresPaymentConfirmation(user, amount)) {
        setSendConfirmOpen(true)
      } else {
        await submitPay()
      }
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        if ((await getAppPinStatus()).enabled) {
          setPinSubtitle('Biometric verification was cancelled. Use your app PIN to continue.')
          setPinConfirmOpen(true)
        } else {
          setPayError('Biometric verification was cancelled. Payment was not sent.')
        }
        return
      }
      if (err?.message?.toLowerCase().includes('biometric')) {
        if ((await getAppPinStatus()).enabled) {
          setPinSubtitle('Biometrics are unavailable right now. Use your app PIN to continue.')
          setPinConfirmOpen(true)
        } else {
          setPayError('Biometrics are unavailable right now. Payment was not sent.')
        }
        return
      }
      setPayError(err?.message || 'Payment failed. Please try again.')
    } finally {
      setIsPaying(false)
    }
  }

  async function handlePinSubmit() {
    if (isPinSubmitting || pin.length !== 4) return
    setPinError('')
    setIsPinSubmitting(true)
    try {
      await submitPay({ app_pin: pin })
      setPinConfirmOpen(false)
    } catch (err) {
      setPin('')
      setPinError(err?.message || 'Could not confirm app PIN. Try again.')
    } finally {
      setIsPinSubmitting(false)
    }
  }

  if (isLoading || (items.length === 0 && !loadError)) return null

  return (
    <section className="mx-auto mb-6 max-w-5xl" aria-labelledby="incoming-money-requests-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="incoming-money-requests-heading"
          className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
        >
          <HandCoins className="size-4" />
          Incoming Requests
          {items.length > 0 && (
            <Badge variant="secondary" size="sm">
              {items.length}
            </Badge>
          )}
        </h2>
      </div>

      {loadError ? (
        <p className="flex items-center gap-2 rounded-card border border-border bg-card px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="size-4 shrink-0" />
          {loadError}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((req) => (
            <RequestCard
              key={req.request_id}
              req={req}
              onPay={openPay}
              onDecline={handleDecline}
              isBusy={busyId === req.request_id}
            />
          ))}
        </div>
      )}

      <Modal isOpen={Boolean(payTarget)} onClose={closePayModal} size="lg">
        <div className="px-6 pt-5 pb-6 sm:px-7 sm:pb-7">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <ModalTitle className="text-lg font-semibold text-card-foreground">
                Pay {requesterLabel(payTarget)}
              </ModalTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatMoney(payTarget?.money_request_detail?.amount)} will move from the
                card you pick to their default card.
              </p>
            </div>
            <button
              type="button"
              onClick={closePayModal}
              className="inline-flex h-8 w-8 items-center justify-center rounded-pill bg-muted/50 text-muted-foreground hover:bg-muted hover:text-card-foreground"
              aria-label="Close"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>

          <div className="space-y-2">
            {cards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active cards found.</p>
            ) : (
              cards.map((card) => (
                <CardOption
                  key={card.card_id}
                  card={card}
                  selected={senderCardId === card.card_id}
                  onSelect={() => setSenderCardId(card.card_id)}
                  maskCard={maskCard}
                  resolveBrand={resolveBrand}
                />
              ))
            )}
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {user?.totp_enabled
              ? 'Confirm with Face ID / fingerprint, app PIN, or your authenticator code before money is sent.'
              : `Confirm with Face ID / fingerprint, app PIN, or your password before money is sent. ${paymentConfirmationLabel(user)}`}
          </p>

          <FormBanner variant="error" message={payError} />

          <div className="mt-5 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={closePayModal} disabled={isPaying}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={startPay}
              disabled={isPaying || !senderCardId}
              aria-busy={isPaying}
            >
              {isPaying && <Loader2 className="h-4 w-4 animate-spin" />}
              Pay {formatMoney(payTarget?.money_request_detail?.amount)}
            </Button>
          </div>
        </div>
      </Modal>

      {pinConfirmOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !isPinSubmitting) {
              setPinConfirmOpen(false)
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="money-request-pin-title"
        >
          <div className="w-full max-w-sm rounded-panel border border-border/60 bg-background px-6 py-6 shadow-xl">
            <p id="money-request-pin-title" className="sr-only">
              Confirm payment with app PIN
            </p>
            <AppPinPad
              value={pin}
              onChange={setPin}
              onSubmit={handlePinSubmit}
              isSubmitting={isPinSubmitting}
              error={pinError}
              title="Confirm with app PIN"
              subtitle={pinSubtitle}
              submitLabel="Send payment"
              cancelLabel="Back"
              onCancel={() => setPinConfirmOpen(false)}
            />
          </div>
        </div>
      )}

      <PaymentSendConfirmModal
        isOpen={sendConfirmOpen}
        onClose={() => setSendConfirmOpen(false)}
        amount={payTarget?.money_request_detail?.amount}
        recipientName={requesterLabel(payTarget)}
        onConfirm={async (confirmation) => {
          await submitPay(confirmation)
          setSendConfirmOpen(false)
        }}
      />

      <PaymentApprovalModal
        isOpen={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false)
          notify({
            type: 'info',
            category: CATEGORIES.PAYMENT_SENT,
            message: 'Payment is pending your approval. Open it from your history to confirm.',
            link: pendingApprovalTx?.transaction_id
              ? { route: '/transactions', modal: { kind: 'transaction', id: pendingApprovalTx.transaction_id } }
              : { route: '/transactions' },
          })
          emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
          emitDataChange(DATA_CHANGE_KINDS.MONEY_REQUEST)
        }}
        transaction={pendingApprovalTx}
        onApproved={() => {
          setApprovalModalOpen(false)
          notify({
            type: 'success',
            category: CATEGORIES.PAYMENT_SENT,
            message: `${formatMoney(pendingApprovalTx?.amount)} approved and will settle shortly.`,
            link: pendingApprovalTx?.transaction_id
              ? { route: '/transactions', modal: { kind: 'transaction', id: pendingApprovalTx.transaction_id } }
              : { route: '/transactions' },
          })
          emitDataChange(DATA_CHANGE_KINDS.TRANSACTION)
          emitDataChange(DATA_CHANGE_KINDS.MONEY_REQUEST)
        }}
      />
    </section>
  )
}
