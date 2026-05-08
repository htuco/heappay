import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import transactionsService from '@/services/transactionsService'

const DEFAULT_PAGE_SIZE = 20

/**
 * Fetch and paginate transactions for the current user.
 *
 * When `cardId` is provided the results are scoped to transactions where that
 * card appears as sender or recipient (the card must belong to the logged-in
 * user). When omitted, all of the user's transactions are returned.
 *
 * @param {{ cardId?: number, pageSize?: number }} [options]
 */
export function useTransactions({ cardId, pageSize = DEFAULT_PAGE_SIZE } = {}) {
  const { user, isLoading: authLoading } = useAuth()

  const [transactions, setTransactions] = useState([])
  const [page, setPageState] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const setPage = useCallback((nextPage) => {
    setPageState(nextPage)
  }, [])

  // Reset to page 1 whenever cardId changes so we don't stay on a stale page.
  const prevCardId = useRef(cardId)
  useEffect(() => {
    if (prevCardId.current !== cardId) {
      prevCardId.current = cardId
      setPageState(1)
    }
  }, [cardId])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setTransactions([])
      setTotal(0)
      setTotalPages(0)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    const params = { page, pageSize }
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

    return () => {
      cancelled = true
    }
  }, [authLoading, user, cardId, page, pageSize, refreshKey])

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
