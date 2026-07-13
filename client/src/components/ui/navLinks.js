import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldUser,
  TicketCheck,
  Users,
} from 'lucide-react'

export const MAIN_NAV_LINKS = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Wallet', path: '/wallet', icon: CreditCard },
  { name: 'Transactions', path: '/payments', icon: ArrowLeftRight },
]

export const ADMIN_NAV_LINKS = [
  { name: 'Overview', path: '/admin', icon: LayoutDashboard },
  { name: 'Users', path: '/admin/users', icon: ShieldUser },
  { name: 'Transactions', path: '/admin/transactions', icon: ArrowLeftRight },
  { name: 'Requests', path: '/admin/requests', icon: TicketCheck },
  { name: 'Audit log', path: '/admin/audit-log', icon: ScrollText },
]

export const SUPPORT_NAV_LINKS = [
  { name: 'Users', path: '/support/users', icon: Users },
  { name: 'Tickets', path: '/support/tickets', icon: TicketCheck },
]

export const SETTINGS_NAV_LINK = { name: 'Settings', path: '/settings', icon: Settings }

export const STAFF_ROLES = new Set(['admin', 'support'])

export function getRoleNavLinks(role) {
  const isAdmin = role === 'admin'
  const isStaff = STAFF_ROLES.has(role)
  if (!isStaff) return []
  return isAdmin ? ADMIN_NAV_LINKS : SUPPORT_NAV_LINKS
}
