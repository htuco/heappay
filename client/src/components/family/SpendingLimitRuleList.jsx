import { useState } from 'react'
import { AlertCircle, Loader2, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'

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
import Toggle from '@/components/settings/Toggle'
import { useAppSelector } from '@/store/hooks'
import { selectTransactionCategories } from '@/store/slices/referenceDataSlice'

const PERIOD_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
]

function formatAmount(amount) {
  const n = Number.parseFloat(amount)
  if (Number.isNaN(n)) return String(amount)
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function ruleSummary(rule, categoriesById) {
  const category = rule.category_id ? categoriesById[rule.category_id]?.name : null
  const scope = category ? `on ${category}` : 'overall'
  return `${formatAmount(rule.max_amount)} / ${rule.period} ${scope}`
}

function RuleForm({ initial, categories, onSubmit, onCancel, loading, error }) {
  const [form, setForm] = useState({
    category_id: initial?.category_id ? String(initial.category_id) : '',
    period: initial?.period ?? 'monthly',
    max_amount: initial?.max_amount ? String(initial.max_amount) : '',
    requires_approval_above: initial?.requires_approval_above
      ? String(initial.requires_approval_above)
      : '',
    requires_approval_always: initial?.requires_approval_always ?? false,
    enabled: initial?.enabled ?? true,
  })

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit({
      category_id: form.category_id ? Number(form.category_id) : null,
      period: form.period,
      max_amount: form.max_amount,
      requires_approval_above: form.requires_approval_above || null,
      requires_approval_always: form.requires_approval_always,
      enabled: form.enabled,
    })
  }

  const canSubmit = form.period && form.max_amount

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-1">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
          Category <span className="normal-case font-normal text-muted-foreground">(optional)</span>
        </label>
        <Select
          value={form.category_id}
          onChange={(e) => set('category_id', e.target.value)}
          placeholder="All categories"
          options={categories.map((c) => ({
            value: String(c.transaction_category_id),
            label: c.name,
          }))}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
          Period
        </label>
        <Select
          options={PERIOD_OPTIONS}
          value={form.period}
          onChange={(e) => set('period', e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
          Max amount per period
        </label>
        <Input
          value={form.max_amount}
          onChange={(e) => set('max_amount', e.target.value)}
          placeholder="0.00"
          inputMode="decimal"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wider text-foreground/80">
          Require my approval above{' '}
          <span className="normal-case font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          value={form.requires_approval_above}
          onChange={(e) => set('requires_approval_above', e.target.value)}
          placeholder="e.g. 50.00"
          inputMode="decimal"
        />
      </div>
      <div className="flex items-center justify-between rounded-input border border-border px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-card-foreground">Always require my approval</p>
          <p className="text-xs text-muted-foreground">Every transaction needs your sign-off.</p>
        </div>
        <Toggle
          compact
          enabled={form.requires_approval_always}
          label={form.requires_approval_always ? 'On' : 'Off'}
          onToggle={() => set('requires_approval_always', !form.requires_approval_always)}
        />
      </div>
      <div className="flex items-center justify-between rounded-input border border-border px-3 py-2.5">
        <div>
          <p className="text-sm font-medium text-card-foreground">Enabled</p>
          <p className="text-xs text-muted-foreground">Turn this limit off without deleting it.</p>
        </div>
        <Toggle
          compact
          enabled={form.enabled}
          label={form.enabled ? 'Enabled' : 'Disabled'}
          onToggle={() => set('enabled', !form.enabled)}
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
          {initial ? 'Save changes' : 'Create limit'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function RuleCard({ rule, categoriesById, onEdit, onDelete }) {
  return (
    <div className="rounded-card border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-input bg-primary/10 text-primary">
            <ShieldAlert className="size-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {ruleSummary(rule, categoriesById)}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {rule.requires_approval_always
                ? 'Always requires approval'
                : rule.requires_approval_above
                  ? `Requires approval above ${formatAmount(rule.requires_approval_above)}`
                  : 'Blocks outright if exceeded'}
              {!rule.enabled ? ' · Disabled' : ''}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7" onClick={() => onEdit(rule)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(rule)}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Controlled: the caller owns data-fetching (via useSpendingLimits /
 * useCardSpendingLimits / useCardMemberSpendingLimits, whichever scope
 * applies) and passes the result down as props -- this same list/CRUD UI
 * serves a dependent's own-card limits, a shared card's overall cap, and a
 * member's own cap on a shared card.
 */
export default function SpendingLimitRuleList({
  title = 'Spending limits',
  rules,
  isLoading,
  error,
  create,
  update,
  remove,
}) {
  const categories = useAppSelector(selectTransactionCategories) ?? []
  const categoriesById = Object.fromEntries(
    categories.map((c) => [c.transaction_category_id, c]),
  )

  const [createOpen, setCreateOpen] = useState(false)
  const [editRule, setEditRule] = useState(null)
  const [deleteRule, setDeleteRule] = useState(null)
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState(null)

  async function handleCreate(payload) {
    setFormLoading(true)
    setFormError(null)
    try {
      await create(payload)
      setCreateOpen(false)
    } catch (err) {
      setFormError(err?.message || 'Failed to create spending limit.')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleEdit(payload) {
    setFormLoading(true)
    setFormError(null)
    try {
      await update(editRule.spending_limit_rule_id, payload)
      setEditRule(null)
    } catch (err) {
      setFormError(err?.message || 'Failed to update spending limit.')
    } finally {
      setFormLoading(false)
    }
  }

  async function handleDelete() {
    setFormLoading(true)
    try {
      await remove(deleteRule.spending_limit_rule_id)
      setDeleteRule(null)
    } catch {
      // keep the dialog open so the user can retry
    } finally {
      setFormLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading spending limits…
      </div>
    )
  }

  if (error) {
    return <p className="py-4 text-sm text-destructive">{error}</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setFormError(null)
            setCreateOpen(true)
          }}
        >
          <Plus className="mr-1.5 size-3.5" />
          New limit
        </Button>
      </div>

      {rules.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No spending limits set up yet.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.spending_limit_rule_id}
              rule={rule}
              categoriesById={categoriesById}
              onEdit={(r) => {
                setFormError(null)
                setEditRule(r)
              }}
              onDelete={(r) => setDeleteRule(r)}
            />
          ))}
        </div>
      )}

      <DialogRoot open={createOpen} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New spending limit</DialogTitle>
            <DialogDescription>
              Set a cap on how much this dependent can spend in a period, optionally scoped to one
              category.
            </DialogDescription>
          </DialogHeader>
          <RuleForm
            categories={categories}
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
            loading={formLoading}
            error={formError}
          />
        </DialogContent>
      </DialogRoot>

      <DialogRoot open={Boolean(editRule)} onOpenChange={(o) => !o && setEditRule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit spending limit</DialogTitle>
            <DialogDescription>Update the cap, category, or approval settings.</DialogDescription>
          </DialogHeader>
          {editRule && (
            <RuleForm
              initial={editRule}
              categories={categories}
              onSubmit={handleEdit}
              onCancel={() => setEditRule(null)}
              loading={formLoading}
              error={formError}
            />
          )}
        </DialogContent>
      </DialogRoot>

      <DialogRoot open={Boolean(deleteRule)} onOpenChange={(o) => !o && setDeleteRule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove spending limit</DialogTitle>
            <DialogDescription>
              This limit will no longer apply to this dependent's transactions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={formLoading}>
                Keep it
              </Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete} disabled={formLoading}>
              {formLoading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </div>
  )
}
