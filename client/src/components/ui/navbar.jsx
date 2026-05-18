import { NavLink } from 'react-router-dom'
import { ArrowLeftRight, CreditCard, LayoutDashboard, Settings, Shield, Users, TicketCheck } from 'lucide-react'
import { useAppSelector } from '@/store/hooks'
import { selectAuthUser } from '@/store/slices/authSlice'

const mainLinks = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Wallet', path: '/wallet', icon: CreditCard },
  { name: 'Payments', path: '/payments', icon: ArrowLeftRight },
]

const adminLinks = [{ name: 'Admin', path: '/admin', icon: Shield }]
const supportLinks = [
  { name: 'Users', path: '/support/users', icon: Users },
  { name: 'Tickets', path: '/support/tickets', icon: TicketCheck },
]

const bottomLinks = [{ name: 'Settings', path: '/settings', icon: Settings }]

const STAFF_ROLES = new Set(['admin', 'manager', 'support'])

function NavLinkItem({ item }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      end
      className={({ isActive }) =>
        `nav-pill flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-medium ${
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
        }`
      }
    >
      <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
      {item.name}
    </NavLink>
  )
}

export default function Navbar() {
  const user = useAppSelector(selectAuthUser)
  const role = user?.role_name
  const isAdmin = role === 'admin'
  const isStaff = STAFF_ROLES.has(role)

  return (
    <nav className="flex h-full flex-col">
      <div className="flex flex-col gap-1">
        {mainLinks.map((item) => (
          <NavLinkItem key={item.path} item={item} />
        ))}

        {isStaff && (
          <>
            <div className="my-3 border-t border-border" />
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Staff
            </p>
            {!isAdmin && supportLinks.map((item) => (
              <NavLinkItem key={item.path} item={item} />
            ))}
            {isAdmin && adminLinks.map((item) => (
              <NavLinkItem key={item.path} item={item} />
            ))}
          </>
        )}
      </div>

      <div className="mt-auto border-t border-border pt-3">
        {bottomLinks.map((item) => (
          <NavLinkItem key={item.path} item={item} />
        ))}
      </div>
    </nav>
  )
}
