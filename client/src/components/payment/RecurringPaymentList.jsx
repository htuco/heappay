import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AlertCircle, Loader2, SearchX } from 'lucide-react'

import {
  filterRecurringRules,
  formatRecurringAmount as formatAmount,
  recipientName,
  statusOptionsFromRules,
} from '@/utils/recurringPayments.utils'
import RecurringEmptyState from '@/components/recurring/RecurringEmptyState'
import RecurringFilterBar from '@/components/recurring/RecurringFilterBar'
import RecurringRuleCard from '@/components/recurring/RecurringRuleCard'
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

// ── Filters ───────────────────────────────────────────────────────────────────

const FILTER_KEYS = ['q', 'status', 'freq', 'attention']

function useRecurringFilters() {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(
    () => ({
      q: searchParams.get('q') ?? '',
      status: searchParams.get('status') ?? '',
      freq: searchParams.get('freq') ?? '',
      attention: searchParams.get('attention') === '1',
    }),
    [searchParams],
  )

  const setFilters = useCallback(
    (patch) => {
      const params = new URLSearchParams(searchParams)
      Object.entries(patch).forEach(([key, value]) => {
        if (!value) params.delete(key)
        else params.set(key, value === true ? '1' : value)
      })
      setSearchParams(params, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams)
    FILTER_KEYS.forEach((key) => params.delete(key))
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  return { filters, setFilters, clearFilters }
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
  const { filters, setFilters, clearFilters } = useRecurringFilters()

  const statusOptions = useMemo(() => statusOptionsFromRules(rules), [rules])
  const hasAttentionRules = useMemo(
    () => rules.some((rule) => rule.last_run_failed),
    [rules],
  )
  const visibleRules = useMemo(
    () => filterRecurringRules(rules, filters, recipientName),
    [rules, filters],
  )

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
        <>
          <RecurringFilterBar
            filters={filters}
            onChange={setFilters}
            onClear={clearFilters}
            statusOptions={statusOptions}
            matchCount={visibleRules.length}
            totalCount={rules.length}
            hasAttentionRules={hasAttentionRules}
          />

          {visibleRules.length === 0 ? (
            <div className="rounded-card border border-dashed border-border bg-card/50 px-6 py-10 text-center">
              <SearchX className="mx-auto size-8 text-muted-foreground/60" aria-hidden />
              <p className="mt-3 font-semibold text-card-foreground">
                No recurring payments match your filters.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different search or clear the filters to see all {rules.length}.
              </p>
              <Button variant="outline" className="mt-4" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleRules.map((rule) => (
                <RecurringRuleCard
                  key={rule.recurring_payment_id}
                  rule={rule}
                  onEdit={(r) => { clearMutationError(); setEditRule(r) }}
                  onCancel={(r) => { clearMutationError(); setRuleToCancel(r) }}
                />
              ))}
            </div>
          )}
        </>
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
