import { Star, Wallet } from 'lucide-react'

function formatBalance(value) {
	const num = Number(value ?? 0)
	if (Number.isNaN(num)) return '0.00'
	return num.toLocaleString('en-US', {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	})
}

export default function BalancePanel({
	activeCard,
	isLoading = false,
	addCardSlot,
	manageCardsSlot,
}) {
	const hasCard = !!activeCard
	const balance = formatBalance(activeCard?.balance)
	const cardNumber = activeCard?.card?.cardNumber ?? '—'

	return (
		<aside className="flex h-full flex-col justify-between gap-8 rounded-3xl bg-linear-to-br from-primary via-primary to-primary-dark p-6 text-primary-foreground shadow-xl shadow-primary/30 sm:p-8">
			<div>
				<span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
					<Wallet className="h-3.5 w-3.5" strokeWidth={2.4} />
					Active Balance
				</span>

				{isLoading ? (
					<div className="mt-5 space-y-3">
						<div className="shimmer h-3 w-32 rounded-full" />
						<div className="shimmer h-12 w-48 rounded-lg" />
					</div>
				) : hasCard ? (
					<>
						<div className="mt-5 flex items-center gap-2">
							<p className="font-mono text-sm tracking-widest text-primary-foreground/80">
								{cardNumber}
							</p>
							{activeCard?.isMain && (
								<span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-primary-foreground backdrop-blur">
									<Star className="h-3 w-3 fill-primary-foreground" />
									Main
								</span>
							)}
						</div>
						<p className="tabular mt-1 text-4xl font-bold leading-tight sm:text-5xl">
							${balance}
						</p>
					</>
				) : (
					<>
						<p className="mt-5 text-sm text-primary-foreground/80">No active card</p>
						<p className="tabular mt-1 text-4xl font-bold leading-tight sm:text-5xl">
							$0.00
						</p>
					</>
				)}
			</div>

			<div className="flex flex-col gap-2">
				{addCardSlot}
				{manageCardsSlot}
			</div>
		</aside>
	)
}
