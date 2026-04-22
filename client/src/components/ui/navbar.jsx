import { NavLink } from 'react-router-dom'
<<<<<<< HEAD
import { CreditCard, LayoutDashboard, Settings } from 'lucide-react'
=======
import { CreditCard, Home, LayoutDashboard, Settings } from 'lucide-react'
>>>>>>> a672d313c05f1e938e8f7575e057bf30c368eaf8

const navLinks = [
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'Wallet', path: '/wallet', icon: CreditCard },
  { name: 'Settings', path: '/settings', icon: Settings },
]

export default function Navbar() {
  return (
    <nav className="flex flex-col gap-1">
      {navLinks.map((item) => {
        const Icon = item.icon

        return (
          <NavLink
            key={item.path}
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
      })}
    </nav>
  )
}