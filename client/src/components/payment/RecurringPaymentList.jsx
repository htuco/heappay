import { useState } from 'react'
import { AlertCircle, CalendarClock, Loader2, Pencil, Repeat2, Trash2, TriangleAlert } from 'lucide-react'

import {
  formatMonthsLabel,
  formatRecurringAmount as formatAmount,
  ordinal,
} from '@/utils/recurringPayments.utils'
import CardBrandIcon from '@/components/ui/CardBrandIcon'
import RecurringEmptyState from '@/components/recurring/RecurringEmptyState'
import {
  AmountInput,
  DayOfMonthPicker,
  MonthPicker,
} from '@/components/payment/recurringFormControls'
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

// ── Edit form ─────────────────────────────────────────────────────────────────

/**
 * Edit dialog for an existing rule. Deliberately *not* the create wizard: the
 * API only allows amount / day_of_month / months / note to change, so the card
 * and recipient steps would be dead weight here. Creating goes through
 * `RecurringPaymentWizard`.
 */
function RuleForm({ initial, onSubmit, onCancel, loading, error }) {
  const [form, setForm] = useState({
    amount: initial?.amount ? String(initial.amount) : '',
    day_of_month: initial?.day_of_month ? String(initial.day_of_month) : '',
    months: initial?.months ?? [],
    note: initial?.note ?? '',
  })

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    // Only the mutable fields — the update endpoint takes nothing else, and the
    // card/recipient can't be reassigned on an existing rule.
    onSubmit({
      amount: form.amount,
      day_of_month: Number(form.day_of_month),
      months: form.months.length > 0 ? form.months : null,
      note: form.note || null,
    })
  }

  const canSubmit = form.amount && Number(form.amount) > 0 && form.day_of_month

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pt-1">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80">Amount</label>
        <div className="rounded-panel bg-muted/50 px-4 py-5 ring-1 ring-border/60">
          <label className="mx-auto flex w-fit cursor-text items-baseline justify-center gap-1.5">
            <span className="text-xl font-light leading-none text-foreground/60" aria-hidden="true">$</span>
            <AmountInput value={form.amount} onChange={(v) => set('amount', v)} />
          </label>
        </div>
      </div>
      <DayOfMonthPicker value={form.day_of_month} onChange={(v) => set('day_of_month', v)} />
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
          Save changes
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
              to {recipientName(rule)} · {rule.day_of_month}
              {ordinal(rule.day_of_month)} of{' '}
              {rule.months?.length > 0 ? formatMonthsLabel(rule.months) : 'every month'}
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

export default function RecurringPaymentList({ recurring, onCreate }) {
  const {
    rules,
    isLoading,
    error,
    isMutating,
    mutationError,
    clearMutationError,
    updateRule,
    cancelRule,
  } = recurring

  const [editRule, setEditRule] = useState(null)
  const [ruleToCancel, setRuleToCancel] = useState(null)

  async function handleEdit(payload) {
    if (await updateRule(editRule.recurring_payment_id, payload)) setEditRule(null)
  }

  async function handleCancel() {
    // Stays open on failure so the user can retry.
    if (await cancelRule(ruleToCancel.recurring_payment_id)) setRuleToCancel(null)
  }

  if (isLoading) {
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
      {rules.length === 0 ? (
        <RecurringEmptyState onCreate={onCreate} />
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.recurring_payment_id}
              rule={rule}
              onEdit={(r) => { clearMutationError(); setEditRule(r) }}
              onCancel={(r) => { clearMutationError(); setRuleToCancel(r) }}
            />
          ))}
        </div>
      )}

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
              onSubmit={handleEdit}
              onCancel={() => setEditRule(null)}
              loading={isMutating}
              error={mutationError}
            />
          )}
        </DialogContent>
      </DialogRoot>

      {/* Cancel confirm dialog */}
      <DialogRoot open={Boolean(ruleToCancel)} onOpenChange={(o) => { if (!o) setRuleToCancel(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel recurring payment</DialogTitle>
            <DialogDescription>
              Stop the automatic {ruleToCancel ? formatAmount(ruleToCancel.amount) : ''} payment to{' '}
              {ruleToCancel ? recipientName(ruleToCancel) : ''}? No future payments will be sent.
            </DialogDescription>
          </DialogHeader>
          {mutationError && (
            <p className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {mutationError}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isMutating}>Keep it</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleCancel} disabled={isMutating}>
              {isMutating && <Loader2 className="mr-2 size-4 animate-spin" />}
              Cancel payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </div>
  )
}
