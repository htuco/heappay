import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import transactionsService from '@/services/transactionsService'
import { subscribeDataChange } from '@/utils/dataEvents'

// `GET /transactions` caps page_size at 100, so a full history needs paging.
// Contacts only needs enough recent history to answer "when did I last pay this
// person, and how much" — three pages is plenty for that and keeps the page to
// at most three requests. `truncated` says whether older transactions exist.
const PAGE_SIZE = 100
const MAX_PAGES = 3
const RECENT_PER_CONTACT = 3

// Failed / cancelled / reversed money never left the account, so it must not
// count as a payment. Pending does count: the amount is already reserved
// (escrow applies on create), so hiding it would read as "never paid" right
// after a send. See transactionHistory.utils.js for the status ids.
const EXCLUDED_STATUS_IDS = new Set([3, 4, 5])

function toEntry() {
  return { lastAmount: null, lastAt: null, sentThisYear: 0, recent: [] }
}

/**
 * Indexes the current user's outgoing transactions by the counterparty's user
 * id, so the contacts list can show payment context (last amount, recency,
 * total sent this year, recent payments) next to each person.
 *
 * @returns {{ byUserId: Record<number, { lastAmount: number|null, lastAt: string|null, sentThisYear: number, recent: Array<{ id: number, note: string|null, amount: number, at: string }> }>, isLoading: boolean, truncated: boolean, error: string|null, year: number }}
 */
export function useContactPayments() {
  const { user, isLoading: authLoading } = useAuth()
  const userId = user?.id ?? user?.user_id ?? null

  const [state, setState] = useState({
    byUserId: {},
    isLoading: true,
    truncated: false,
    error: null,
  })
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => subscribeDataChange(refresh), [refresh])

  useEffect(() => {
    if (authLoading) return

    let cancelled = false

    Promise.resolve().then(async () => {
      if (cancelled) return
      if (!userId) {
        setState({ byUserId: {}, isLoading: false, truncated: false, error: null })
        return
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const rows = []
        let truncated = false

        for (let page = 1; page <= MAX_PAGES; page += 1) {
          const pageData = await transactionsService.list({ page, pageSize: PAGE_SIZE })
          if (cancelled) return
          rows.push(...pageData.items)
          if (page >= pageData.total_pages) break
          if (page === MAX_PAGES) truncated = true
        }

        setState({ byUserId: indexByCounterparty(rows, userId), isLoading: false, truncated, error: null })
      } catch (err) {
        if (cancelled) return
        setState({ byUserId: {}, isLoading: false, truncated: false, error: err.message })
      }
    })

    return () => {
      cancelled = true
    }
  }, [authLoading, userId, refreshKey])

  return { ...state, refresh, year: new Date().getFullYear() }
}

function indexByCounterparty(rows, userId) {
  const thisYear = new Date().getFullYear()
  const byUserId = {}

  // The list arrives newest-first, so the first row seen for a counterparty is
  // their most recent payment.
  for (const tx of rows) {
    if (tx.sender?.user_id !== userId) continue
    if (EXCLUDED_STATUS_IDS.has(tx.status_id)) continue
    if (tx.amount == null) continue

    const counterpartyId = tx.recipient?.user_id
    if (counterpartyId == null || counterpartyId === userId) continue

    const entry = (byUserId[counterpartyId] ??= toEntry())
    const amount = Number(tx.amount)

    if (entry.lastAt === null) {
      entry.lastAmount = amount
      entry.lastAt = tx.created_at
    }
    if (new Date(tx.created_at).getFullYear() === thisYear) {
      entry.sentThisYear += amount
    }
    if (entry.recent.length < RECENT_PER_CONTACT) {
      entry.recent.push({ id: tx.transaction_id, note: tx.note, amount, at: tx.created_at })
    }
  }

  return byUserId
}

export default useContactPayments
