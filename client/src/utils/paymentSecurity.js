export function userRequiresPaymentConfirmation(user, amount) {
  if (!user || user.payment_confirm_enabled === false) return false
  const threshold = Number(user.payment_confirm_above_amount ?? 0)
  const value = Number(amount)
  if (!Number.isFinite(value)) return false
  return value >= threshold
}

/**
 * Not a component, so the caller passes in its bound `formatMoney`.
 *
 * The threshold is stored in the base currency and compared in it; only its
 * presentation follows the display currency.
 */
export function paymentConfirmationLabel(user, formatMoney) {
  if (!user || user.payment_confirm_enabled === false) {
    return `Only required when biometrics, app PIN, or payments over ${formatMoney(100)} apply.`
  }
  const threshold = Number(user.payment_confirm_above_amount ?? 0)
  if (threshold <= 0) {
    return 'Every outbound payment requires verification before sending.'
  }
  return `Payments of ${formatMoney(threshold)} or more require verification before sending.`
}
