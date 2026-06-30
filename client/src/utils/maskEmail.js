export function maskEmail(email) {
  if (!email || typeof email !== 'string') return ''
  const [local, domain] = email.split('@')
  if (!domain) return email
  if (local.length <= 1) return `*@${domain}`
  return `${local[0]}***@${domain}`
}
