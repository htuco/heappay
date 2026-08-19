/**
 * @param {string} iso
 * @returns {string}
 */
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function formatClock12(d) {
  let h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  const mm = String(m).padStart(2, '0')
  return `${h12}:${mm} ${ampm}`
}

export function humanizeTransactionTimestamp(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const day = new Date(d)
  day.setHours(0, 0, 0, 0)

  const timeStr = formatClock12(d)

  if (day.getTime() === today.getTime()) return `Today, ${timeStr}`
  if (day.getTime() === yesterday.getTime()) return `Yesterday, ${timeStr}`

  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${timeStr}`
}

/**
 * @param {import('@/types/transaction').Transaction} tx
 * @param {{
 *   currentUserCardIds: Set<number>,
 *   lastFourByCardId: Map<number, string>,
 *   typeNameById: Record<number, string>,
 * }} ctx
 * @returns {{ id: number, title: string, timestamp: string, amount: string, direction: 'in' | 'out' }}
 */
export function mapTransactionToActivityItem(tx, ctx, formatMoney) {
  const { currentUserCardIds: userCardIds, lastFourByCardId, typeNameById } = ctx
  const rawName = typeNameById[tx.transaction_type_id] ?? 'transfer'
  const typeLabel = rawName.length
    ? rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase()
    : 'Transfer'

  const last4Known = (cardId) => {
    if (cardId == null || !Number.isFinite(Number(cardId))) return null
    const id = Number(cardId)
    if (!lastFourByCardId.has(id)) return null
    return lastFourByCardId.get(id) ?? null
  }

  const senderId = tx.sender_card_id
  const recipientId = tx.recipient_card_id
  const userSent =
    senderId != null && userCardIds.has(Number(senderId))
  const userReceived = userCardIds.has(Number(recipientId))

  let counterpartyLine = ''
  let direction = /** @type {'in' | 'out'} */ ('out')

  if (userSent) {
    direction = 'out'
    const r4 = last4Known(recipientId)
    counterpartyLine = `Sent to ${r4 ? `••••${r4}` : 'external card'}`
  } else if (userReceived) {
    direction = 'in'
    if (senderId == null) {
      counterpartyLine = 'Received from top-up'
    } else {
      const s4 = last4Known(senderId)
      counterpartyLine = `Received from ${s4 ? `••••${s4}` : 'external card'}`
    }
  } else {
    direction = 'in'
    counterpartyLine = 'Activity'
  }

  const title = `${typeLabel} · ${counterpartyLine}`
  const timestamp = humanizeTransactionTimestamp(tx.created_at)

  // Not a component, so the caller passes its bound formatter in.
  const money = formatMoney(tx.amount, { absolute: true })
  const amount = direction === 'in' ? `+${money}` : `-${money}`

  return {
    id: tx.transaction_id,
    title,
    timestamp,
    amount,
    direction,
  }
}

/**
 * @param {Array<{ id: string, source?: { last_four?: string, card_id?: number }, card?: { cardNumber?: string } }>} cards
 * @returns {Map<number, string>} card_id → last four digits
 */
export function buildCardLastFourMapFromDashboardCards(cards) {
  const map = new Map()
  for (const c of cards) {
    const id = Number(c.id)
    if (!Number.isFinite(id)) continue
    const fromApi = c.source?.last_four
    const digits = String(c.card?.cardNumber ?? '').replace(/\D/g, '')
    const fromMask = digits.length >= 4 ? digits.slice(-4) : ''
    const raw = String(fromApi ?? '').replace(/\D/g, '').slice(-4) || fromMask
    if (raw.length === 4) map.set(id, raw)
  }
  return map
}

/**
 * @param {Array<{ id: string }>} cards
 * @returns {Set<number>}
 */
export function buildUserCardIdSet(cards) {
  return new Set(
    cards.map((c) => Number(c.id)).filter((n) => Number.isFinite(n)),
  )
}
