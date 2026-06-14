import { ArrowDownLeft, ArrowUpRight, RotateCcw } from 'lucide-react'

// Seeded transaction_types / transaction_statuses ids (see server alembic
// c7d4e9f01a2b and d8f3c1b05e9a): lookup tables are append-only, ids are stable.
export const TX_TYPE_META = {
  1: { label: 'Deposit', Icon: ArrowDownLeft, bg: 'bg-success/10', color: 'text-success' },
  2: { label: 'Payment', Icon: ArrowUpRight, bg: 'bg-destructive/10', color: 'text-destructive' },
  3: { label: 'Refund', Icon: RotateCcw, bg: 'bg-warning/10', color: 'text-warning' },
  4: { label: 'Withdrawal', Icon: ArrowUpRight, bg: 'bg-primary/10', color: 'text-primary' },
  5: { label: 'Chargeback', Icon: RotateCcw, bg: 'bg-destructive/10', color: 'text-destructive' },
}

export const TX_STATUS_META = {
  1: { label: 'Pending', variant: 'warning' },
  2: { label: 'Completed', variant: 'success' },
  3: { label: 'Failed', variant: 'error' },
  4: { label: 'Reversed', variant: 'secondary' },
}

export const TX_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  ...Object.entries(TX_STATUS_META).map(([value, meta]) => ({ value, label: meta.label })),
]

export const TX_TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All types' },
  ...Object.entries(TX_TYPE_META).map(([value, meta]) => ({ value, label: meta.label })),
]

export const TX_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'amount_desc', label: 'Amount high' },
  { value: 'amount_asc', label: 'Amount low' },
]

export function formatUsd(value) {
  const num = Number.parseFloat(value ?? '0')
  if (Number.isNaN(num)) return '—'
  return num.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
