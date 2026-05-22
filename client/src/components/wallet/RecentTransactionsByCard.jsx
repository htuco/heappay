import { useMemo } from 'react'
import { ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react'

import WalletSection from './WalletSection'
import TransactionsLoadingOverlay from './TransactionsLoadingOverlay'

const PLACEHOLDER_TRANSACTIONS_BY_CARD = {
	default: [
		{ id: 'tx-d-1', direction: 'out', title: 'Coffee Shop', subtitle: 'Payment · 12 Apr', amount: '12.40' },
		{ id: 'tx-d-2', direction: 'in', title: 'Salary', subtitle: 'Deposit · 10 Apr', amount: '2,400.00' },
		{ id: 'tx-d-3', direction: 'out', title: 'Spotify', subtitle: 'Payment · 09 Apr', amount: '9.99' },
		{ id: 'tx-d-4', direction: 'out', title: 'Grocery Market', subtitle: 'Payment · 08 Apr', amount: '64.30' },
		{ id: 'tx-d-5', direction: 'in', title: 'Card top up', subtitle: 'Deposit · 07 Apr', amount: '250.00' },
		{ id: 'tx-d-6', direction: 'out', title: 'Taxi ride', subtitle: 'Payment · 06 Apr', amount: '18.75' },
	],
}

function buildCardTransactions(cardId, last4) {
	return [
		{
			id: `tx-${cardId}-1`,
			direction: 'out',
			title: 'Online purchase',
			subtitle: `Payment · •••• ${last4}`,
			amount: '48.20',
		},
		{
			id: `tx-${cardId}-2`,
			direction: 'in',
			title: 'Refund',
			subtitle: `Deposit · •••• ${last4}`,
			amount: '15.00',
		},
		{
			id: `tx-${cardId}-3`,
			direction: 'out',
			title: 'Groceries',
			subtitle: `Payment · •••• ${last4}`,
			amount: '63.75',
		},
		{
			id: `tx-${cardId}-4`,
			direction: 'out',
			title: 'Restaurant',
			subtitle: `Payment · •••• ${last4}`,
			amount: '42.10',
		},
		{
			id: `tx-${cardId}-5`,
			direction: 'in',
			title: 'Card top up',
			subtitle: `Deposit · •••• ${last4}`,
			amount: '200.00',
		},
		{
			id: `tx-${cardId}-6`,
			direction: 'out',
			title: 'Subscription',
			subtitle: `Payment · •••• ${last4}`,
			amount: '14.99',
		},
	]
}

function TransactionRow({ tx }) {
	const isIn = tx.direction === 'in'
	const Icon = isIn ? ArrowDownLeft : ArrowUpRight
	const iconClass = isIn
		? 'bg-success/10 text-success'
		: 'bg-destructive/10 text-destructive'
	const sign = isIn ? '+' : '−'
	const amountClass = isIn ? 'text-success' : 'text-card-foreground'

	return (
		<li className="flex items-center justify-between gap-3 rounded-input bg-muted/20 px-4 py-3 transition-colors hover:bg-muted/40">
			<div className="flex min-w-0 items-center gap-3">
				<span
					className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconClass}`}
				>
					<Icon className="h-4 w-4" strokeWidth={2.4} />
				</span>
				<div className="min-w-0">
					<p className="truncate text-sm font-medium text-card-foreground">
						{tx.title}
					</p>
					<p className="truncate text-xs text-muted-foreground">{tx.subtitle}</p>
				</div>
			</div>
			<p className={`tabular shrink-0 text-sm font-semibold ${amountClass}`}>
				{sign}${tx.amount}
			</p>
		</li>
	)
}

export default function RecentTransactionsByCard({
	cards = [],
	activeCardId,
	isLoading = false,
}) {
	const hasCards = cards.length > 0

	const transactions = useMemo(() => {
		if (!activeCardId) return PLACEHOLDER_TRANSACTIONS_BY_CARD.default
		const card = cards.find((c) => c.id === activeCardId)
		const last4 = card?.card?.cardNumber?.slice(-4) ?? '----'
		return buildCardTransactions(activeCardId, last4)
	}, [activeCardId, cards])

	const activeCard = cards.find((c) => c.id === activeCardId)
	const activeLast4 = activeCard?.card?.cardNumber?.slice(-4)

	return (
		<WalletSection
			className="relative"
			title="Recent Transactions"
			subtitle={
				activeLast4
					? `Showing activity for card ending •••• ${activeLast4}`
					: 'Activity for the selected card.'
			}
			icon={<Receipt className="h-5 w-5" strokeWidth={2} />}
			actions={
				<span className="rounded-chip border border-dashed border-border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
					Coming soon
				</span>
			}
		>
			{hasCards ? (
				<ul
					className={`space-y-2 transition-opacity ${
						isLoading ? 'opacity-30' : 'opacity-70'
					}`}
					aria-busy={isLoading}
				>
					{transactions.map((tx) => (
						<TransactionRow key={tx.id} tx={tx} />
					))}
				</ul>
			) : (
				<div className="rounded-surface border border-dashed border-border bg-muted/20 p-10 text-center">
					<p className="text-sm font-medium text-card-foreground">
						No transactions yet
					</p>
					<p className="mt-1 text-xs text-muted-foreground">
						Add a card to start seeing activity here.
					</p>
				</div>
			)}

			{isLoading && hasCards ? <TransactionsLoadingOverlay /> : null}
		</WalletSection>
	)
}
