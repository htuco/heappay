export function userRequiresPaymentConfirmation(user, amount) {
  if (!user || user.payment_confirm_enabled === false) return false
  const threshold = Number(user.payment_confirm_above_amount ?? 0)
  const value = Number(amount)
  if (!Number.isFinite(value)) return false
  return value >= threshold
}

export function paymentConfirmationLabel(user) {
  if (!user || user.payment_confirm_enabled === false) {
    return 'Only required when biometrics, app PIN, or payments over $100 apply.'
  }
  const threshold = Number(user.payment_confirm_above_amount ?? 0)
  if (threshold <= 0) {
    return 'Every outbound payment requires verification before sending.'
  }
  return `Payments of $${threshold.toFixed(2)} or more require verification before sending.`
}
