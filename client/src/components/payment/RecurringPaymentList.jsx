import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertCircle, CalendarClock, Check, CheckCircle2, CreditCard, Loader2, Pencil, Plus, Repeat2, Trash2, TriangleAlert, XCircle } from 'lucide-react'

import { recurringPaymentsService } from '@/services/recurringPaymentsService'
import { listCards, lookupCardByNumber } from '@/services/cardsService'
import { useAuth } from '@/hooks/useAuth'
import { useCardBrandResolver } from '@/hooks/useCardBrandResolver'
import { formatBrandLabel } from '@/utils/paymentCard.utils'
import CardBrandIcon from '@/components/ui/CardBrandIcon'
import UserAvatar from '@/components/ui/UserAvatar'
import RecipientPicker from '@/components/payment/RecipientPicker'
import { Button } from '@/components/ui/button'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

const DAY_OPTIONS = Array.from({ length: 31 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1}${ordinal(i + 1)}`,
}))

const MONTH_OPTIONS = [
  { value: 1, label: 'Jan' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Apr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Aug' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dec' },
]

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

function formatAmount(amount) {
  const n = Number.parseFloat(amount)
  if (Number.isNaN(n)) return String(amount)
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function recipientName(rule) {
  const r = rule?.recipient
  if (!r) return `Card #${rule.recipient_card_id}`
  if (r.first_name || r.last_name) return [r.first_name, r.last_name].filter(Boolean).join(' ')
  return r.email || `Card #${rule.recipient_card_id}`
}

function senderCard(rule) {
  const s = rule?.sender
  if (!s) return `Card #${rule.sender_card_id}`
  const brand = s.brand ? s.brand.charAt(0).toUpperCase() + s.brand.slice(1) : 'Card'
  return s.last_four ? `${brand} ···· ${s.last_four}` : brand
}

function nextDueLabel(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function CardOption({ card, selected, onSelect, maskCard, resolveBrand }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group relative box-border block w-full rounded-surface border-2 p-3.5 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        selected
          ? 'border-primary/60 bg-primary/8 shadow-sm'
          : 'border-border bg-card hover:border-border/90 hover:bg-muted/40'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-chip border border-border/70 bg-background">
          <CardBrandIcon brand={resolveBrand(card.card_type_id)} width={52} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-semibold text-card-foreground">
            {maskCard(card)}
          </p>
          <p className="mt-0.5 text-xs font-medium capitalize text-muted-foreground">
            {formatBrandLabel(resolveBrand(card.card_type_id))}
          </p>
        </div>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
            selected ? 'bg-primary' : 'border border-border bg-background'
          }`}
          aria-hidden="true"
        >
          {selected && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3.5} />}
        </span>
      </div>
    </button>
  )
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="inline-flex w-full rounded-input bg-muted p-1 ring-1 ring-border/60">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`min-h-11 flex-1 rounded-chip px-3 py-2 text-sm font-semibold transition-all duration-200 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:min-h-0 ${
              active
                ? 'bg-card text-card-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:text-card-foreground'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

function formatRawCardNumber(value) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}

function AmountInput({ value, onChange }) {
  function handleChange(e) {
    const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 7)
    const cents = digits ? parseInt(digits, 10) : 0
    const padded = String(cents).padStart(3, '0')
    onChange(cents === 0 ? '' : `${padded.slice(0, -2)}.${padded.slice(-2)}`)
  }

  function toDisplay(val) {
    if (!val) return ''
    const cents = Math.round(parseFloat(val) * 100)
    if (cents === 0) return ''
    const padded = String(cents).padStart(3, '0')
    return `${padded.slice(0, -2)}.${padded.slice(-2)}`
  }

  const display = toDisplay(value)
  return (
    <input
      type="text"
      inputMode="decimal"
      placeholder="0.00"
      value={display}
      onChange={handleChange}
      size={Math.max(4, (display || '0.00').length)}
      className="min-w-[3ch] bg-transparent text-center text-3xl font-bold leading-none tabular-nums tracking-tight text-card-foreground outline-none placeholder:text-muted-foreground/40"
    />
  )
}

// ── Month picker ──────────────────────────────────────────────────────────────

function MonthPicker({ value, onChange }) {
  const allSelected = value.length === 0

  function toggleMonth(m) {
    if (value.includes(m)) {
      const next = value.filter((x) => x !== m)
      onChange(next)
    } else {
      onChange([...value, m].sort((a, b) => a - b))
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80">Months</label>
        <button
          type="button"
          onClick={() => onChange([])}
          className={`text-xs font-semibold transition-colors ${
            allSelected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All months
        </button>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {MONTH_OPTIONS.map((m) => {
          const active = value.includes(m.value)
          return (
            <button
              key={m.value}
              type="button"
              onClick={() => toggleMonth(m.value)}
              className={`rounded-chip py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              }`}
            >
              {m.label}
            </button>
          )
        })}
      </div>
      {!allSelected && (
        <p className="text-xs text-muted-foreground">
          {value.length === 1 ? '1 month selected' : `${value.length} months selected`}
        </p>
      )}
    </div>
  )
}

// ── Create / Edit form ────────────────────────────────────────────────────────

function RuleForm({ initial, cards, currentUserId, onSubmit, onCancel, loading, error }) {
  const { maskCard, resolveBrand } = useCardBrandResolver()
  const debounceRef = useRef(null)

  const [form, setForm] = useState({
    sender_card_id: initial?.sender_card_id ?? null,
    recipientMode: 'email',
    recipientCardNumber: '',
    recipientEmailQuery: '',
    recipientInfo: null,
    amount: initial?.amount ? String(initial.amount) : '',
    day_of_month: initial?.day_of_month ? String(initial.day_of_month) : '',
    months: initial?.months ?? [],
    note: initial?.note ?? '',
  })

  const [lookupState, setLookupState] = useState({ status: 'idle' })
  const [recipientError, setRecipientError] = useState('')

  const isEdit = Boolean(initial)

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      sender_card_id: form.sender_card_id,
      recipient_card_id: form.recipientInfo.card_id,
      amount: form.amount,
      day_of_month: Number(form.day_of_month),
      months: form.months.length > 0 ? form.months : null,
      note: form.note || null,
    })
  }

  function handleCardNumberChange(e) {
    const formatted = formatRawCardNumber(e.target.value)
    const digits = formatted.replace(/\D/g, '')
    set('recipientCardNumber', formatted)
    set('recipientInfo', null)
    setRecipientError('')
    clearTimeout(debounceRef.current)

    if (digits.length === 16) {
      setLookupState({ status: 'loading' })
      debounceRef.current = setTimeout(async () => {
        try {
          const info = await lookupCardByNumber(digits)
          if (info.user_id === currentUserId) {
            setLookupState({ status: 'idle' })
            setRecipientError("You can't send a bill to yourself.")
            return
          }
          setLookupState({ status: 'found', info })
          set('recipientInfo', info)
        } catch {
          setLookupState({ status: 'not_found' })
        }
      }, 500)
    } else {
      setLookupState({ status: 'idle' })
    }
  }

  function handleRecipientModeChange(mode) {
    set('recipientMode', mode)
    set('recipientInfo', null)
    set('recipientCardNumber', '')
    set('recipientEmailQuery', '')
    setLookupState({ status: 'idle' })
    setRecipientError('')
    clearTimeout(debounceRef.current)
  }

  function handleEmailRecipientSelect(info) {
    if (info.user_id === currentUserId) {
      setRecipientError("You can't send a bill to yourself.")
      return
    }
    set('recipientInfo', info)
    set('recipientEmailQuery', info.owner_email ?? '')
    setLookupState({ status: 'found', info })
    setRecipientError('')
  }

  const canSubmit = isEdit
    ? form.amount && form.day_of_month
    : form.sender_card_id && form.recipientInfo && !recipientError && form.amount && form.day_of_month

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-1">
      {!isEdit && (
        <>
          {/* From card */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
              Pay from
            </label>
            {(cards ?? []).length === 0 ? (
              <div className="rounded-surface border border-dashed border-border bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">
                No active cards found.
              </div>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                {(cards ?? []).map((c) => (
                  <CardOption
                    key={c.card_id}
                    card={c}
                    selected={form.sender_card_id === c.card_id}
                    onSelect={() => set('sender_card_id', c.card_id)}
                    maskCard={maskCard}
                    resolveBrand={resolveBrand}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recipient */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
              Recipient
            </label>
            <SegmentedControl
              options={[
                { value: 'email', label: 'By email' },
                { value: 'card', label: 'By card number' },
              ]}
              value={form.recipientMode}
              onChange={handleRecipientModeChange}
            />

            {form.recipientMode === 'email' ? (
              <RecipientPicker
                query={form.recipientEmailQuery}
                onQueryChange={(v) => { set('recipientEmailQuery', v); set('recipientInfo', null) }}
                selectedRecipient={form.recipientInfo}
                onSelect={handleEmailRecipientSelect}
                currentUserId={currentUserId}
              />
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    value={form.recipientCardNumber}
                    onChange={handleCardNumberChange}
                    placeholder="0000 0000 0000 0000"
                    inputMode="numeric"
                    maxLength={19}
                    aria-invalid={lookupState.status === 'not_found'}
                    className={`pr-10 font-mono tracking-wide ${lookupState.status === 'not_found' ? 'border-destructive' : ''}`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" aria-hidden="true">
                    {lookupState.status === 'loading' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    {lookupState.status === 'found' && <CheckCircle2 className="h-4 w-4 text-success" />}
                    {lookupState.status === 'not_found' && <XCircle className="h-4 w-4 text-destructive" />}
                    {lookupState.status === 'idle' && <CreditCard className="h-4 w-4 text-muted-foreground" />}
                  </span>
                </div>
                {lookupState.status === 'found' && lookupState.info && (
                  <div className="flex items-center gap-3 rounded-surface bg-success/10 px-4 py-3 ring-1 ring-success/30">
                    <UserAvatar
                      user={{ full_name: lookupState.info.owner_name, avatar_url: lookupState.info.avatar_url }}
                      className="h-9 w-9 text-xs ring-1 ring-success/30"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-card-foreground">{lookupState.info.owner_name}</p>
                      <p className="truncate text-xs font-medium text-muted-foreground">{lookupState.info.owner_email}</p>
                    </div>
                  </div>
                )}
                {lookupState.status === 'not_found' && (
                  <p className="text-xs font-medium text-destructive">No active card found with that number.</p>
                )}
              </div>
            )}

            {recipientError && (
              <p className="text-xs text-destructive">{recipientError}</p>
            )}
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80">Amount</label>
        <div className="rounded-panel bg-muted/50 px-4 py-5 ring-1 ring-border/60">
          <label className="mx-auto flex w-fit cursor-text items-baseline justify-center gap-1.5">
            <span className="text-xl font-light leading-none text-foreground/60" aria-hidden="true">$</span>
            <AmountInput value={form.amount} onChange={(v) => set('amount', v)} />
          </label>
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80">Day of month</label>
        <Select
          options={DAY_OPTIONS}
          value={form.day_of_month}
          onChange={(e) => set('day_of_month', e.target.value)}
          placeholder="Select day"
        />
        {Number(form.day_of_month) > 28 && (
          <p className="text-xs text-muted-foreground">
            For months with fewer days, the payment will run on the last available day.
          </p>
        )}
      </div>
      <MonthPicker value={form.months} onChange={(v) => set('months', v)} />
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80">Note <span className="normal-case font-normal text-muted-foreground">(optional)</span></label>
        <Input
          placeholder="e.g. Monthly rent"
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
          maxLength={255}
        />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={loading || !canSubmit}>
          {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
          {isEdit ? 'Save changes' : 'Create bill'}
        </Button>
      </DialogFooter>
    </form>
  )
}

// ── Rule card ─────────────────────────────────────────────────────────────────

function RuleCard({ rule, onEdit, onCancel }) {
  return (
    <div className="rounded-card border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-input bg-primary/10 text-primary">
            <Repeat2 className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{formatAmount(rule.amount)}</p>
            <p className="truncate text-xs text-muted-foreground">
              to {recipientName(rule)} · {ordinal(rule.day_of_month)} of{' '}
              {rule.months?.length > 0
                ? rule.months.map((m) => MONTH_OPTIONS[m - 1].label).join(', ')
                : 'every month'}
            </p>
            <p className="truncate text-xs text-muted-foreground/70">from {senderCard(rule)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => onEdit(rule)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive" onClick={() => onCancel(rule)}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-3 border-t border-border/60 pt-2.5">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" />
          Next: {nextDueLabel(rule.next_due_at)}
        </div>
        {rule.last_run_failed && (
          <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <TriangleAlert className="size-3.5" />
            Last run failed
          </div>
        )}
        {rule.note && (
          <p className="truncate text-xs text-muted-foreground/70 ml-auto">{rule.note}</p>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function RecurringPaymentList() {
  const { user } = useAuth()
  const currentUserId = user?.user_id ?? user?.id

  const [rules, setRules] = useState([])
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editRule, setEditRule] = useState(null)
  const [cancelRule, setCancelRule] = useState(null)

  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState(null)

  const load = useCallback(async () => {
    try {
      const [rulesData, cardsData] = await Promise.all([
        recurringPaymentsService.list(),
        listCards().catch(() => []),
      ])
      setRules(Array.isArray(rulesData) ? rulesData : [])
      setCards(Array.isArray(cardsData?.items ?? cardsData) ? (cardsData?.items ?? cardsData) : [])
    } catch {
      setError('Could not load recurring payments.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(payload) {
    setFormLoading(true)
    setFormError(null)
    try {
      const newRule = await recurringPaymentsService.create(payload)
      setRules((prev) => [newRule, ...prev])
      setCreateOpen(false)
    } catch (err) {
      setFormError(err?.message || 'Failed to create recurring payment.')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleEdit(payload) {
    setFormLoading(true)
    setFormError(null)
    try {
      const updated = await recurringPaymentsService.update(editRule.recurring_payment_id, payload)
      setRules((prev) => prev.map((r) => (r.recurring_payment_id === updated.recurring_payment_id ? updated : r)))
      setEditRule(null)
    } catch (err) {
      setFormError(err?.message || 'Failed to update recurring payment.')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleCancel() {
    setFormLoading(true)
    try {
      await recurringPaymentsService.cancel(cancelRule.recurring_payment_id)
      setRules((prev) => prev.filter((r) => r.recurring_payment_id !== cancelRule.recurring_payment_id))
      setCancelRule(null)
    } catch {
      // keep modal open — user can retry
    } finally {
      setFormLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading recurring payments…
      </div>
    )
  }

  if (error) {
    return <p className="py-4 text-sm text-destructive">{error}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Recurring Payments</h3>
        <Button size="sm" variant="outline" onClick={() => { setFormError(null); setCreateOpen(true) }}>
          <Plus className="mr-1.5 size-3.5" />
          New bill
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No recurring payments set up yet.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.recurring_payment_id}
              rule={rule}
              onEdit={(r) => { setFormError(null); setEditRule(r) }}
              onCancel={(r) => setCancelRule(r)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <DialogRoot open={createOpen} onOpenChange={(o) => { if (!o) setCreateOpen(false) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New recurring payment</DialogTitle>
            <DialogDescription>
              Set up an automatic monthly payment. The system will deduct on the selected day each month.
            </DialogDescription>
          </DialogHeader>
          <RuleForm
            cards={cards}
            currentUserId={currentUserId}
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
            loading={formLoading}
            error={formError}
          />
        </DialogContent>
      </DialogRoot>

      {/* Edit dialog */}
      <DialogRoot open={Boolean(editRule)} onOpenChange={(o) => { if (!o) setEditRule(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit recurring payment</DialogTitle>
            <DialogDescription>
              Update the amount, day, or note. The next due date will be recalculated for day changes.
            </DialogDescription>
          </DialogHeader>
          {editRule && (
            <RuleForm
              initial={editRule}
              cards={cards}
              currentUserId={currentUserId}
              onSubmit={handleEdit}
              onCancel={() => setEditRule(null)}
              loading={formLoading}
              error={formError}
            />
          )}
        </DialogContent>
      </DialogRoot>

      {/* Cancel confirm dialog */}
      <DialogRoot open={Boolean(cancelRule)} onOpenChange={(o) => { if (!o) setCancelRule(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel recurring payment</DialogTitle>
            <DialogDescription>
              Stop the automatic {cancelRule ? formatAmount(cancelRule.amount) : ''} payment to{' '}
              {cancelRule ? recipientName(cancelRule) : ''}? No future payments will be sent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={formLoading}>Keep it</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleCancel} disabled={formLoading}>
              {formLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Cancel payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </div>
  )
}
