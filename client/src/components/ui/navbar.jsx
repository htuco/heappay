import { NavLink } from 'react-router-dom'
import { ArrowLeftRight, CreditCard, LayoutDashboard, Settings, Shield } from 'lucide-react'
import { useAppSelector } from '@/store/hooks'
import { selectAuthUser } from '@/store/slices/authSlice'
import SidebarAccountProfile from '@/components/ui/SidebarAccountProfile'

const mainLinks = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Wallet', path: '/wallet', icon: CreditCard },
  { name: 'Transactions', path: '/payments', icon: ArrowLeftRight },
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
        `nav-pill group relative flex h-11 items-center gap-3 rounded-input px-3.5 text-sm ${
          isActive
            ? 'bg-primary/10 text-sidebar-foreground font-semibold ring-1 ring-primary/10'
            : 'font-medium text-muted-foreground hover:bg-muted/55 hover:text-sidebar-foreground'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={`absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-pill bg-primary transition-opacity ${
              isActive ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <Icon
            className={`h-4.5 w-4.5 shrink-0 transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-sidebar-foreground'
            }`}
            strokeWidth={2}
          />
          <span className="truncate">{item.name}</span>
        </>
      )}
    </NavLink>
  )
}

function NavSection({ label, children, className = '' }) {
  return (
    <section className={`space-y-1.5 ${className}`}>
      <p className="px-3.5 text-[10px] font-semibold uppercase text-muted-foreground/75">
        {label}
      </p>
      <div className="space-y-1">{children}</div>
    </section>
  )
}

export default function Navbar() {
  const user = useAppSelector(selectAuthUser)
  const isAdmin = user?.role_name === 'admin'

  return (
    <nav className="flex h-full flex-col">
      <div className="flex flex-col gap-6">
        <NavSection label="Main">
          {mainLinks.map((item) => (
            <NavLinkItem key={item.path} item={item} />
          ))}
        </NavSection>

        {isAdmin && (
          <NavSection label="Management">
            {adminLinks.map((item) => (
              <NavLinkItem key={item.path} item={item} />
            ))}
          </NavSection>
        )}
      </div>

      <NavSection label="Account" className="mt-auto border-t border-sidebar-border/80 pt-5">
        <SidebarAccountProfile user={user} />
        {bottomLinks.map((item) => (
          <NavLinkItem key={item.path} item={item} />
        ))}
      </NavSection>
    </nav>
  )
}
