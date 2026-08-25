export const CONTACT_VIEWS = {
  all: 'all',
  pinned: 'pinned',
  recent: 'recent',
}

export const CONTACT_VIEW_OPTIONS = [
  { value: CONTACT_VIEWS.all, label: 'All' },
  { value: CONTACT_VIEWS.pinned, label: 'Pinned' },
  { value: CONTACT_VIEWS.recent, label: 'Recent' },
]

export const CONTACT_VIEW_HEADINGS = {
  [CONTACT_VIEWS.all]: 'All contacts',
  [CONTACT_VIEWS.pinned]: 'Pinned contacts',
  [CONTACT_VIEWS.recent]: 'Recently paid',
}

function matchesSearch(contact, query) {
  if (!query) return true
  return [
    contact.display_name,
    contact.email,
    contact.alias,
    contact.first_name,
    contact.last_name,
    contact.default_card?.last_four,
  ].some((value) => value?.toLowerCase().includes(query))
}

function lastPaidTime(contact, payments) {
  const at = payments[contact.user_id]?.lastAt
  return at ? new Date(at).getTime() : 0
}

/**
 * Applies the search box and the All / Pinned / Recent view to the contact list.
 * Contact lists are small, so this runs client-side over the single fetch
 * `useContacts` already made.
 *
 * "Recent" orders by the last payment sent to each contact (never-paid people
 * fall to the bottom); the other views keep the API's order — favourites first,
 * then name.
 */
export function filterContacts(contacts, { search, view }, payments = {}) {
  const query = search.trim().toLowerCase()

  const filtered = contacts.filter((contact) => {
    if (!matchesSearch(contact, query)) return false
    if (view === CONTACT_VIEWS.pinned && !contact.is_favorite) return false
    return true
  })

  if (view === CONTACT_VIEWS.recent) {
    return [...filtered].sort((a, b) => lastPaidTime(b, payments) - lastPaidTime(a, payments))
  }

  return filtered
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/**
 * Short recency label for a payment date — "Today", "Yesterday", "3 days ago",
 * "2 weeks ago", "5 months ago". Returns null for a missing date so callers can
 * render their own "Never paid" copy.
 */
export function formatRelativeDate(value) {
  if (!value) return null
  const then = new Date(value)
  if (Number.isNaN(then.getTime())) return null

  const diff = Date.now() - then.getTime()
  if (diff < HOUR) return 'Just now'
  if (diff < DAY) return 'Today'

  const days = Math.floor(diff / DAY)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`

  const weeks = Math.floor(days / 7)
  if (weeks < 5) return weeks === 1 ? 'Last week' : `${weeks} weeks ago`

  const months = Math.floor(days / 30)
  if (months < 12) return months === 1 ? 'Last month' : `${months} months ago`

  const years = Math.floor(days / 365)
  return years === 1 ? 'Last year' : `${years} years ago`
}

// The quick-send chips used to build their own "$1.1k" strings. Compacting is
// now `formatMoneyCompact` from `useDisplayCurrency()`; this only decides whether
// there is an amount worth showing at all.
export function hasCompactAmount(value) {
  return value != null && Number.isFinite(Number(value))
}
