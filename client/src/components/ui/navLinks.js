import {
  ArrowLeftRight,
  CalendarClock,
  ChartPie,
  Contact,
  CreditCard,
  LayoutDashboard,
  Repeat,
  ScrollText,
  Settings,
  ShieldUser,
  Table2,
  TicketCheck,
  Users,
} from 'lucide-react'

/**
 * Nav order is by expected frequency of use, not by the order these pages were
 * built: the things a user opens every session sit at the top, the ones they
 * configure once or reach for occasionally sit at the bottom. Keep that rule
 * when adding a link — do not simply append.
 */
export const MAIN_NAV_LINKS = [
  // Landing surface after login.
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  // Checking history is the most repeated action in a wallet — above card
  // management, which is occasional (add, freeze, set main).
  { name: 'My Transactions', path: '/transactions', icon: ArrowLeftRight },
  { name: 'Wallet', path: '/wallet', icon: CreditCard },
  // Feeds the send flow, so it is reached more often than the two below.
  { name: 'Contacts', path: '/contacts', icon: Contact },
  // Set up once, then only checked for what is coming due.
  // CalendarClock, not Repeat — Converter already owns Repeat in this list.
  { name: 'Recurring', path: '/recurring', icon: CalendarClock },
  // Insight surface — checked occasionally, so it sits with the other
  // non-core pages.
  { name: 'Analytics', path: '/analytics', icon: ChartPie },
  // Reference utility, not part of any core task.
  { name: 'Converter', path: '/converter', icon: Repeat },
  // Guardian/dependent setup — configured occasionally, not a core task.
  { name: 'Family', path: '/family', icon: Users },
]

// Work queues before browse-only lists: the admin loop starts at a pending
// request, then looks up the user, then checks their transactions. Audit log is
// read-only forensics and comes last.
export const ADMIN_NAV_LINKS = [
  { name: 'Overview', path: '/admin', icon: LayoutDashboard },
  { name: 'Requests', path: '/admin/requests', icon: TicketCheck },
  { name: 'Users', path: '/admin/users', icon: ShieldUser },
  { name: 'All Transactions', path: '/admin/transactions', icon: Table2 },
  { name: 'Audit log', path: '/admin/audit-log', icon: ScrollText },
]

// Same rule as above — the ticket queue is where a support session starts.
export const SUPPORT_NAV_LINKS = [
  { name: 'Tickets', path: '/support/tickets', icon: TicketCheck },
  { name: 'Users', path: '/support/users', icon: Users },
]

export const SETTINGS_NAV_LINK = { name: 'Settings', path: '/settings', icon: Settings }

export const STAFF_ROLES = new Set(['admin', 'support'])

export function getRoleNavLinks(role) {
  const isAdmin = role === 'admin'
  const isStaff = STAFF_ROLES.has(role)
  if (!isStaff) return []
  return isAdmin ? ADMIN_NAV_LINKS : SUPPORT_NAV_LINKS
}
