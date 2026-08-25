import { HIDDEN_AMOUNT_LABEL } from '@/utils/money'
import {
  Bus,
  Clapperboard,
  CreditCard,
  Gift,
  HeartPulse,
  Home,
  Lightbulb,
  Receipt,
  Repeat,
  ShoppingBag,
  ShoppingCart,
  Tag,
  Utensils,
  Wallet,
} from 'lucide-react'

// Maps the backend's snake_case category machine names to a display label,
// a lucide icon, and a color token used by the history pill and the
// "Spending by Category" chart. Keyed by name (not id) because ids are not
// stable across environments; transactions carry category_id, which we resolve
// to a category record (from referenceData) before looking up meta here.
export const CATEGORY_META = {
  groceries: { label: 'Groceries', icon: ShoppingCart, color: '#16a34a' },
  food_dining: { label: 'Food & Dining', icon: Utensils, color: '#ea580c' },
  transport: { label: 'Transport', icon: Bus, color: '#2563eb' },
  utilities: { label: 'Utilities', icon: Lightbulb, color: '#ca8a04' },
  housing: { label: 'Housing', icon: Home, color: '#7c3aed' },
  shopping: { label: 'Shopping', icon: ShoppingBag, color: '#db2777' },
  entertainment: { label: 'Entertainment', icon: Clapperboard, color: '#c026d3' },
  health: { label: 'Health', icon: HeartPulse, color: '#dc2626' },
  subscriptions: { label: 'Subscriptions', icon: Repeat, color: '#0891b2' },
  transfer: { label: 'Transfer', icon: CreditCard, color: '#475569' },
  income: { label: 'Income', icon: Wallet, color: '#059669' },
  fees: { label: 'Fees', icon: Receipt, color: '#b45309' },
  other: { label: 'Other', icon: Tag, color: '#64748b' },
}

// Fallback for the null/Uncategorised bucket and any unknown name.
export const UNCATEGORISED_META = {
  label: 'Uncategorised',
  icon: Gift,
  color: '#94a3b8',
}

/**
 * Resolve a category record (or id + list) to display meta.
 * @param {{ name?: string } | null | undefined} category
 * @returns {{ label: string, icon: Function, color: string }}
 */
export function getCategoryMeta(category) {
  if (!category?.name) return UNCATEGORISED_META
  return CATEGORY_META[category.name] ?? { ...UNCATEGORISED_META, label: category.name }
}

/**
 * Look up a category record by id within the reference list.
 * @param {number | null | undefined} categoryId
 * @param {Array<{ transaction_category_id: number, name: string }>} categories
 */
export function findCategoryById(categoryId, categories = []) {
  if (categoryId == null) return null
  return categories.find((c) => c.transaction_category_id === categoryId) ?? null
}

/**
 * Build "All categories" select options from the reference list.
 * @param {Array<{ transaction_category_id: number, name: string }>} categories
 */
export function buildCategoryOptions(categories = []) {
  return categories.map((c) => ({
    value: String(c.transaction_category_id),
    label: getCategoryMeta(c).label,
  }))
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const TRANSACTION_STATUS_OPTIONS = [
  { value: '1', label: 'Pending' },
  { value: '2', label: 'Completed' },
  { value: '3', label: 'Failed' },
  { value: '4', label: 'Reversed' },
  { value: '5', label: 'Cancelled' },
]

// Cancelling a pending transaction moves it to the dedicated "Cancelled" status,
// which the backend treats as a user-initiated cancel (the held amount is
// released back to the sender, distinct from a processor-driven "Failed").
// Resolve the id from the canonical status list above instead of hardcoding a
// magic number.
export const CANCELLED_TRANSACTION_STATUS_ID = Number(
  TRANSACTION_STATUS_OPTIONS.find((option) => option.label === 'Cancelled')?.value,
)

export const TRANSACTION_TYPE_OPTIONS = [
  { value: '1', label: 'Deposit' },
  { value: '2', label: 'Payment' },
  { value: '3', label: 'Refund' },
  { value: '4', label: 'Withdrawal' },
  { value: '5', label: 'Chargeback' },
  { value: '6', label: 'Fine' },
]

/**
 * Pull the amount and hidden flag off either a transaction or a bare amount.
 * Formatting is the caller's job — it needs the active display currency, which
 * only a component can read. See `useDisplayCurrency()`.
 */
export function transactionAmountParts(amountOrTx) {
  if (amountOrTx && typeof amountOrTx === 'object' && !Array.isArray(amountOrTx)) {
    return { amount: amountOrTx.amount, hidden: Boolean(amountOrTx.amount_hidden) }
  }
  return { amount: amountOrTx, hidden: false }
}

export function formatTransactionDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return dateFormatter.format(date)
}

export function formatTransactionDateInputValue(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTransactionStatus(statusId, hasPendingRefund = false, awaitingUserApproval = false) {
  if (awaitingUserApproval && statusId === 1) {
    return { label: 'Awaiting approval', variant: 'warning' }
  }
  if (hasPendingRefund && statusId === 2) return { label: 'Refund Requested', variant: 'warning' }
  if (statusId === 1) return { label: 'Pending', variant: 'warning' }
  if (statusId === 2) return { label: 'Completed', variant: 'success' }
  if (statusId === 3) return { label: 'Failed', variant: 'error' }
  if (statusId === 4) return { label: 'Reversed', variant: 'secondary' }
  if (statusId === 5) return { label: 'Cancelled', variant: 'secondary' }
  return { label: `Status ${statusId}`, variant: 'secondary' }
}

export function getTransactionType(typeId) {
  const option = TRANSACTION_TYPE_OPTIONS.find((type) => Number(type.value) === typeId)
  return option?.label ?? `Type ${typeId}`
}

// Date-only client-side filter. Status and transaction-type filtering are now
// applied server-side (see useTransactions), so a match isn't hidden just
// because it lives on another page.
export function transactionMatchesFilters(transaction, { date }) {
  if (date) {
    const transactionDate = new Date(transaction.created_at)
    if (Number.isNaN(transactionDate.getTime())) return false

    const transactionDateValue = formatTransactionDateInputValue(transactionDate)
    if (transactionDateValue !== date) return false
  }

  return true
}

export function transactionMatchesLookup(transaction, lookupValue) {
  const query = lookupValue.trim().toLowerCase()
  if (!query) return true

  const status = getTransactionStatus(transaction.status_id).label
  const type = getTransactionType(transaction.transaction_type_id)
  const searchableValues = [
    transaction.transaction_id,
    transaction.sender_card_id ?? 'external',
    transaction.recipient_card_id,
    transaction.sender?.full_name,
    transaction.sender?.email,
    transaction.sender?.cardholder_name,
    transaction.sender?.brand,
    transaction.sender?.last_four,
    transaction.recipient?.full_name,
    transaction.recipient?.email,
    transaction.recipient?.cardholder_name,
    transaction.recipient?.brand,
    transaction.recipient?.last_four,
    transaction.transaction_type_id,
    type,
    transaction.status_id,
    status,
    // The raw amount only: the formatted string now depends on the viewer's
    // display currency, so matching against it would make search results vary
    // by preference.
    transaction.amount,
    transaction.note,
    formatTransactionDate(transaction.created_at),
  ]

  return searchableValues.some((value) => String(value ?? '').toLowerCase().includes(query))
}
