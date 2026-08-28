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
 * Every filter -- including the card scope and the free-text search -- is
 * applied server-side by the one `/transactions` endpoint, so results stay
 * correct across pages and the "X of N" count stays truthful. The card scope
 * used to go to `/transactions/card/{id}`, which silently ignored every other
 * filter; it is now just another query param on the same call.
 *
 * @param {{ cardId?: number, pageSize?: number, statusId?: number, transactionTypeId?: number, categoryId?: number, fromDate?: string, toDate?: string, search?: string, sort?: string }} [options]
 */
export function useTransactions({
  cardId,
  pageSize = DEFAULT_PAGE_SIZE,
  statusId,
  transactionTypeId,
  categoryId,
  fromDate,
  toDate,
  search,
  sort = 'newest',
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
  const prevQuery = useRef({
    cardId, statusId, transactionTypeId, categoryId, fromDate, toDate, search, sort,
  })
  useEffect(() => {
    const prev = prevQuery.current
    if (
      prev.cardId !== cardId ||
      prev.statusId !== statusId ||
      prev.transactionTypeId !== transactionTypeId ||
      prev.categoryId !== categoryId ||
      prev.fromDate !== fromDate ||
      prev.toDate !== toDate ||
      prev.search !== search ||
      prev.sort !== sort
    ) {
      prevQuery.current = {
        cardId, statusId, transactionTypeId, categoryId, fromDate, toDate, search, sort,
      }
      let cancelled = false
      Promise.resolve().then(() => {
        if (!cancelled) setPageState(1)
      })
      return () => {
        cancelled = true
      }
    }
  }, [cardId, statusId, transactionTypeId, categoryId, fromDate, toDate, search, sort])

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

      const params = { page, pageSize, sort }
      if (typeof statusId === 'number') params.statusId = statusId
      if (typeof transactionTypeId === 'number') params.transactionTypeId = transactionTypeId
      if (typeof categoryId === 'number') params.categoryId = categoryId
      if (typeof cardId === 'number') params.cardId = cardId
      if (fromDate) params.fromDate = fromDate
      if (toDate) params.toDate = toDate
      if (search) params.search = search

      transactionsService
        .list(params)
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
  }, [authLoading, userId, cardId, page, pageSize, statusId, transactionTypeId, categoryId, fromDate, toDate, search, sort, refreshKey])

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
