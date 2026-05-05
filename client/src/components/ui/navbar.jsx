import { NavLink } from 'react-router-dom'
import { CreditCard, LayoutDashboard, Settings, Shield } from 'lucide-react'
import { getAuthUser } from '@/utils/authStorage'

const userNavLinks = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Wallet', path: '/wallet', icon: CreditCard },
  { name: 'Settings', path: '/settings', icon: Settings },
]

const adminNavLinks = [{ name: 'Users', path: '/admin', icon: Shield }]

function NavLinkItem({ item }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      end
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
          isActive
            ? 'bg-accent text-accent-foreground border-l-4 border-primary font-semibold'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`
      }
    >
      <Icon className="w-5 h-5" />
      {item.name}
    </NavLink>
  )
}

export default function Navbar() {
  const user = getAuthUser()
  const isAdmin = user?.role_name === 'admin'

  return (
    <nav className="flex flex-col gap-1.5">
      {userNavLinks.map((item) => (
        <NavLinkItem key={item.path} item={item} />
      ))}

      {isAdmin && (
        <>
          <div className="my-2 border-t border-border" />
          <p className="px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Admin Features
          </p>
          {adminNavLinks.map((item) => (
            <NavLinkItem key={item.path} item={item} />
          ))}
        </>
      )}
    </nav>
  )
}