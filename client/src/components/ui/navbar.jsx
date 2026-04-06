import { NavLink } from 'react-router-dom'
import { CreditCard, Home, Info } from 'lucide-react'

const navLinks = [
  { name: 'Home', path: '/', icon: Home },
  { name: 'About', path: '/about', icon: Info },
  { name: 'Cards Demo', path: '/cards-demo', icon: CreditCard },
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