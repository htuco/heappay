import { AlertCircle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'

export default function TransactionHistoryErrorState({ message, onRetry }) {
  return (
    <div className="rounded-input border border-destructive/25 bg-destructive/10 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div>
            <h3 className="text-sm font-semibold text-destructive">Could not load transactions</h3>
            <p className="mt-1 text-sm leading-6 text-destructive/85">
              {message || 'Please try refreshing the transaction history.'}
            </p>
          </div>
        </div>
        <Button variant="outline" className="w-full sm:w-auto" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" />
          Retry
        </Button>
      </div>
    </div>
  )
}
