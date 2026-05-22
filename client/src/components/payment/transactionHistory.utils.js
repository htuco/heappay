const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

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
]

export const TRANSACTION_TYPE_OPTIONS = [
  { value: '1', label: 'Deposit' },
  { value: '2', label: 'Payment' },
  { value: '3', label: 'Refund' },
  { value: '4', label: 'Withdrawal' },
  { value: '5', label: 'Chargeback' },
]

export function formatTransactionAmount(amount) {
  const numericAmount = Number(amount)
  if (Number.isNaN(numericAmount)) return amount
  return currencyFormatter.format(numericAmount)
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

export function getTransactionStatus(statusId) {
  if (statusId === 1) return { label: 'Pending', variant: 'warning' }
  if (statusId === 2) return { label: 'Completed', variant: 'success' }
  if (statusId === 3) return { label: 'Failed', variant: 'error' }
  if (statusId === 4) return { label: 'Reversed', variant: 'secondary' }
  return { label: `Status ${statusId}`, variant: 'secondary' }
}

export function getTransactionType(typeId) {
  const option = TRANSACTION_TYPE_OPTIONS.find((type) => Number(type.value) === typeId)
  return option?.label ?? `Type ${typeId}`
}

export function transactionMatchesFilters(transaction, { date, status, type }) {
  if (date) {
    const transactionDate = new Date(transaction.created_at)
    if (Number.isNaN(transactionDate.getTime())) return false

    const transactionDateValue = formatTransactionDateInputValue(transactionDate)
    if (transactionDateValue !== date) return false
  }

  if (status !== 'all' && String(transaction.status_id) !== status) return false
  if (type !== 'all' && String(transaction.transaction_type_id) !== type) return false

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
    transaction.amount,
    formatTransactionAmount(transaction.amount),
    transaction.note,
    formatTransactionDate(transaction.created_at),
  ]

  return searchableValues.some((value) => String(value ?? '').toLowerCase().includes(query))
}
