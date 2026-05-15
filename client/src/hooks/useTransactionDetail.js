import { useEffect, useMemo, useReducer } from 'react'
import transactionsService from '@/services/transactionsService'

function getTransactionId(transaction) {
  return transaction?.transaction_id ?? transaction?.id ?? transaction?.payment_id ?? null
}

export function useTransactionDetail(transaction) {
  const transactionId = useMemo(() => getTransactionId(transaction), [transaction])
  const [state, dispatch] = useReducer((current, action) => {
    switch (action.type) {
      case 'idle':
        return { detail: null, isLoading: false, error: null }
      case 'loading':
        return { detail: null, isLoading: true, error: null }
      case 'success':
        return { detail: action.detail, isLoading: false, error: null }
      case 'error':
        return { ...current, isLoading: false, error: action.error }
      default:
        return current
    }
  }, { detail: null, isLoading: false, error: null })

  useEffect(() => {
    if (!transactionId) {
      dispatch({ type: 'idle' })
      return
    }

    let cancelled = false
    dispatch({ type: 'loading' })

    transactionsService
      .getById(transactionId)
      .then((data) => {
        if (!cancelled) dispatch({ type: 'success', detail: data })
      })
      .catch((err) => {
        if (!cancelled) dispatch({ type: 'error', error: err })
      })

    return () => {
      cancelled = true
    }
  }, [transactionId])

  return {
    detail: state.detail ?? transaction ?? null,
    hasApiDetail: Boolean(state.detail),
    isLoading: state.isLoading,
    error: state.error,
  }
}

export default useTransactionDetail
