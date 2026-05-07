import { NavLink } from 'react-router-dom'
import { CreditCard, LayoutDashboard, Settings, Shield } from 'lucide-react'
import { useAppSelector } from '@/store/hooks'
import { selectAuthUser } from '@/store/slices/authSlice'

const mainLinks = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Wallet', path: '/wallet', icon: CreditCard },
]

const adminLinks = [{ name: 'Users', path: '/admin', icon: Shield }]

const bottomLinks = [{ name: 'Settings', path: '/settings', icon: Settings }]

function NavLinkItem({ item }) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.path}
      end
      className={({ isActive }) =>
        `nav-pill flex items-center gap-3 px-3 py-2.5 rounded-[15px] text-sm font-medium ${
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
  const isAdmin = user?.role_name === 'admin'

  return (
    <nav className="flex h-full flex-col">
      <div className="flex flex-col gap-1">
        {mainLinks.map((item) => (
          <NavLinkItem key={item.path} item={item} />
        ))}

        {isAdmin && (
          <>
            <div className="my-3 border-t border-border" />
            <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Admin Features
            </p>
            {adminLinks.map((item) => (
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
