import { ShieldCheck } from 'lucide-react'

/**
 * Reassurance footer shown under the wallet's quick actions — static copy, no
 * interaction. Mirrors the "Secure & Protected" note from the design.
 */
export default function WalletSecurityNote() {
  return (
    <section className="flex items-start gap-3 rounded-panel border border-border bg-card p-5 shadow-sm sm:p-6">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-input bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <ShieldCheck className="size-4.5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-card-foreground">Secure &amp; Protected</p>
        <p className="text-xs leading-snug text-muted-foreground">
          Your transactions are protected with 256-bit encryption.
        </p>
      </div>
    </section>
  )
}
