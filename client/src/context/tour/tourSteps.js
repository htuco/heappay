// The tour as data — reviewable without reading the engine. Each step names a
// `route` (the engine navigates there via the router, waits for the anchor to
// mount, then positions the popover), an `anchor` (a `data-tour="<id>"`
// attribute on a real DOM node), the copy, and a preferred `placement`.
//
// Steps point at page *content* (or the page's top-bar action), never at the
// sidebar/MobileTabBar — the engine changes routes itself, so the tour doesn't
// depend on which nav chrome a given viewport renders. A step whose anchor
// isn't on the page (e.g. the wallet card carousel for a user with no cards) is
// skipped by the engine rather than left dangling.
// Surfaces deliberately skipped: Analytics, Converter, Family, and all
// admin/support tooling. Those are either still thin, or staff-only — the tour
// is the same user-facing walkthrough for every role, including staff.
export const TOUR_STEPS = [
	{
		id: 'dashboard-balance',
		route: '/dashboard',
		anchor: 'dashboard-balance',
		title: 'Your total balance',
		body: 'Everything across your wallet and cards, at a glance. Available balance is your ledger minus anything still pending — reserved funds are held for scheduled payments, not spent yet.',
		placement: 'bottom',
	},
	{
		id: 'dashboard-quick-actions',
		route: '/dashboard',
		anchor: 'dashboard-quick-actions',
		title: 'Quick actions',
		body: 'Send money, top up a card, or add a new one without leaving the dashboard.',
		placement: 'left',
	},
	{
		id: 'wallet-cards',
		route: '/wallet',
		anchor: 'wallet-cards',
		title: 'Your cards',
		body: 'Swipe through your cards here. Each card shows its own available balance, and any reserved amount held for scheduled payments.',
		placement: 'left',
	},
	{
		id: 'wallet-add-card',
		route: '/wallet',
		anchor: 'wallet-add-card',
		title: 'Add a card',
		body: 'Add another card to your wallet any time. You can set a default card in Settings for one-tap payments.',
		placement: 'bottom',
	},
	{
		id: 'transactions-send',
		route: '/transactions',
		anchor: 'transactions-send',
		title: 'Send money',
		body: 'Start a payment or transfer from here. A payment applies when it settles rather than the moment you create it, so you may briefly see it as pending.',
		placement: 'bottom',
	},
	{
		id: 'transactions-filters',
		route: '/transactions',
		anchor: 'transactions-filters',
		title: 'Find any transaction',
		body: 'Search and filter by status, type, card, or date. What you filter to is exactly what an exported PDF contains.',
		placement: 'bottom',
	},
	{
		id: 'transactions-list',
		route: '/transactions',
		anchor: 'transactions-list',
		title: 'Your history',
		body: 'Every payment, transfer, and refund. Open a row for the full detail, including where to request a refund — refunds are reviewed before they apply, not instant.',
		placement: 'top',
	},
	{
		id: 'recurring-summary',
		route: '/recurring',
		anchor: 'recurring-summary',
		title: 'Recurring payments',
		body: 'Set up a rule once and Heap runs it on schedule. These tiles summarise your active plans and what runs next.',
		placement: 'bottom',
	},
	{
		id: 'contacts-add',
		route: '/contacts',
		anchor: 'contacts-add',
		title: 'Save people you pay',
		body: 'Add someone as a contact and pay them again in two clicks — no card details to re-enter.',
		placement: 'bottom',
	},
	{
		id: 'settings-nav',
		route: '/settings',
		anchor: 'settings-nav',
		title: 'Make Heap yours',
		body: 'Set your default card, tune notification and privacy preferences, and manage security — all from Settings. That’s the tour!',
		placement: 'right',
	},
]

export const TOUR_STEP_COUNT = TOUR_STEPS.length
