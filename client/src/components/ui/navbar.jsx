import { NavLink } from 'react-router-dom'
import { Home, Info, LayoutDashboard, Settings } from 'lucide-react'

const navLinks = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
  { name: 'About', path: '/about', icon: Info },
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
