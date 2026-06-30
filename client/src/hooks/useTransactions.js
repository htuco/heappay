import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import transactionsService from '@/services/transactionsService'
import { subscribeDataChange } from '@/utils/dataEvents'

const DEFAULT_PAGE_SIZE = 20

function getUserId(user) {
  return user?.id ?? user?.user_id ?? null
}

/**
 * Fetch and paginate transactions for the current user.
 *
 * When `cardId` is provided the results are scoped to transactions where that
 * card appears as sender or recipient (the card must belong to the logged-in
 * user). When omitted, all of the user's transactions are returned.
 *
 * Status and transaction-type filtering are applied server-side (the list
 * endpoints accept `status_id` / `transaction_type_id`), so filtering stays
 * correct across pages. Date + free-text search remain client-side over the
 * current page.
 *
 * @param {{ cardId?: number, pageSize?: number, statusId?: number, transactionTypeId?: number, categoryId?: number }} [options]
 */
export function useTransactions({
  cardId,
  pageSize = DEFAULT_PAGE_SIZE,
  statusId,
  transactionTypeId,
  categoryId,
} = {}) {
  const { user, isLoading: authLoading } = useAuth()
  const userId = getUserId(user)

  const [transactions, setTransactions] = useState([])
  const [page, setPageState] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setPageState(1)
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    return subscribeDataChange(() => {
      refresh()
    })
  }, [refresh])

  const setPage = useCallback((nextPage) => {
    setPageState(nextPage)
  }, [])

  // Reset to page 1 whenever a server-side query input changes so we don't stay
  // on a stale page (e.g. page 3 of "all" after switching to a status with one page).
  const prevQuery = useRef({ cardId, statusId, transactionTypeId, categoryId })
  useEffect(() => {
    const prev = prevQuery.current
    if (
      prev.cardId !== cardId ||
      prev.statusId !== statusId ||
      prev.transactionTypeId !== transactionTypeId ||
      prev.categoryId !== categoryId
    ) {
      prevQuery.current = { cardId, statusId, transactionTypeId, categoryId }
      let cancelled = false
      Promise.resolve().then(() => {
        if (!cancelled) setPageState(1)
      })
      return () => {
        cancelled = true
      }
    }
  }, [cardId, statusId, transactionTypeId, categoryId])

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      let cancelled = false
      Promise.resolve().then(() => {
        if (cancelled) return
        setTransactions([])
        setTotal(0)
        setTotalPages(0)
        setIsLoading(false)
      })
      return () => {
        cancelled = true
      }
    }

    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      setIsLoading(true)
      setError(null)

      const params = { page, pageSize }
      if (typeof statusId === 'number') params.statusId = statusId
      if (typeof transactionTypeId === 'number') params.transactionTypeId = transactionTypeId
      if (typeof categoryId === 'number') params.categoryId = categoryId
      const fetch =
        cardId != null
          ? transactionsService.listByCard(cardId, params)
          : transactionsService.list(params)

      fetch
        .then((pageData) => {
          if (cancelled) return
          setTransactions(pageData.items)
          setTotal(pageData.total)
          setTotalPages(pageData.total_pages)
        })
        .catch((err) => {
          if (!cancelled) setError(err)
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false)
        })
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, userId, cardId, page, pageSize, statusId, transactionTypeId, categoryId, refreshKey])

  return {
    transactions,
    page,
    totalPages,
    total,
    isLoading: authLoading || isLoading,
    error,
    setPage,
    refresh,
  }
}
