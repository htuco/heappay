import { Receipt } from 'lucide-react'

import WalletSection from './WalletSection'

export default function RecentTransactionsByCard() {
	return (
		<WalletSection
			title="Recent Transactions"
			subtitle="Card-level transaction history is coming soon."
			icon={<Receipt className="h-5 w-5" strokeWidth={2} />}
			actions={
				<span className="rounded-chip border border-dashed border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
					Coming soon
				</span>
			}
		>
			<div className="rounded-surface border border-dashed border-border bg-muted/20 p-10 text-center">
				<Receipt
					className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50"
					strokeWidth={1.5}
				/>
				<p className="text-sm font-medium text-card-foreground">
					Transaction history coming soon
				</p>
				<p className="mt-1 text-xs text-muted-foreground">
					Per-card activity will appear here once this feature is available.
				</p>
			</div>
		</WalletSection>
	)
}
