import { useState } from 'react'
import { ArrowLeftRight, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import Skeleton from '@/components/ui/skeleton'
import { useWallet } from '@/hooks/useWallet'
import WalletTransferModal from '@/components/wallet/WalletTransferModal'
import { formatMoney } from '@/utils/amount'

/**
 * Wallet (unallocated funds) balance with a Transfer action. Sits above the
 * card carousel so the wallet vs card split is visible at a glance, and hosts
 * the wallet↔card transfer modal.
 */
export default function WalletBalanceCard({ cards = [], isLoading = false }) {
  const { walletBalance, isLoading: walletLoading, transfer } = useWallet()
  const [transferOpen, setTransferOpen] = useState(false)
  const loading = isLoading || walletLoading

  return (
    <section className="relative overflow-hidden rounded-panel bg-linear-to-br from-primary via-primary to-primary-dark p-5 text-primary-foreground shadow-xl shadow-primary/30 sm:p-6">
      <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-white/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-white/10 blur-3xl" />

      <div className="relative z-10 flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-chip bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
          <Wallet className="h-3.5 w-3.5" strokeWidth={2.4} />
          Wallet Balance
        </span>
      </div>

      <div className="relative z-10 mt-4">
        {loading ? (
          <Skeleton className="h-10 w-40 bg-white/20" />
        ) : (
          <p className="tabular-nums text-4xl font-bold tracking-tight leading-none">
            {formatMoney(walletBalance)}
          </p>
        )}
        <p className="mt-2 text-xs text-primary-foreground/75">
          Unallocated funds — move to a card to spend.
        </p>
      </div>

      <div className="relative z-10 mt-5">
        <Button
          variant="outline"
          onClick={() => setTransferOpen(true)}
          disabled={loading}
          className="w-full justify-center gap-2 border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20"
        >
          <ArrowLeftRight className="h-4 w-4" strokeWidth={2.2} />
          Transfer
        </Button>
      </div>

      <WalletTransferModal
        isOpen={transferOpen}
        onClose={() => setTransferOpen(false)}
        cards={cards}
        walletBalance={walletBalance}
        onTransfer={transfer}
      />
    </section>
  )
}
